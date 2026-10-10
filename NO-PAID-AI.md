# AI provider policy

ROOF/OS text AI does not call a hosted chat API. There is no `XAI_API_KEY`, OpenAI chat key, or other paid text-model key in this app.

- Text chat, receptionist, and advisory agents: local Ollama (`OLLAMA_HOST`, default `llama3:8b`). If Ollama is down, keyword rules answer. They do not invent prices, coverage, or measurements.
- Speech-to-text: local faster-whisper via `WHISPER_URL` or `WHISPER_WORKER_URL`. If the worker is down, transcription returns `Unknown`.
- Vision (photo, aerial, siding): Gemini via `GEMINI_API_KEY` is still wired. Those routes return `503` when the key is absent. A local vision helper exists and has not replaced those routes yet.
- Claims import: CapOut via `CAPOUT_API_KEY` is an optional add-on.

Stripe and Twilio remain the payment and phone rails. Never put model keys in `NEXT_PUBLIC_*` or the browser bundle.
