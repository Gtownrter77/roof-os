# ROOF/OS Handoff

**Handoff date:** 2026-09-14

## Current live website

ROOF/OS is permanently deployed on the free Vercel Hobby plan:

- Production URL: https://roof-os-lemon.vercel.app
- Vercel project: `roof-os`
- Hosting: Vercel Hobby
- Source: GitHub `Gtownrter77/roof-os`, branch `main`

The latest Vercel deployment was verified as **Ready**. The login route returned `200 OK`, and unauthenticated requests to `/` redirected to `/auth/login`.

## Completed in this session

The repository was reviewed, repaired, and pushed to GitHub. The following changes are complete:

1. Fixed production standalone asset serving and documented the original review.
2. Restored Tailwind/PostCSS processing and corrected route navigation.
3. Replaced the demo authentication cookie with Supabase email authentication.
4. Added Supabase magic-link login and real account creation flows.
5. Added `/auth/callback` for Supabase authorization-code session exchange.
6. Updated middleware to refresh and validate Supabase sessions server-side.
7. Connected the GitHub repository to Vercel for automatic deployments.
8. Added the Supabase URL and publishable key to Vercel Production environment variables.
9. Redeployed successfully and verified the permanent Vercel URL.

## Important security notes

- The Supabase publishable key is safe for browser use, but it must remain separate from any secret/service-role key.
- `.env.local` is ignored and was not included in GitHub or the job ZIP.
- No Supabase database password or service-role key was provided or stored.
- If the provided publishable key is ever replaced, update Vercel Production variables and redeploy.

## Remaining simulated or incomplete areas

These areas were intentionally **not** claimed as production-complete:

- Leads are still hardcoded in the UI and need Supabase tables, row-level security, and CRUD procedures.
- New lead creation currently does not persist to the database.
- Camera photos currently use browser/local storage rather than Supabase Storage.
- AI, payment, report export, Home Depot, and other integrations remain simulated or placeholder workflows.
- Supabase email confirmation and redirect URLs should be checked in the Supabase dashboard for the permanent domain:
  `https://roof-os-lemon.vercel.app/auth/callback`

## Important commits

- `b2873fd` — document permanent Vercel deployment
- `af0bdeb` — connect Supabase email authentication
- `945ee14` — serve standalone static assets and document review
- `6092151` — restore Tailwind styling and route navigation

## Next recommended work

If continuing later, work in small verified batches:

1. Configure Supabase Auth redirect URLs for the Vercel domain.
2. Create database schema and RLS policies for workspaces, users, leads, inspections, and photos.
3. Replace leads UI hardcoded data with authenticated Supabase queries and mutations.
4. Add Supabase Storage upload flow for inspection photos.
5. Add provider credentials only when the user explicitly chooses the AI, payments, or external integration providers.
6. Run build, TypeScript, HTTP, browser, and Vercel deployment checks after each batch.

## How to resume

```bash
gh repo clone Gtownrter77/roof-os
cd roof-os
npm ci
npm run build
npx tsc --noEmit
```

The latest source is already on GitHub. Do not commit `.env.local`, Supabase service-role keys, database passwords, or generated build directories.
