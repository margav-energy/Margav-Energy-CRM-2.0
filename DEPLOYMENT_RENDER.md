# Deploy Margav CRM on Render (frontend + backend)

This repo includes [`render.yaml`](render.yaml) so you can create **both** services from one Blueprint.

## Prerequisites

1. **PostgreSQL** — Render Postgres or [Supabase](https://supabase.com) / [Neon](https://neon.tech). Copy the **connection string** (PostgreSQL URL).
2. **GitHub** — Repo pushed to GitHub (e.g. `margav-energy/Margav-Energy-CRM-2.0`).

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
