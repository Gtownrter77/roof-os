# Handoff: open stack, paid left in place

Rule: remove a paid call only when a free replacement is already in that slot. If no free service is found, leave the paid one and flag it here.

Branch: wire/local-whisper. Not on main until the pull request is merged.

## Replaced

| Paid call | Free replacement | Where |
| --- | --- | --- |
| OpenAI whisper-1 | faster-whisper, MIT build of openai/whisper. No key. | workers/whisper, WHISPER_URL |
| OpenAI gpt-4o-mini chat | Ollama llama3:8b. Keywords only if Ollama is down. No hosted chat key. | lib/ai/ollama.ts, lib/ai/chat-copilot.ts |
| Receptionist OpenAI fallback | Same Ollama model, then the keyword rule engine. | lib/receptionist-ai.ts |

| Gemini 2.5 Flash photo analysis | Ollama llava helper is in. Photo, siding, and aerial routes still call Gemini until switched. | lib/ai/local-vision.mjs |

## Retailer prices are add-ons

Not core. Do not block a report, estimate, or field flow on them. A missing key means the add-on is off, not that the app is broken.

Already wired, leave as add-ons:

- Home Depot. RapidAPI route. Reference only. 100 calls a workspace per month.
- Lowe's. Partner OAuth. Reference only.

Not wired. Add only when that account exists:

- ABC Supply, myABCSupply. Free portal for account holders. API needs that login.
- SRS Roof Hub. Free portal for account holders. Price call needs customer code and branch.
- QXO, formerly Beacon. Account app is free for customers. Pricing API is sales-gated.
- Home Depot Pro Xtra. Free account. No public API.
- Ferguson. Partner approval.

No scraper. No public free price API. A person still approves any number before it becomes a quote.

## Left, because no free replacement was found

- Stripe. Card checkout and webhooks.
- Twilio. Phone and SMS.
- Capout. Claims key only. Not a shelf price.
- Supabase. Database.
- Xactimate / Verisk. Named only. Not licensed.

Do not delete those keys or call sites until a free replacement is in the same slot.
