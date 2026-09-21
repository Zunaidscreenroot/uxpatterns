# Banking UX Auditor

India-focused MVP for auditing recorded banking journeys for UX transparency, deceptive-design patterns and potential regulatory relevance.

## Current MVP
- Screen-recording upload UI for MP4, MOV and WebM
- Banking journey selection
- Local prototype analysis state with evidence timeline
- Banking-specific dark-pattern taxonomy
- Three-layer evidence model: observed UX → pattern classification → regulatory relevance
- Server-side OpenRouter model health-check endpoint
- Clear separation between UX hypotheses and formal legal/compliance conclusions

## Model health check

The app keeps the OpenRouter API key server-side and exposes:

`GET /api/models/check?scope=safe`

Safe mode tests a small set of free models without sending any user video or banking data.

Other useful checks:

- `/api/models/check?scope=free&limit=20` — test up to 20 free text-capable models from the live OpenRouter catalog.
- `/api/models/check?scope=google&limit=12` — test free Google models currently available.
- `/api/models/check?scope=google&includePaid=true` — also test selected Gemini Flash models; paid inference may consume OpenRouter credits.
- `/api/models/check?models=google/gemma-4-26b-a4b-it:free,google/gemini-3.8-flash` — test an explicit model list.

The endpoint uses a tiny `MODEL_OK` prompt and reports status, latency, resolved model, response and token usage where available. It must never receive customer PII or real banking data.

## Next engine
1. Extract representative keyframes and timestamps from the uploaded video.
2. OCR visible text and reconstruct screen-to-screen transitions.
3. Detect candidate patterns from copy, interaction sequence, consent and CTA hierarchy.
4. Map findings to source-backed Indian banking requirements.
5. Generate an evidence report with screenshots, timestamps, rationale and review status.

## Product principle
This is an audit aid, not legal or regulatory certification. Findings should remain reviewable and source-backed.

## Stack
Next.js 14 + React 18 + plain CSS. No UI/icon dependency is required for the MVP.
