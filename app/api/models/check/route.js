import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS = [
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
  "nex-agi/nex-n2.5-pro:free",
  "nex-agi/nex-n2.5-mini:free",
];

const GEMINI_TEST_MODELS = [
  "gemini-3.8-flash",
  "gemini-3.7-flash",
  "gemini-3.6-flash",
];

function classifyHttpStatus(status) {
  if (status === 429) return "rate_limited";
  if (status === 400 || status === 404) return "unsupported";
  if (status === 401 || status === 403) return "blocked";
  if (status >= 200 && status < 300) return "working";
  return "failed";
}

function textFromOpenRouterMessage(message) {
  const content = message?.content;
  if (typeof content === "string") return content.trim() || null;
  if (Array.isArray(content)) {
    return content.map((part) => typeof part === "string" ? part : part?.text || "").join("").trim() || null;
  }
  return null;
}

function textFromGeminiResponse(data) {
  const parts = data?.candidates?.[0]?.content?.parts;
  if (!Array.isArray(parts)) return null;
  const text = parts.map((part) => typeof part?.text === "string" ? part.text : "").join("").trim();
  return text || null;
}

function openRouterUsage(usage) {
  if (!usage) return null;
  return {
    promptTokens: usage.prompt_tokens ?? null,
    completionTokens: usage.completion_tokens ?? null,
    totalTokens: usage.total_tokens ?? null,
  };
}

function geminiUsage(usage) {
  if (!usage) return null;
  return {
    promptTokens: usage.promptTokenCount ?? null,
    completionTokens: usage.candidatesTokenCount ?? null,
    totalTokens: usage.totalTokenCount ?? null,
  };
}

async function callOpenRouterModel(model, apiKey) {
  const started = Date.now();
  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: "Bearer " + apiKey,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://uxpatterns.vercel.app",
        "X-Title": "Banking UX Auditor",
      },
      body: JSON.stringify({
        model,
        messages: [{ role: "user", content: "Reply with exactly: MODEL_OK" }],
        max_tokens: 16,
        temperature: 0,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    const latencyMs = Date.now() - started;
    const choice = data?.choices?.[0];
    const message = choice?.message;
    const content = textFromOpenRouterMessage(message);
    const reasoning = typeof message?.reasoning === "string"
      ? message.reasoning.trim()
      : Array.isArray(message?.reasoning) ? JSON.stringify(message.reasoning) : null;

    if (!response.ok) {
      return {
        model,
        status: classifyHttpStatus(response.status),
        httpStatus: response.status,
        latencyMs,
        error: data?.error?.message || "HTTP " + response.status,
      };
    }

    const hasUsableResponse = Boolean(content) || Boolean(reasoning) || Boolean(choice?.finish_reason);

    return {
      model,
      resolvedModel: data?.model || model,
      status: hasUsableResponse ? "working" : "empty_response",
      httpStatus: response.status,
      latencyMs,
      response: content?.slice(0, 160) || null,
      hasReasoning: Boolean(reasoning),
      finishReason: choice?.finish_reason || null,
      usage: openRouterUsage(data?.usage),
    };
  } catch (error) {
    return {
      model,
      status: "failed",
      httpStatus: 0,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown request error",
    };
  }
}

async function getOpenRouterCatalog(apiKey) {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: { Authorization: "Bearer " + apiKey },
    cache: "no-store",
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Model catalog returned HTTP " + response.status);
  }
  return Array.isArray(data?.data) ? data.data : [];
}

function isFreeOpenRouterModel(model) {
  return model?.pricing?.prompt === "0" && model?.pricing?.completion === "0";
}

function supportsTextOutput(model) {
  const inputs = model?.architecture?.input_modalities || [];
  const outputs = model?.architecture?.output_modalities || [];
  return inputs.includes("text") && outputs.includes("text");
}

function normalizeGeminiModel(model) {
  return model.startsWith("models/") ? model : "models/" + model;
}

