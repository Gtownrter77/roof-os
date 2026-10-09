# Handoff: open stack, paid left in place

Rule: remove a paid call only when a free replacement is already in that slot. If no free service is found, leave the paid one and flag it here.

Branch: wire/local-whisper. Not on main until the pull request is merged.

## Replaced

| Paid call | Free replacement | Where |
| --- | --- | --- |
| OpenAI whisper-1 | faster-whisper, MIT build of openai/whisper. No key. | workers/whisper, WHISPER_URL, lib/ai/chat-copilot.ts |
| OpenAI gpt-4o-mini chat | Ollama llama3:8b. Keywords only if Ollama is down. | lib/ai/ollama.ts, lib/ai/chat-copilot.ts |
| Receptionist OpenAI fallback | Same Ollama model, then the keyword rule engine. | lib/receptionist-ai.ts |

Voice page now records and posts to /api/ai/transcribe. Browser speech recognition was already free. That page change was extra, not a paid cut.

## Left, because no free replacement was found

- Stripe. Card checkout and webhooks. No free rail does the same job.
- Twilio. Phone and SMS. No free rail does the same job.
- Gemini. Key remains in .env.example. No free vision call was wired in its place.
- Lowe's client id and secret. Retailer price feed. Left.
- RapidAPI. Left.
- Capout. Left.
- Supabase. Database. Left.

Do not delete those keys or call sites until a free replacement is in the same slot.
