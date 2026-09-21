import { NextResponse } from "next/server";

const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";

const SAFE_MODELS = [
  "openrouter/free",
  "google/gemma-4-26b-a4b-it:free",
  "google/gemma-4-31b-it:free",
  "nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free",
];

const GEMINI_MODELS = [
  "google/gemini-3.8-flash",
  "google/gemini-3.7-flash",
  "google/gemini-3.6-flash",
];

function isFree(model) {
  return model?.pricing?.prompt === "0" && model?.pricing?.completion === "0";
}

function supportsText(model) {
  const inputs = model?.architecture?.input_modalities || [];
  const outputs = model?.architecture?.output_modalities || [];
  return inputs.includes("text") && outputs.includes("text");
}

async function callModel(model, apiKey) {
  const started = Date.now();

  try {
    const response = await fetch(OPENROUTER_URL, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://uxpatterns.vercel.app",
        "X-Title": "Banking UX Auditor",
      },
      body: JSON.stringify({
        model,
        messages: [
          {
            role: "user",
            content: "Reply with exactly: MODEL_OK",
          },
        ],
        max_tokens: 8,
        temperature: 0,
      }),
      cache: "no-store",
    });

    const data = await response.json().catch(() => ({}));
    const content = data?.choices?.[0]?.message?.content;
    const providerModel = data?.model || model;

    if (!response.ok) {
      return {
        model,
        ok: false,
        status: response.status,
        latencyMs: Date.now() - started,
        error: data?.error?.message || `HTTP ${response.status}`,
      };
    }

    return {
      model,
      resolvedModel: providerModel,
      ok: Boolean(content),
      status: response.status,
      latencyMs: Date.now() - started,
      response: typeof content === "string" ? content.trim().slice(0, 120) : null,
      usage: data?.usage
        ? {
            promptTokens: data.usage.prompt_tokens ?? null,
            completionTokens: data.usage.completion_tokens ?? null,
            totalTokens: data.usage.total_tokens ?? null,
          }
        : null,
    };
  } catch (error) {
    return {
      model,
      ok: false,
      status: 0,
      latencyMs: Date.now() - started,
      error: error instanceof Error ? error.message : "Unknown request error",
    };
  }
}

async function getCatalog(apiKey) {
  const response = await fetch("https://openrouter.ai/api/v1/models", {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    cache: "no-store",
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.error?.message || `Model catalog returned HTTP ${response.status}`);
  }

  return Array.isArray(data?.data) ? data.data : [];
}

export async function GET(request) {
  const apiKey = process.env.OPENROUTER_API_KEY;

  if (!apiKey) {
    return NextResponse.json(
      {
        ok: false,
        error: "OPENROUTER_API_KEY is not configured in the server environment.",
      },
      { status: 500 }
    );
  }

  const { searchParams } = new URL(request.url);
  const scope = searchParams.get("scope") || "safe";
  const includePaid = searchParams.get("includePaid") === "true";
  const requestedModels = searchParams.get("models");
  const limit = Math.min(Math.max(Number(searchParams.get("limit")) || 12, 1), 30);

  let candidates = [];
  let source = "safe";

  try {
    if (requestedModels) {
      candidates = requestedModels
        .split(",")
        .map((model) => model.trim())
        .filter(Boolean)
        .slice(0, limit);
      source = "explicit";
    } else if (scope === "safe") {
      candidates = SAFE_MODELS;
    } else {
      const catalog = await getCatalog(apiKey);

      if (scope === "google") {
        const freeGoogle = catalog
          .filter((model) => model.id?.startsWith("google/") && isFree(model) && supportsText(model))
          .map((model) => model.id);

        candidates = [...new Set([
          ...freeGoogle,
          ...(includePaid ? GEMINI_MODELS : []),
        ])].slice(0, limit);
        source = includePaid ? "google-free-plus-selected-gemini" : "google-free";
      } else if (scope === "free") {
        candidates = catalog
          .filter((model) => isFree(model) && supportsText(model))
          .sort((a, b) => {
            const aMultimodal = (a.architecture?.input_modalities || []).includes("image") ? 1 : 0;
            const bMultimodal = (b.architecture?.input_modalities || []).includes("image") ? 1 : 0;
            return bMultimodal - aMultimodal;
          })
          .map((model) => model.id)
          .slice(0, limit);
        source = "free-catalog";
      } else {
        return NextResponse.json(
          {
            ok: false,
            error: "Unsupported scope. Use safe, free, google, or pass models=modelA,modelB.",
          },
          { status: 400 }
        );
      }
    }

    const uniqueCandidates = [...new Set(candidates)];
    const results = await Promise.all(uniqueCandidates.map((model) => callModel(model, apiKey)));
    const working = results.filter((item) => item.ok).length;

    return NextResponse.json({
      ok: working > 0,
      checkedAt: new Date().toISOString(),
      source,
      scope,
      includePaid,
      count: results.length,
      working,
      failed: results.length - working,
      results,
      notes: [
        "This endpoint sends a tiny non-sensitive prompt to each selected model.",
        "The default safe scope only tests free models.",
        "Paid Gemini models are tested only when includePaid=true and may consume OpenRouter credits.",
        "Do not send customer data or banking PII to this health-check endpoint.",
      ],
    });
  } catch (error) {
    return NextResponse.json(
      {
        ok: false,
        error: error instanceof Error ? error.message : "Model check failed.",
      },
      { status: 502 }
    );
  }
}
