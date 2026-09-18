# Fifth 10 — stay alive as a product (41–50)

The machine drafts. A human sends. Stripe holds the card. We never store the card number.

| # | Item | Tonight | Open source / vendor |
| --- | --- | --- | --- |
| 41 | Billing desk copy | `/billing` | Stripe Checkout later |
| 42 | Annual plans 349/599/999 | `/offer` | Stripe Prices |
| 43 | Webhook when they pay or cancel | Not built | Stripe webhooks → our `subscriptions` |
| 44 | Export their data | `/export` stub | JSON/CSV from Postgres |
| 45 | Close the shop account | Stub on `/billing` | our workspace row |
| 46 | Terms a roofer can read | `/legal` | — |
| 47 | Backup of the file cabinet | Supabase PITR later | PostgreSQL |
| 48 | Custom domain | Vercel later | — |
| 49 | Usage cap (photos/storage) | Not built | Storage metrics |
| 50 | Status page when we break | Not built | — |

No live charges. No secret keys in git.