async function getGeminiCatalog(apiKey) {
  const response = await fetch(
    "https://generativelanguage.googleapis.com/v1beta/models?key=" + encodeURIComponent(apiKey),
    { cache: "no-store" }
  );
  const data = await response.json().catch(() => ({}));
  if (!response.ok) {
    throw new Error(data?.error?.message || "Gemini catalog returned HTTP " + response.status);
  }
  return Array.isArray(data?.models) ? data.models : [];
}

async function callGeminiModel(model, apiKey, metadata = null) {
  const started = Date.now();
  const modelName = normalizeGeminiModel(model);

  try {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/" +
        modelName +
        ":generateContent?key=" +
        encodeURIComponent(apiKey),
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [{ parts: [{ text: "Reply with exactly: MODEL_OK" }] }],
          generationConfig: { temperature: 0, maxOutputTokens: 16 },
        }),
        cache: "no-store",
      }
    );

    const data = await response.json().catch(() => ({}));
    const latencyMs = Date.now() - started;
    const text = textFromGeminiResponse(data);
    const candidate = data?.candidates?.[0];

    if (!response.ok) {
      return {
        model: modelName.replace(/^models\//, ""),
        status: classifyHttpStatus(response.status),
        httpStatus: response.status,
        latencyMs,
        error: data?.error?.message || "HTTP " + response.status,
      };
    }

    const hasUsableResponse =
      Boolean(text) ||
      Boolean(candidate?.finishReason) ||
      Boolean(candidate?.content?.parts?.length);

    return {
      model: modelName.replace(/^models\//, ""),
      status: hasUsableResponse ? "working" : "empty_response",
      httpStatus: response.status,
      latencyMs,
      response: text?.slice(0, 160) || null,
      finishReason: candidate?.finishReason || null,
      inputTokenLimit: metadata?.inputTokenLimit ?? null,
      outputTokenLimit: metadata?.outputTokenLimit ?? null,
      usage: geminiUsage(data?.usageMetadata),
    };
  } catch (error) {
    return {
      model: modelName.replace(/^models\//, ""),
      status: "failed",
      httpStatus: 0,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown request error",
    };
  }
}

function summarize(results) {
  const counts = results.reduce((acc, item) => {
    acc[item.status] = (acc[item.status] || 0) + 1;
    return acc;
  }, {});

  return {
    count: results.length,
    working: counts.working || 0,
    rateLimited: counts.rate_limited || 0,
    unsupported: counts.unsupported || 0,
    blocked: counts.blocked || 0,
    emptyResponse: counts.empty_response || 0,
    failed: counts.failed || 0,
  };
}

export async function GET(request) {
  const { searchParams } = new URL(request.url);
  const provider = (searchParams.get("provider") || "openrouter").toLowerCase();
  const scope = (searchParams.get("scope") || "safe").toLowerCase();
  const requestedModel = searchParams.get("model");
  const requestedModels = searchParams.get("models");
  const includePaid = searchParams.get("includePaid") === "true";
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 12, 1), 30);

  if (provider === "gemini") {
    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: "GEMINI_API_KEY is not configured in the server environment." },
        { status: 500 }
      );
    }

    try {
      const catalog = await getGeminiCatalog(apiKey);
      const byName = new Map(
        catalog
          .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
          .map((model) => [model.name, model])
      );

      let candidates;
      if (requestedModel || requestedModels) {
        candidates = (requestedModels || requestedModel)
          .split(",")
          .map((model) => normalizeGeminiModel(model.trim()))
          .filter(Boolean)
          .slice(0, limit);
      } else {
        const preferred = GEMINI_TEST_MODELS
          .map(normalizeGeminiModel)
          .filter((model) => byName.has(model));
        const discovered = catalog
          .filter((model) => (model.supportedGenerationMethods || []).includes("generateContent"))
          .filter((model) => /gemini/i.test(model.name || ""))
          .map((model) => model.name);
        candidates = [...new Set([...preferred, ...discovered])].slice(0, limit);
      }

      const results = await Promise.all(
        candidates.map((model) => callGeminiModel(model, apiKey, byName.get(model)))
      );
      const summary = summarize(results);

      return NextResponse.json({
        ok: summary.working > 0,
        provider: "gemini",
        checkedAt: new Date().toISOString(),
        source: requestedModel || requestedModels ? "explicit" : "google-direct-catalog",
        scope,
        count: summary.count,
        working: summary.working,
        failed: summary.failed + summary.emptyResponse,
        summary,
        results,
        notes: [
          "Gemini models are tested directly against the Google Gemini API.",
          "No Gemini request in this endpoint is routed through OpenRouter.",
          "The checker sends only a tiny non-sensitive prompt.",
          "Do not send customer PII or real banking data to this health-check endpoint.",
        ],
      });
    } catch (error) {
      return NextResponse.json(
        { ok: false, provider: "gemini", error: error instanceof Error ? error.message : "Gemini model check failed." },
        { status: 502 }
      );
    }
  }

  if (provider !== "openrouter") {
    return NextResponse.json(
      { ok: false, error: "Unsupported provider. Use provider=gemini or provider=openrouter." },
      { status: 400 }
    );
  }

  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { ok: false, provider: "openrouter", error: "OPENROUTER_API_KEY is not configured in the server environment." },
      { status: 500 }
    );
  }

  try {
    let candidates;
    let source;

    if (requestedModel || requestedModels) {
      candidates = (requestedModels || requestedModel)
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
        .slice(0, limit);
      source = "explicit";
    } else if (scope === "safe") {
      candidates = OPENROUTER_MODELS.slice(0, limit);
      source = "fixed-free";
    } else {
      const catalog = await getOpenRouterCatalog(apiKey);

      if (scope === "free" || scope === "all") {
        const pool = scope === "free" || !includePaid
          ? catalog.filter(isFreeOpenRouterModel)
          : catalog;
        candidates = pool
          .filter(supportsTextOutput)
          .sort((a, b) => {
            const aMultimodal = (a.architecture?.input_modalities || []).includes("image") ? 1 : 0;
            const bMultimodal = (b.architecture?.input_modalities || []).includes("image") ? 1 : 0;
            return bMultimodal - aMultimodal;
          })
          .map((model) => model.id)
          .slice(0, limit);
        source = scope === "free" || !includePaid ? "free-catalog" : "catalog";
      } else {
        return NextResponse.json(
          { ok: false, provider: "openrouter", error: "Unsupported scope. Use safe, free, all, or pass model/models." },
          { status: 400 }
        );
      }
    }

    const uniqueCandidates = [...new Set(candidates)];
    const results = await Promise.all(
      uniqueCandidates.map((model) => callOpenRouterModel(model, apiKey))
    );
    const summary = summarize(results);

    return NextResponse.json({
      ok: summary.working > 0,
      provider: "openrouter",
      checkedAt: new Date().toISOString(),
      source,
      scope,
      includePaid,
      count: summary.count,
      working: summary.working,
      failed: summary.failed + summary.emptyResponse,
      summary,
      results,
      notes: [
        "OpenRouter models are tested directly through the OpenRouter API.",
        "Gemini models are intentionally excluded from this provider path.",
        "The default safe scope uses fixed free model IDs; it does not use openrouter/free because that router can resolve to a different model on each request.",
        "A 429 response means provider rate limiting/capacity, not that the model itself is necessarily broken.",
        "A 200 response with reasoning or a finish reason is considered a usable model response even when message.content is empty.",
        "Do not send customer PII or real banking data to this health-check endpoint.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      { ok: false, provider: "openrouter", error: error instanceof Error ? error.message : "OpenRouter model check failed." },
      { status: 502 }
    );
  }
}
