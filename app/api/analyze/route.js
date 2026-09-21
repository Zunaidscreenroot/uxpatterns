import { NextResponse } from "next/server";

const GEMINI_MODELS = ["gemini-3.8-flash", "gemini-3.7-flash"];
const OPENROUTER_MODELS = ["nex-agi/nex-n2.5-pro:free", "nex-agi/nex-n2.5-mini:free"];

const SYSTEM_PROMPT = `You are an evidence-first banking UX auditor for India. Analyze only what is visible in the supplied screen-recording frames and the provided journey name.

Return ONLY valid JSON with this shape:
{
  "summary": "short factual summary",
  "findings": [
    {
      "timestamp": "MM:SS",
      "title": "short title",
      "pattern": "one of: Drip pricing, Consent manipulation, Basket sneaking, Forced action, False urgency, Interface interference, Cancellation friction, Trick wording",
      "severity": "High|Medium|Low",
      "confidence": 0.0,
      "evidence": "what is visibly shown",
      "rationale": "why this may fit the pattern",
      "regulatory_relevance": "potential relevance only; do not claim a legal violation"
    }
  ]
}

Rules:
- Do not invent text, screens, interactions, timestamps, fees, consent, or regulations.
- If evidence is insufficient, omit the finding.
- A pattern is a hypothesis, not a legal conclusion.
- Prefer 0-6 strong findings over many weak findings.
- For timestamp, use the frame timestamp supplied by the caller.
- Separate observed evidence from interpretation.
- Regulatory relevance must remain cautious and generic unless a specific visible fact supports it.
`;

function extractJson(text) {
  if (!text) return null;
  const cleaned = text.replace(/\`\`\`json\s*/i, "").replace(/\`\`\`/g, "").trim();
  try { return JSON.parse(cleaned); } catch {}
  const match = cleaned.match(/\{[\s\S]*\}/);
  if (!match) return null;
  try { return JSON.parse(match[0]); } catch { return null; }
}

function normalizeReport(data) {
  const findings = Array.isArray(data?.findings) ? data.findings : [];
  return {
    summary: typeof data?.summary === "string" ? data.summary : "Analysis completed with limited evidence.",
    findings: findings.slice(0, 8).map((f) => ({
      timestamp: typeof f.timestamp === "string" ? f.timestamp : "00:00",
      title: typeof f.title === "string" ? f.title : "Potential UX issue",
      pattern: typeof f.pattern === "string" ? f.pattern : "Interface interference",
      severity: ["High","Medium","Low"].includes(f.severity) ? f.severity : "Low",
      confidence: Math.max(0, Math.min(1, Number(f.confidence) || 0)),
      evidence: typeof f.evidence === "string" ? f.evidence : "Evidence was not clearly described.",
      rationale: typeof f.rationale === "string" ? f.rationale : "",
      regulatory_relevance: typeof f.regulatory_relevance === "string" ? f.regulatory_relevance : "Requires human review."
    }))
  };
}

async function callGemini(model, apiKey, frames, flow) {
  const parts = [{ text: SYSTEM_PROMPT + "\nJourney: " + flow + "\nFrame metadata follows." }];
  for (const frame of frames) {
    parts.push({ text: "Frame timestamp: " + frame.timestamp });
    parts.push({ inlineData: { mimeType: "image/jpeg", data: frame.data } });
  }

  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models/" + model + ":generateContent?key=" + encodeURIComponent(apiKey),
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ role: "user", parts }],
        generationConfig: { temperature: 0, maxOutputTokens: 2500, responseMimeType: "application/json" }
      }),
      cache: "no-store"
    }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "Gemini HTTP " + response.status);
  const text = data?.candidates?.[0]?.content?.parts?.map((p) => p?.text || "").join("").trim();
  if (!text) {
    const finish = data?.candidates?.[0]?.finishReason || "UNKNOWN";
    throw new Error("Gemini returned no text (finishReason: " + finish + ").");
  }
  const parsed = extractJson(text);
  if (!parsed) throw new Error("Gemini returned non-JSON analysis output.");
  return { report: normalizeReport(parsed), model, provider: "gemini", usage: data?.usageMetadata || null };
}

async function callOpenRouter(model, apiKey, frames, flow) {
  const frameSummary = frames.map((f) => "[" + f.timestamp + "] screenshot supplied to the visual audit pipeline").join("\n");
  const prompt = SYSTEM_PROMPT + "\nJourney: " + flow + "\n" + frameSummary +
    "\nThis fallback receives metadata only, so do not infer visual facts. Return an empty findings array if evidence is insufficient.";
  const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + apiKey,
      "Content-Type": "application/json",
      "HTTP-Referer": "https://uxpatterns.vercel.app",
      "X-Title": "Banking UX Auditor"
    },
    body: JSON.stringify({ model, messages: [{ role: "user", content: prompt }], temperature: 0, max_tokens: 2500 }),
    cache: "no-store"
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data?.error?.message || "OpenRouter HTTP " + response.status);
  const content = typeof data?.choices?.[0]?.message?.content === "string" ? data.choices[0].message.content : "";
  return { report: normalizeReport(extractJson(content)), model, provider: "openrouter", usage: data?.usage || null };
}

export async function POST(request) {
  try {
    const body = await request.json();
    const flow = typeof body?.flow === "string" ? body.flow : "Other Banking Flow";
    const frames = Array.isArray(body?.frames) ? body.frames : [];

    if (!frames.length) return NextResponse.json({ ok: false, error: "No frames supplied." }, { status: 400 });
    if (frames.length > 8) return NextResponse.json({ ok: false, error: "Maximum 8 frames per analysis." }, { status: 400 });
    if (frames.some((f) => typeof f?.data !== "string" || !f.data.length)) {
      return NextResponse.json({ ok: false, error: "Invalid frame payload." }, { status: 400 });
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    const openRouterKey = process.env.OPENROUTER_API_KEY;
    const errors = [];

    if (geminiKey) {
      for (const model of GEMINI_MODELS) {
        try {
          const result = await callGemini(model, geminiKey, frames, flow);
          return NextResponse.json({ ok: true, ...result, evidenceFrames: frames.length });
        } catch (error) {
          errors.push("Gemini " + model + ": " + (error instanceof Error ? error.message : "request failed"));
        }
      }
    }

    // OpenRouter text models are intentionally not used as a visual fallback.\n    // A result must be grounded in the supplied video pixels.\n\n    return NextResponse.json({ ok: false, error: "Visual analysis could not be completed.", details: errors }, { status: 502 });
  } catch (error) {
    return NextResponse.json({ ok: false, error: error instanceof Error ? error.message : "Analysis failed." }, { status: 500 });
  }
}
