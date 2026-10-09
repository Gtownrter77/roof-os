# Handoff: open stack, paid left in place

Rule: remove a paid call only when a free replacement is already in that slot. If no free service is found, leave the paid one and flag it here.

Branch: wire/local-whisper. Not on main until the pull request is merged.

## Replaced

| Paid call | Free replacement | Where |
| --- | --- | --- |
| OpenAI whisper-1 | faster-whisper, MIT build of openai/whisper. No key. | workers/whisper, WHISPER_URL |
| OpenAI gpt-4o-mini chat | Ollama llama3:8b. Keywords only if Ollama is down. | lib/ai/ollama.ts |
| Receptionist OpenAI fallback | Same Ollama model, then the keyword rule engine. | lib/receptionist-ai.ts |
| Gemini 2.5 Flash photo analysis | Ollama llava, local, no key. Same observation contract. | lib/ai/local-vision.mjs, photo-estimate analyze route |

Pull llava once: `ollama pull llava`. Set OLLAMA_VISION_MODEL if you use another local vision model.

Siding and aerial routes still import the Gemini request helper. They are not switched until this same helper is called from those files. Do not delete GEMINI_API_KEY from a deploy until those two routes are switched.

## Left, because no free replacement was found

- Stripe. Card checkout and webhooks.
- Twilio. Phone and SMS.
- Lowe's client id and secret. Retailer price feed.
- RapidAPI.
- Capout.
- Supabase. Database.

Do not delete those keys or call sites until a free replacement is in the same slot.
