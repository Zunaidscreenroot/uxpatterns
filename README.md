# Banking UX Auditor

India-focused MVP for auditing recorded banking journeys for UX transparency, deceptive-design patterns and potential regulatory relevance.

## Current MVP
- Screen-recording upload UI for MP4, MOV and WebM
- Banking journey selection
- Local prototype analysis state with evidence timeline
- Banking-specific dark-pattern taxonomy
- Three-layer evidence model: observed UX → pattern classification → regulatory relevance
- Server-side model health-check endpoint with separate Gemini and OpenRouter providers
- Clear separation between UX hypotheses and formal legal/compliance conclusions

## Model health check

The checker keeps both API keys server-side and never exposes them to the browser.

### Gemini — direct Google API

GET /api/models/check?provider=gemini

Uses GEMINI_API_KEY and calls the Google Gemini API directly.

Useful checks:
- /api/models/check?provider=gemini — discover and test available Gemini models that support generateContent.
- /api/models/check?provider=gemini&model=gemini-3.8-flash — test one specific Gemini model.
- /api/models/check?provider=gemini&models=gemini-3.8-flash,gemini-3.7-flash — test an explicit list.

### OpenRouter

GET /api/models/check?provider=openrouter

Uses OPENROUTER_API_KEY and calls OpenRouter directly.

Useful checks:
- /api/models/check?provider=openrouter — test the fixed free-model safety set.
- /api/models/check?provider=openrouter&scope=free&limit=20 — test free text-capable models from the live OpenRouter catalog.
- /api/models/check?provider=openrouter&model=google/gemma-4-31b-it:free — test one specific OpenRouter model.
- /api/models/check?provider=openrouter&models=google/gemma-4-26b-a4b-it:free,nvidia/nemotron-3-nano-omni-30b-a3b-reasoning:free — test an explicit list.

The checker reports distinct states such as working, rate_limited, unsupported, blocked, empty_response and failed. A successful HTTP 200 response is not incorrectly marked as failed merely because a model returns reasoning instead of plain message.content.

The fixed OpenRouter safety set intentionally excludes openrouter/free because that router can resolve to a different underlying model on different requests, which is undesirable for reproducible audit results.

Both providers use a tiny non-sensitive MODEL_OK prompt. Never send customer PII, credentials, financial information or real banking data to this health-check endpoint.

Required Vercel environment variables:
- GEMINI_API_KEY
- OPENROUTER_API_KEY

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
