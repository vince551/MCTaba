# Mctaba Express API

The Node.js API is isolated from the existing Laravel scaffold and the current Firebase/Vercel application at the repository root. The target architecture uses Render for the API, Neon for application PostgreSQL, Supabase Auth for identity, and Supabase Storage for private files.

## Requirements

- Node.js 22 LTS
- PostgreSQL 15+
- A Supabase project
- npm

## Local setup

1. From this directory, install dependencies:

   ```bash
   npm install
   ```

2. Copy `.env.example` to `.env`. Configure the Neon pooled connection string as `DATABASE_URL`, enable TLS with `DATABASE_SSL=true`, and add the Supabase Project URL and publishable key. Never put a Supabase secret/service-role key in the frontend or commit it to Git.

3. Start the API:

   ```bash
   npm run dev
   ```

4. Check:
   - `GET http://localhost:4000/`
   - `GET http://localhost:4000/health/live`
   - `GET http://localhost:4000/health/ready`

5. Apply all pending migrations to the new, empty Neon database:

   ```bash
   npm run migrate:up
   ```

## Authentication and tenant onboarding

The API verifies Supabase access tokens against Supabase Auth's `/auth/v1/user` endpoint using the project's publishable key. It does not trust decoded, unverified JWT claims. Verified Supabase identities are synchronized into the Neon `users` table.

- `GET /auth/me`: returns the signed-in user's Neon profile and library memberships.
- `GET /libraries`: lists only libraries where the authenticated user has an active membership.
- `POST /libraries`: creates a library and makes the authenticated user its owner in one database transaction.

Send the Supabase access token as `Authorization: Bearer <access_token>`. The client must obtain this token from Supabase Auth. Library IDs supplied by clients are never treated as proof of authorization.

## Render deployment

Keep the existing Render API service and update its environment variables only after the Neon database and Supabase project details have been checked.

Required variables:
- `NODE_ENV=production`
- `DATABASE_URL`: Neon pooled connection string (use the pooled endpoint for the API)
- `DATABASE_SSL=true`
- `DATABASE_SSL_REJECT_UNAUTHORIZED=true`
- `SUPABASE_URL`: Supabase Project URL
- `SUPABASE_PUBLISHABLE_KEY`: Supabase publishable key
- `CORS_ORIGINS`: exact Vercel frontend origin(s), comma-separated, no wildcard

Run `npm run migrate:up` once against the Neon database before sending application traffic to the new API. Do not run migrations automatically on API startup.

## Storage

Supabase Storage will use private buckets. File upload/download endpoints must be added with server-side Neon membership checks and short-lived signed URLs. Do not make library documents public and do not expose a Supabase secret/service-role key to browser code. Storage bucket policies and signed URL routes are a separate implementation step; they are not enabled by this API change.

## Safety boundaries

- The existing Vercel frontend, Firebase Authentication, Firestore, Firebase rules, and existing data remain unchanged.
- The Laravel scaffold remains in place.
- The temporary Render PostgreSQL database is not migrated, deleted, or modified by this code.
- No secrets are committed. The new Neon database must be the only application database after the cutover is explicitly approved.
