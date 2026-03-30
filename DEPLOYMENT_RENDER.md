# Deploy Margav CRM on Render (frontend + backend)

This repo includes [`render.yaml`](render.yaml) so you can create **both** services from one Blueprint.

## Prerequisites

1. **PostgreSQL** — Render Postgres or [Supabase](https://supabase.com) / [Neon](https://neon.tech). Copy the **connection string** (PostgreSQL URL).
2. **GitHub** — Repo pushed to GitHub (e.g. `margav-energy/Margav-Energy-CRM-2.0`).

---

## Set up a hosted Postgres (Supabase or Neon)

This app uses **Prisma** with `provider = "postgresql"` and reads **`DATABASE_URL`** (see `backend/prisma/schema.prisma`). You need a single URL that includes the password.

### Option A — Supabase

1. Go to [supabase.com](https://supabase.com) → sign in → **New project**.
2. Choose a **region** close to your Render API (e.g. EU if you use `frankfurt` on Render).
3. Set a **strong database password** and wait until the project is **healthy**.
4. Open **Project Settings** (gear) → **Database**.
5. Under **Connection string**, choose **URI**. Copy the string.
6. Replace `[YOUR-PASSWORD]` with your actual DB password (the one you set at project creation).
7. **SSL:** Prisma expects a secure connection. Supabase URIs usually include **`?sslmode=require`** or you can append it if missing:
   - Example shape:  
     `postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres?sslmode=require`
8. **Pooling:** Supabase offers **Transaction** mode (port 6543) vs **Session** / direct (port 5432). For a **long-running Node** API on Render, **direct** (5432) is usually simplest. If you use the **pooler**, add Prisma-compatible params per [Supabase + Prisma docs](https://supabase.com/docs/guides/database/prisma) (e.g. `?pgbouncer=true` and `connection_limit=1` when required).
9. Put the final URL in Render as **`DATABASE_URL`** (Environment → your API service). **Redeploy** the API after saving.

### Option B — Neon

1. Go to [neon.tech](https://neon.tech) → sign in → **Create project**.
2. Pick a **region** near your API and create the project.
3. In the Neon dashboard, open **Connection details** (or **Dashboard** → your project).
4. Copy the **connection string** — it is usually a `postgresql://` URI with user, password, host, and database name.
5. Ensure **SSL** is enabled (Neon typically requires it; the URL may include `sslmode=require` or you use the Neon-provided string as-is).
6. Paste the URL into Render as **`DATABASE_URL`**. **Redeploy** the API.

### After `DATABASE_URL` is set

- The **Dockerfile** runs `npx prisma db push` when the container starts, which creates/updates tables from your Prisma schema on the empty database.
- For **production** you may later switch to **`prisma migrate deploy`** in CI or a release command instead of `db push`; for a first deploy, `db push` is acceptable.
- **Seed data (optional):** run `npm run db:seed` locally against the same `DATABASE_URL` if you want default users, or insert users via your app’s admin flow.

### Troubleshooting

| Issue | What to check |
|--------|----------------|
| `Can't reach database server` | Firewall is rare on hosted DB; verify host/port, password, and that the project is not paused (Neon free tier can suspend; wake it in the dashboard). |
| SSL / certificate errors | Add or keep `?sslmode=require` on the connection string for Supabase. |
| Prisma + pooler errors | Use direct connection (5432) or follow provider docs for PgBouncer + Prisma. |

---

## One-time: create services from Blueprint

1. In [Render Dashboard](https://dashboard.render.com): **New** → **Blueprint**.
2. Connect the GitHub repo and select this repository.
3. Render reads `render.yaml` and proposes **margav-crm-api** (Docker) and **margav-crm-web** (static).
4. **Before first deploy**, open the environment for each service and set variables (see below).
5. Approve the deploy. **Deploy the API first** (or ensure the API URL exists before you set the frontend `VITE_API_URL`).

## Environment variables

### Backend (`margav-crm-api`)

| Variable | Required | Notes |
|----------|----------|--------|
| `DATABASE_URL` | Yes | Postgres URL from Render DB or Supabase/Neon. |
| `JWT_SECRET` | Yes | Long random string (e.g. `openssl rand -hex 32`). |
| `CORS_ORIGINS` | Yes | Your **frontend** public URL, comma-separated if several. Example: `https://margav-crm-web.onrender.com` |
| `PORT` | No | Render sets this automatically. |

Copy the rest from your local `backend/.env` as needed: Twilio, `LEAD_IMPORT_API_KEY`, `JWT_EXPIRES_IN`, business hours, etc.

The Docker image runs `npx prisma db push` on start so the schema is applied; for production you may prefer `prisma migrate deploy` in a release step.

### Frontend (`margav-crm-web`)

| Variable | Required | Notes |
|----------|----------|--------|
| `VITE_API_URL` | Yes | **Full API base including `/api`**, e.g. `https://margav-crm-api.onrender.com/api` |

Vite bakes this in at **build time**. After changing it, trigger a **new deploy** of the static site.

## After deploy

1. Open the API **Logs** and confirm: `Margav CRM API running on port …` and no Prisma errors.
2. Hit `https://<your-api-host>/health` — should return JSON `{ "status": "ok", ... }`.
3. Open the static site URL and try login. If the browser blocks requests, fix `CORS_ORIGINS` on the backend to match the exact frontend origin (scheme + host, no trailing slash).

## Free tier notes

- Free **web services** spin down after idle; the first request can be slow.
- Use **HTTPS** URLs only in production for `CORS_ORIGINS` and `VITE_API_URL`.

## Manual setup (without Blueprint)

If you prefer not to use `render.yaml`:

- **Web Service (API):** Docker, root `backend`, Dockerfile `backend/Dockerfile`, health check path `/health`, env vars as above.
- **Static Site:** Root directory `frontend`, build `npm ci && npm run build`, publish directory `dist`, add SPA rewrite `/*` → `/index.html`, env `VITE_API_URL` as above.  
  Production build runs **`vite build` only** (no `tsc` gate) so CI matches a working bundle. Run **`npm run typecheck`** locally when tightening types.
