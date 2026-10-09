# No paid AI

The AI path on this branch does not call OpenAI, Gemini, or any hosted model API.

- Speech-to-text: local faster-whisper via WHISPER_URL. If the worker is down, transcription fails. It does not invent text.
- Receptionist: local Ollama (OLLAMA_HOST, default llama3:8b). If Ollama is down, a keyword rule engine answers. No OpenAI fallback.
- Chat copilot: keyword router only. The OpenAI chat completion call is removed.

Stripe and Twilio remain. They are the shop's payment and phone rails, not the model stack. Say if those should come out too.
