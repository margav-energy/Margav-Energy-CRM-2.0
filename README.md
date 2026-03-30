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

## Documentation

- [Admin Dashboard Spec](docs/ADMIN_DASHBOARD_SPEC.md)
- [Twilio SMS Setup](docs/TWILIO_SMS_SETUP.md) – Configure Twilio for the SMS Lead Journey
- [ngrok Setup](docs/NGROK_SETUP.md) – Use ngrok to test Twilio webhooks locally
- [Lead Import Integration](docs/LEAD_IMPORT_INTEGRATION.md) – Connect lead gen providers & Google Sheets to the CRM
- [Lead Import Setup Steps](docs/LEAD_IMPORT_SETUP_STEPS.md) – Step-by-step setup (localhost, ngrok, API key)
