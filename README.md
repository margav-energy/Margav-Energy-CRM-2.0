# Margav Energy CRM

Solar/energy sales CRM with role-based dashboards.

## Project structure

```
Margav_CRM_2.0/
├── frontend/     # React + Vite + TypeScript
├── backend/      # Node.js + Express + Prisma
└── README.md
```

## Quick start

**Backend:**
```bash
cd backend
npm install
npm run db:generate
npm run db:push
npm run db:seed
npm run dev
```

**Frontend:**
```bash
cd frontend
npm install
npm run dev
```

Open http://localhost:5173

## Deploy on Render (frontend + backend)

This repo includes [`render.yaml`](render.yaml) (Blueprint) and a full guide: **[DEPLOYMENT_RENDER.md](DEPLOYMENT_RENDER.md)**.

Summary: create a **PostgreSQL** database (Render, Supabase, or Neon), deploy the **API** (Docker) and **static frontend** from the Blueprint, set `DATABASE_URL`, `JWT_SECRET`, `CORS_ORIGINS` on the API, and `VITE_API_URL` (e.g. `https://your-api.onrender.com/api`) on the static site.

## Documentation

- [Admin Dashboard Spec](docs/ADMIN_DASHBOARD_SPEC.md)
- [Twilio SMS Setup](docs/TWILIO_SMS_SETUP.md) – Configure Twilio for the SMS Lead Journey
- [ngrok Setup](docs/NGROK_SETUP.md) – Use ngrok to test Twilio webhooks locally
- [Lead Import Integration](docs/LEAD_IMPORT_INTEGRATION.md) – Connect lead gen providers & Google Sheets to the CRM
- [Lead Import Setup Steps](docs/LEAD_IMPORT_SETUP_STEPS.md) – Step-by-step setup (localhost, ngrok, API key)
