# Margav Energy CRM - Backend API

Production-ready Node.js/Express backend for the Margav Energy CRM, a solar/energy sales CRM.

## Tech Stack

- **Runtime:** Node.js 20+
- **Framework:** Express
- **Language:** TypeScript
- **Database:** PostgreSQL
- **ORM:** Prisma
- **Validation:** Zod
- **Auth:** JWT + bcrypt

## Prerequisites

- Node.js 20+
- PostgreSQL 14+ (or use Docker)
- npm or yarn

## Quick Start

### 1. Install dependencies

```bash
cd backend
npm install
```

### 2. Environment setup

```bash
cp .env.example .env
```

Edit `.env` and set at minimum:

- `DATABASE_URL` - PostgreSQL connection string
- `JWT_SECRET` - Strong secret for JWT signing (change in production)

### 3. Database setup

**Option A: Local PostgreSQL**

Install PostgreSQL from [postgresql.org](https://www.postgresql.org/download/windows/), create a database named `margav_crm`, then update `DATABASE_URL` in `.env`:

```
DATABASE_URL="postgresql://postgres:YOUR_PASSWORD@localhost:5432/margav_crm?schema=public"
```

**Option B: Docker (Postgres only)**

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) to be installed and running.

```bash
# Use "docker compose" (Docker v2+) or "docker-compose" (standalone)
docker compose -f docker-compose.dev.yml up -d
```

### 4. Initialize database

```bash
# Generate Prisma client
npm run db:generate

# Push schema to database (creates tables)
npm run db:push

# Seed sample data
npm run db:seed
```

### 5. Run the API

```bash
# Development (with hot reload)
npm run dev

# Production
npm run build
npm start
```

The API runs at `http://localhost:3001` by default.

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `NODE_ENV` | Environment | `development` |
| `PORT` | Server port | `3001` |
| `DATABASE_URL` | PostgreSQL connection string | Required |
| `JWT_SECRET` | JWT signing secret | Required in production |
| `JWT_EXPIRES_IN` | JWT expiry | `7d` |
| `CORS_ORIGINS` | Comma-separated allowed origins | `http://localhost:3000,http://localhost:5173` |
| `TWILIO_ACCOUNT_SID` | Twilio (future) | - |
| `TWILIO_AUTH_TOKEN` | Twilio (future) | - |
| `TWILIO_PHONE_NUMBER` | Twilio (future) | - |
| `BUSINESS_HOURS_START` | Office hours start (hour) | `9` |
| `BUSINESS_HOURS_END` | Office hours end (hour) | `18` |
| `BUSINESS_HOURS_TZ` | Timezone for office hours | `Europe/London` |
| `DEFAULT_QUALIFIER_ID` | Default qualifier for callback tasks | First QUALIFIER user |

## SMS Lead Journey

State-driven workflow for lead response via SMS:

1. **Lead created** → Initial SMS sent within 5 secs (async)
2. **Office hours** → Acknowledgement SMS + urgent qualifier callback task (5 min)
3. **Outside hours** → Qualifying questions SMS; if reply → callback for next office hours; if no reply → chase call task for next office hours (72h)
4. **Appointment booked** → `bookAppointment`; optional "surveyor on route" SMS; final outcomes: PITCH_AND_MISS, SALE_WON, SWEEP

**Endpoints:**
- `POST /api/sms-journey/webhook/inbound` - Twilio webhook (no auth)
- `POST /api/sms-journey/send-initial/:leadId` - Manual trigger
- `POST /api/sms-journey/call-outcome` - Log qualifier outcome (WRONG_NUMBER, NOT_INTERESTED, APPOINTMENT_BOOKED, NO_ANSWER, CALLBACK_REQUESTED)
- `POST /api/sms-journey/book-appointment` - Book appointment from journey
- `POST /api/sms-journey/surveyor-on-route/:appointmentId` - Send surveyor SMS
- `POST /api/sms-journey/appointment-outcome` - Log final outcome
- `POST /api/sms-journey/process-no-replies` - Cron: create chase tasks for non-repliers (72h)

**Configure Twilio:** Set webhook URL to `https://your-api/api/sms-journey/webhook/inbound` for inbound SMS.

**Full Twilio setup:** See [docs/TWILIO_SMS_SETUP.md](../docs/TWILIO_SMS_SETUP.md) for step-by-step instructions.

## Prisma Commands

```bash
npm run db:generate   # Generate Prisma client
npm run db:push       # Push schema (no migrations)
npm run db:migrate    # Run migrations (creates migration files)
npm run db:seed       # Run seed script
npm run db:studio     # Open Prisma Studio (DB GUI)
```

## Seed Data

The seed creates:

- **Users:** 1 admin, 1 agent, 1 qualifier, 2 field sales reps
- **Leads:** 5 sample leads across various statuses
- **Appointments:** 3 scheduled appointments
- **Opportunities:** 3 opportunities (various stages)
- **Tasks:** 5 tasks

**Default password for all seed users:** `Password123!`

