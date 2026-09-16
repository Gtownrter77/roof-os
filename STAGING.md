# Staging vs live

- `main` is live. Vercel ships that.
- A pull request is a preview. That is staging.
- Never test a new payment hook on live first.
- Never put Stripe secret or service role in the preview README.
