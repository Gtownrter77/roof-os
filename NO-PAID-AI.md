# AI provider policy

ROOF/OS text AI uses **SpaceXAI** (`XAI_API_KEY` → `https://api.x.ai/v1`) in production.

Fallbacks and other rails:

- Text chat / receptionist / advisory agents: SpaceXAI first; local Ollama (`OLLAMA_HOST`) when the cloud key is unset or unreachable; keyword rules last.
- Vision (photo / aerial / siding analyze): Gemini via `GEMINI_API_KEY`. Controlled `503` when unset.
- Speech-to-text: local faster-whisper via `WHISPER_URL` / `WHISPER_WORKER_URL`. If the worker is down, transcription returns `Unknown` and does not invent text.
- Claims import: CapOut via `CAPOUT_API_KEY` (optional add-on).

Stripe and Twilio remain the payment and phone rails. Never put model keys in `NEXT_PUBLIC_*` or the browser bundle.
