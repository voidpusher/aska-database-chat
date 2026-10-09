# Aska

Aska is a full-stack retail analytics application that combines a conversational query interface with dashboard views for sales, customers, inventory, and orders. The project includes authentication, demo access, CSV import, schema inspection, and backend APIs for day-to-day data exploration workflows.

The original white/navy design is restored for sign-in, database connections, chat, and dashboards. Sign-in returns to the database setup flow without the later shop-profile detour. Demo sign-in uses sample retail data; normal accounts use their own connected or imported data. Existing `orrico_*` storage keys, cookies, and database table names remain compatible with saved accounts.

## Intelligence and deployment

- Without an AI key, local queries support schema inspection, table previews, counts, totals, averages, top rows, and explicit read-only SQL. Ambiguous metrics request clarification.
- Configure `GEMINI_API_KEY` in the server environment or the root `.env` file. `GEMINI_MODEL` defaults to `gemini-3.8-flash`. Restart the server after configuring the key. Obtain a key at https://aistudio.google.com/apikey. Aska sends database schema, conversation context, and limited query results to Gemini for analysis. Keys stay on the server. There is no intent-based or fixed-answer fallback; missing credentials and provider failures display explicit errors. Tests mock provider responses and do not establish live Gemini availability.
- `ENABLE_SEMANTIC_SEARCH=true` opts into the embedding model download. It is off by default.
- Query results are capped at 500 rows. PostgreSQL and MySQL queries run in read-only transactions with a 10-second statement limit; SQLite queries use a read-only database handle. TLS connections validate certificates.
- First CSV import creates a private SQLite database per account. CSV replacements are transactional; duplicate headers and malformed rows fail validation.
- CSV databases require persistent storage at `APP_DATA_DIRECTORY`. Use a single application instance with a mounted data volume for CSV workspaces. Ephemeral/serverless deployments and multiple replicas need a separate shared storage design before supporting CSV imports reliably.
- Production still requires real database, email, encryption, allowed-origin, and public-URL configuration. Configure billing credentials only when enabling subscriptions. Run readiness and smoke checks against the actual deployment before release; local tests do not establish production readiness.

## Features

- email/password authentication
- demo account for walkthroughs
- password hashing, expiring API sessions, email verification, and password reset
- chat-based querying for retail data
- voice input in chat
- dashboard views for business metrics
- CSV import into SQLite
- schema-aware querying for imported tables
- live PostgreSQL/MySQL connection testing and schema inspection
- safe read-only table queries across SQLite, PostgreSQL, and MySQL
- persisted chat history for signed-in users
- database connection setup for MySQL, PostgreSQL, and SQLite (Oracle is not implemented)

## Tech Stack

- React 18
- Parcel
- Tailwind CSS
- Node.js
- Express
- SQLite
- PostgreSQL (optional app persistence via `DATABASE_URL`)

## Project Structure

```text
.
|-- api/
|-- server/
|-- src/
|   |-- components/
|   |-- data/
|   `-- lib/
|-- index.html
|-- package.json
|-- vercel.json
`-- README.md
```

## Local Setup

### Prerequisites

- Node.js 24.x
- npm

### Install

```bash
npm install
```

### Run locally

```bash
npm run dev
```

This starts:

- frontend: `http://localhost:3000`
- backend: `http://localhost:4000`

### Production build

```bash
npm run build
```

### Production smoke test

```bash
npm run smoke:prod
```

Optional:

```bash
SMOKE_BASE_URL=https://your-production-domain npm run smoke:prod
```

## Environment Variables

Create a local `.env` file using `.env.example` as a reference.

```env
API_BASE_URL=http://localhost:4000/api
SESSION_TTL_HOURS=720
PASSWORD_RESET_TTL_HOURS=2
EMAIL_VERIFICATION_TTL_HOURS=24
APP_DATA_DIRECTORY=server/data
APP_ENCRYPTION_KEY=replace-with-a-strong-secret-key
DATABASE_URL=
PGSSL=disable
CORS_ALLOWED_ORIGINS=http://localhost:3000,http://127.0.0.1:3000
EMAIL_PROVIDER=resend
EMAIL_AUTH_OPTIONAL=false
RESEND_API_KEY=
EMAIL_FROM=no-reply@example.com
EMAIL_REPLY_TO=support@example.com
APP_BASE_URL=http://localhost:3000
```

## Demo Account

- Email: `demo@orrico.com`
- Password: `demo123`

## API Routes

- `GET /api/health`
- `GET /api/health/ready`
- `POST /api/auth/signup`
- `POST /api/auth/login`
- `POST /api/auth/verify-email/request`
- `POST /api/auth/verify-email/confirm`
- `POST /api/auth/password-reset/request`
- `POST /api/auth/password-reset/confirm`
- `GET /api/auth/session`
- `POST /api/auth/logout`
- `GET /api/database/current`
- `GET /api/database/schema`
- `POST /api/database/test`
- `POST /api/database/connect`
- `POST /api/database/import-csv`
- `POST /api/chat/message`
- `GET /api/chat/history`
- `GET /api/intelligence/status`

## Notes

- the application persists users, sessions, connections, chat history, and auth tokens in SQLite by default
- if `DATABASE_URL` is configured, app persistence moves to PostgreSQL with a migration path from the existing SQLite snapshot
- stored database credentials are encrypted before persistence
- verification and reset emails are provider-backed when `RESEND_API_KEY` and sender env vars are configured
- set `EMAIL_AUTH_OPTIONAL=true` to temporarily bypass email verification requirements until sender setup is ready
- `GET /api/health` exposes runtime/storage status and config warnings
- `GET /api/health/ready` returns `503` until the store is reachable and required production env vars are configured
- SQLite is the main working query engine in the current version, both for app state and demo/imported analytics data
- PostgreSQL and MySQL now support live connection testing and schema inspection
- SQLite remains the strongest path for built-in retail analytics and CSV-driven querying
- PostgreSQL/MySQL now support safe read-only schema and table queries
- Oracle remains a planned connector
- MySQL and PostgreSQL connection flows are present in the product, but live querying is still centered on SQLite-backed workflows

## Launch Checklist

Before launch, complete these items:

1. configure production Vercel env vars:
   - `DATABASE_URL`
   - `RESEND_API_KEY`
   - `EMAIL_FROM`
   - `APP_BASE_URL`
   - `APP_ENCRYPTION_KEY`
   - `CORS_ALLOWED_ORIGINS`
2. redeploy production
3. verify `GET /api/health/ready` returns `200`
4. run `npm run smoke:prod`
5. manually test:
   - signup
   - email verification
   - login/logout
   - password reset
   - dashboard load
   - product/customer/order write flows
   - CSV import
   - chat history

## License

This project is currently maintained as a private codebase.