**Admin login:** `admin@margav.com`

## Docker

Requires [Docker Desktop](https://www.docker.com/products/docker-desktop/) to be installed.

### Development (Postgres only)

```bash
docker compose -f docker-compose.dev.yml up -d
```

### Full stack (API + Postgres)

```bash
docker compose up -d
```

> **Note:** Use `docker compose` (with a space) on Docker Desktop. If you have the standalone `docker-compose` CLI, use that instead.

Build and run both API and PostgreSQL. API at `http://localhost:3001`.

## API Overview

### Authentication

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/auth/register` | Register new user |
| POST | `/api/auth/login` | Login, returns JWT |
| GET | `/api/auth/me` | Current user (requires auth) |

### Users (Admin only)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/users` | List users (paginated) |
| GET | `/api/users/:id` | Get user |
| POST | `/api/users` | Create user |
| PATCH | `/api/users/:id` | Update user |

### Leads

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/leads` | List leads (filters: status, source, search, assigned*) |
| GET | `/api/leads/:id` | Get lead |
| POST | `/api/leads` | Create lead |
| PATCH | `/api/leads/:id` | Update lead |
| PATCH | `/api/leads/:id/status` | Update lead status |
| GET | `/api/leads/:id/history` | Lead status history |

### Appointments

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/appointments` | List appointments |
| GET | `/api/appointments/:id` | Get appointment |
| POST | `/api/appointments` | Create appointment |
| PATCH | `/api/appointments/:id` | Update appointment |
| PATCH | `/api/appointments/:id/status` | Update status |

### Opportunities

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/opportunities` | List opportunities |
| GET | `/api/opportunities/:id` | Get opportunity |
| POST | `/api/opportunities` | Create opportunity |
| PATCH | `/api/opportunities/:id` | Update opportunity |

### Tasks

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/tasks` | List tasks |
| GET | `/api/tasks/:id` | Get task |
| POST | `/api/tasks` | Create task |
| PATCH | `/api/tasks/:id` | Update task |
| PATCH | `/api/tasks/:id/status` | Update status |

### Notes

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/notes` | Create note |
| GET | `/api/notes` | List notes (filter by entity) |
| GET | `/api/notes/:id` | Get note |

### Reports

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/reports/funnel` | Conversion funnel |
| GET | `/api/reports/product-mix` | Product mix distribution |
| GET | `/api/reports/monthly-trends` | Monthly performance |
| GET | `/api/reports/rep-performance` | Sales rep performance |

All report endpoints accept `?months=6` (default) for date range.

### SMS (Placeholder for Twilio)

| Method | Endpoint | Description |
|--------|----------|-------------|
| GET | `/api/sms/threads/lead/:leadId` | Get/create SMS thread for lead |
| GET | `/api/sms/threads/:id` | Get thread with messages |
| POST | `/api/sms/threads/:id/send` | Send message (structure ready) |

## Response Format

Success:

```json
{
  "success": true,
  "data": { ... }
}
```

Error:

```json
{
  "success": false,
  "error": "Error message"
}
```

Paginated:

```json
{
  "success": true,
  "data": {
    "items": [...],
    "total": 100,
    "page": 1,
    "pageSize": 20,
    "totalPages": 5
  }
}
```

## Authentication

Include the JWT in the `Authorization` header:

```
Authorization: Bearer <token>
```

## Role Permissions

| Role | Permissions |
|------|-------------|
| ADMIN | Full access |
| AGENT | Create/update leads, mark outcomes |
| QUALIFIER | Qualify leads, set appointments |
| FIELD_SALES | Manage appointments, opportunities |
| All | View own data, tasks, notes |

## Project Structure

```
backend/
├── prisma/
│   ├── schema.prisma    # Data model
│   └── seed.ts          # Seed script
├── src/
│   ├── app.ts           # Express app
│   ├── server.ts        # Entry point
│   ├── config/          # Configuration
│   ├── db/               # Prisma client
│   ├── middleware/       # Auth, validation, errors
│   ├── modules/         # Feature modules
│   │   ├── auth/
│   │   ├── users/
│   │   ├── leads/
│   │   ├── appointments/
│   │   ├── opportunities/
│   │   ├── tasks/
│   │   ├── notes/
│   │   ├── reports/
│   │   └── sms/
│   ├── types/
│   └── utils/
├── Dockerfile
├── docker-compose.yml
└── docker-compose.dev.yml
```

## Twilio Integration (Future)

The codebase is structured for Twilio:

- `src/modules/sms/` - SMS service, routes, types
- `SmsThread` and `SmsMessage` models in Prisma
- Add `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_PHONE_NUMBER` to enable
- Implement `sendSms` in `sms.service.ts` with Twilio client
- Add webhook route for status callbacks

## Frontend Integration

The React frontend can replace mock data with API calls:

1. Set `VITE_API_URL` or equivalent to `http://localhost:3001`
2. Store JWT from login response
3. Add `Authorization: Bearer <token>` to all requests
4. Map API response shapes to frontend components
