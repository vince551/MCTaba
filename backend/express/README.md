# Mctaba Express API

This is the new Node.js API service for the Express + PostgreSQL implementation. It is intentionally isolated from the existing Laravel scaffold in `backend/` and the current Firebase/Vercel application at the repository root.

**Phase 1 only:** service bootstrap, environment validation, PostgreSQL connection pool, health endpoints, and the initial tenant foundation migration. Authentication and business endpoints are not implemented in this phase.

## Requirements

- Node.js 22 LTS
- PostgreSQL 15+
- npm

## Local setup

1. From this directory, install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env` and set `DATABASE_URL` for a new, empty development database. Do not reuse the existing Firebase data or the Laravel database.

3. Start the API:

   ```bash
   npm run dev
   ```

4. Check:
   - `GET http://localhost:4000/`
   - `GET http://localhost:4000/health/live`
   - `GET http://localhost:4000/health/ready` (requires a reachable PostgreSQL server)

5. Apply the initial schema only to the new, empty PostgreSQL database:

   ```bash
   npm run migrate:up
   ```

The migration creates users, libraries, memberships, and audit logs. It does not import or modify Firebase or Laravel records. Do not run a down migration against a database containing data.

## Render deployment settings

Create a separate Render Web Service and set its **Root Directory** to `backend/express`.

- Runtime: Node
- Build command: `npm install`
- Start command: `npm start`
- Health check path: `/health/ready` (checks PostgreSQL connectivity)

Set these environment variables in Render:

- `NODE_ENV=production`
- `DATABASE_URL`: the connection string for the new Render PostgreSQL database (use the Render internal connection string when the web service and database are in the same region)
- `CORS_ORIGINS`: exact Vercel frontend origin(s), comma-separated, with no wildcard
- `DATABASE_SSL=true` only when required by the selected database connection endpoint; keep certificate verification enabled
- `PORT` is supplied by Render automatically

Run `npm run migrate:up` as a one-off command after reviewing the target database and before enabling application traffic. Do not place migrations in the server startup command.

## Phase 1 database foundation

- `users`: unique case-insensitive email identity and password-hash storage.
- `libraries`: independent tenant records.
- `memberships`: user-to-library roles and membership state, unique per library/user pair.
- `audit_logs`: tenant-aware audit event storage.

Every future tenant-scoped API must verify an active membership for the requested library on the server. A client-provided library ID is never authorization.

## Safety boundaries

- The root React/Vite app and its Vercel deployment are unchanged.
- Firebase Authentication, Firestore, Firebase rules, and existing data are unchanged.
- The Laravel scaffold remains in place and is not used by this Express service.
- No Render service, PostgreSQL instance, production environment variable, or secret is created by this repository change.
- The migration is not executed by this change. Review the database target before applying it.
