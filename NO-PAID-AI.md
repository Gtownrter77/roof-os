# AI provider policy

ROOF/OS text AI does not call a hosted chat API. There is no `XAI_API_KEY`, OpenAI chat key, or other paid text-model key in this app.

- Text chat, receptionist, and advisory agents: local Ollama (`OLLAMA_HOST`, default `llama3:8b`). If Ollama is down, keyword rules answer. They do not invent prices, coverage, or measurements.
- Speech-to-text: local faster-whisper via `WHISPER_WORKER_URL` (the `/transcribe` endpoint) or the legacy `WHISPER_URL` base URL. The request uses multipart `file` and `language` fields. If the worker is missing, down, or returns no text, the API reports an explicit unavailable/error response and no transcript.
- Vision (photo and siding): local OpenAI-compatible Ollama inference via `OLLAMA_VISION_API_BASE_URL` (default `http://localhost:11434/v1`) with `OLLAMA_VISION_MODEL`. The `/measure` screen uses browser-local Ollama directly at `http://localhost:11434/v1` with model `qwen3-vl:8b`; the browser and Ollama must run on the same user's machine, and Ollama must allow the exact app origin through `OLLAMA_ORIGINS`. Vercel's server-side localhost is not used for this flow. Photo-estimate and siding server routes retain their separate `OLLAMA_VISION_API_BASE_URL` behavior. The browser helper has no hosted fallback. The photo is saved to private workspace storage first; returned geometry is validated server-side and is still unverified until human review/calibration. If local vision is unavailable, the route reports an error and manual measurement remains available.
- Claims import: CapOut via `CAPOUT_API_KEY` is an optional add-on.

Stripe and Twilio remain the payment and phone rails. Never put model keys in `NEXT_PUBLIC_*` or the browser bundle.
