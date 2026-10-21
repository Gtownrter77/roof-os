# Handoff: open stack, paid left in place

Rule: remove a paid call only when a free replacement is already in that slot. If no free service is found, leave the paid one and flag it here.

Branch: free-local-stack. Changes must pass the release checks before merge to main.

## Replaced

| Paid call | Free replacement | Where |
| --- | --- | --- |
| OpenAI whisper-1 | faster-whisper, MIT build of openai/whisper. No key. | workers/whisper, WHISPER_URL |
| OpenAI gpt-4o-mini chat | Ollama llama3:8b. Keywords only if Ollama is down. No hosted chat key. | lib/ai/ollama.ts, lib/ai/chat-copilot.ts |
| Receptionist OpenAI fallback | Same Ollama model, then the keyword rule engine. | lib/receptionist-ai.ts |

| Gemini 2.5 Flash photo / aerial / siding analysis | Replaced in code with the OpenAI-compatible local vision API (`OLLAMA_VISION_API_BASE_URL`, default `http://localhost:20128/v1`) and Qwen3-VL as the recommended model (`OLLAMA_VISION_MODEL`, default `qwen3-vl:8b`). The three routes use the same local client; no Gemini key is required. The endpoint must be reachable from the app runtime. | lib/ai/local-vision.mjs, app/api/photo-estimate/analyze/route.ts, app/api/measurements/aerial/route.ts, app/api/siding/analyze/route.ts |

## Free claims document path

CapOut remains in place as an optional paid adapter. It is not replaced by a fake ESX generator. The free path is `POST /api/claims/local`, backed by the self-hosted `workers/claims` service. That worker uses Docling for local PDF structure and OCR, with PaddleOCR or OCRmyPDF available as deployment-side alternatives. It writes a `provider=owner_import` record with `status=ready_for_review`; it never creates an approved insurance estimate, Verisk/Xactimate ESX file, or authoritative price.

The free claims path requires `CLAIMS_DOCUMENT_WORKER_URL` and must remain on a trusted private network. The worker must allow only the configured Supabase Storage origin, cap downloads, and retain no source document after parsing. Human review remains mandatory.

## Free speech path

The existing `workers/whisper` service already uses the free MIT-licensed faster-whisper engine. Keep it. Speaches is an optional server wrapper when OpenAI-compatible STT endpoints or streaming are needed; WhisperX is optional only for word timestamps and diarization.

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
- Capout. Paid claims key only. The free local parser handles document extraction, not proprietary ESX or licensed pricing.
- Supabase. Database.
- Xactimate / Verisk. Named only. Not licensed.

Do not delete those keys or call sites until a free replacement is in the same slot.
