# Mctaba Laravel API (migration in progress)

This directory is the new Laravel 12 + PostgreSQL backend. The existing React/Vite frontend is deliberately preserved while API parity is implemented and tested; do not delete Firebase code or change the production frontend to this API until the cutover is verified.

## Requirements

- PHP 8.2+
- Composer 2
- PostgreSQL 15+
- Node.js 20+ for the existing frontend

## Local setup

1. Copy `.env.example` to `.env` and configure PostgreSQL and `FRONTEND_URL`.
2. From this directory run:

```bash
composer install
php artisan key:generate
php artisan install:api
php artisan migrate
php artisan serve
```

If `php artisan install:api` adds/updates Sanctum scaffolding, review its changes before committing. The Sanctum dependency is already declared here.

## API

- `GET /api/health` — health check.
- `POST /api/auth/register`, `POST /api/auth/login` — account and bearer-token auth.
- Authenticated routes use `Authorization: Bearer <token>`.
- Libraries are tenant workspaces; every catalogue, reader and loan request must prove active membership in the requested library.

## Migration phases

1. Add Laravel app skeleton and PostgreSQL schema (this commit).
2. Implement auth, tenant authorization policies, and transactional library provisioning.
3. Implement books/copies, readers, checkout/return with row locks and audit logs.
4. Add API contract tests and run migrations against a clean PostgreSQL database.
5. Replace Firebase client auth/data access in React with a Laravel API client, keeping the UI intact.
6. Import existing Firestore data with a dry-run, per-library mapping, reconciliation report and rollback plan.
7. Configure production PostgreSQL and Laravel hosting, then cut over only after smoke tests.

## Security rules for the migration

- Never trust a client-supplied `library_id` without checking the authenticated user's active membership.
- Never accept role, owner, or platform-admin privilege from public registration payloads.
- Checkout and return must be database transactions with row locks.
- Keep secrets in environment variables; never commit `.env`, database passwords, app keys, or tokens.
- Do not migrate live data until a verified export and rollback plan exist.

This backend is a migration scaffold, not yet production-ready. Do not connect it to real library records until controllers, policies, tests, and production configuration are complete.