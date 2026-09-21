# Banking UX Auditor

India-focused MVP for auditing recorded banking journeys for UX transparency, deceptive-design patterns and potential regulatory relevance.

## Current MVP
- Screen-recording upload UI for MP4, MOV and WebM
- Banking journey selection
- Local prototype analysis state with evidence timeline
- Banking-specific dark-pattern taxonomy
- Three-layer evidence model: observed UX → pattern classification → regulatory relevance
- Clear separation between UX hypotheses and formal legal/compliance conclusions

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
