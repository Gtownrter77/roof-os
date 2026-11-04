# AI provider policy

ROOF/OS text AI does not call a hosted chat API. There is no `XAI_API_KEY`, OpenAI chat key, or other paid text-model key in this app.

- Text chat, receptionist, and advisory agents: local Ollama (`OLLAMA_HOST`, default `llama3:8b`). If Ollama is down, keyword rules answer. They do not invent prices, coverage, or measurements.
- Speech-to-text: local faster-whisper via `WHISPER_WORKER_URL` (the `/transcribe` endpoint) or the legacy `WHISPER_URL` base URL. The request uses multipart `file` and `language` fields. If the worker is missing, down, or returns no text, the API reports an explicit unavailable/error response and no transcript.
- Vision (photo, aerial, siding): local OpenAI-compatible inference via `OLLAMA_VISION_API_BASE_URL` (current default `http://localhost:20128/v1`) with `OLLAMA_VISION_MODEL` (default `llava`). No Gemini call or key is required by code. The endpoint must be reachable from the app runtime; if it is unavailable, the route reports an error and manual measurement remains available.
- Claims import: CapOut via `CAPOUT_API_KEY` is an optional add-on.

Stripe and Twilio remain the payment and phone rails. Never put model keys in `NEXT_PUBLIC_*` or the browser bundle.
