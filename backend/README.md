# Mctaba Laravel API (migration in progress)

This directory contains the replacement Laravel 12 + PostgreSQL API. The React/Vite interface now uses this API for authentication, library workspaces, book inventory, readers, and core circulation on the migration branch. Firebase is not the active auth/data provider for those migrated screens.

**This is not yet a production cutover.** Billing, reports, notifications, advanced settings, production hosting, and the verified Firestore-to-PostgreSQL data import remain unfinished. Keep the current production deployment and Firestore data untouched until the checks below pass.

## Requirements

- PHP 8.2+
- Composer 2
- PostgreSQL 15+
- Node.js 20+ for the React frontend

## Local setup

1. Create a PostgreSQL database named `mctaba`.
2. From `backend/`, copy `.env.example` to `.env` and set the database credentials.
3. Install and start Laravel:

```bash
composer install
php artisan key:generate
php artisan migrate
php artisan serve
```

4. In the repository root, copy `.env.example` to `.env.local` and set `VITE_API_BASE_URL=http://localhost:8000`.
5. Run the frontend from the repository root:

```bash
npm install
npm run dev
```

Sanctum and the personal access token migration are already included in this scaffold; do not run `php artisan install:api`, which could publish a duplicate token-table migration.

## API

- `GET /api/health` — health check.
- `POST /api/auth/register`, `POST /api/auth/login` — account creation and sign-in.
- `GET /api/auth/me`, `POST /api/auth/logout` — current account and sign-out.
- `GET|POST /api/libraries` — list workspaces and register a library.
- `GET|POST /api/libraries/{library}/books` — list inventory and add a title with physical copies.
- `GET /api/libraries/{library}/copies` — list physical copies.
- `GET|POST /api/libraries/{library}/readers` — list and register readers.
- `GET /api/libraries/{library}/loans`, `POST /api/libraries/{library}/loans/checkout`, `POST /api/libraries/{library}/loans/{loan}/return` — circulation.

Authenticated routes use `Authorization: Bearer <token>`. Tokens are currently held in browser session storage and expire according to Sanctum configuration. Every tenant-scoped operation must check active membership in the requested library.

## Migration checklist

1. Run the PHP lint and Laravel tests in GitHub Actions; resolve any failures.
2. Run migrations against a clean PostgreSQL 15+ database and test checkout/return concurrency there.
3. Complete password recovery, email verification, authorization policy tests, pagination, and audit coverage.
4. Finish billing, reporting, notifications, and settings using Laravel endpoints.
5. Deploy Laravel and PostgreSQL to a supported host; set `APP_KEY`, `APP_DEBUG=false`, `APP_URL`, `FRONTEND_URL`, `CORS_ALLOWED_ORIGINS`, and database secrets in the host's environment settings.
6. Export Firestore data and perform a dry-run import with per-library mapping, record counts, relationship checks, and a rollback plan.
7. Smoke-test authentication, tenant isolation, inventory, readers, and circulation before changing production frontend environment settings.

## Security rules

- Never trust a client-supplied library ID without verifying active membership.
- Never accept role, owner, or platform-admin privilege from public registration payloads.
- Checkout and return are database transactions; checkout locks the selected physical copy.
- Keep secrets in environment variables; never commit `.env`, database passwords, app keys, or tokens.
- Do not migrate live data until a verified export and rollback plan exist.
