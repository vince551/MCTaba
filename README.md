# Mctaba

**Your library. Smarter management.**

Mctaba is a multi-tenant library management SaaS for school, university, community, church and private libraries. This repository contains the React/Vite application foundation and the first responsive workspace preview.

## Current status

- Responsive React workspace with overview, inventory, circulation, members, reports, notifications and settings views.
- Searchable sample book catalogue, add-book modal and CSV inventory export.
- Firebase client initialization from environment variables.
- Initial tenant-aware Firestore rules, with sensitive membership, circulation and billing writes denied to browser clients.
- Demo records are local in-memory sample data. They are not saved to Firestore and must not be treated as real library records.

## Stack

- React + Vite
- CSS with responsive layouts
- Firebase Authentication, Cloud Firestore and Firebase Storage (configuration scaffold)
- Recharts for dashboard analytics
- Lucide icons

## Run locally

Requirements: Node.js 20+ and npm.

```bash
npm install
cp .env.example .env.local
npm run dev
```

Open the local URL printed by Vite.

## Connect Firebase

1. Create a Firebase project in the Firebase Console.
2. Enable the Authentication providers you intend to support.
3. Create a Cloud Firestore database and configure Storage if book cover uploads are needed.
4. Copy the Firebase web app configuration into `.env.local` using the `VITE_FIREBASE_*` keys from `.env.example`.
5. Review and test `firestore.rules` in the Firebase Emulator Suite before deploying any rules.
6. Implement trusted Cloud Functions for library provisioning, membership invitations/role changes, circulation transactions, scheduled notifications, audit logging and verified billing webhooks.

Firebase web configuration values are identifiers, not service-account secrets. Never commit service-account JSON, private keys, payment secrets or real `.env.local` files.

## Multi-tenant security design

Library-owned records are scoped below `libraries/{libraryId}`. Access is intended to be based on an active membership record at `libraries/{libraryId}/memberships/{userId}`, with a role such as `owner`, `admin` or `librarian`.

Membership creation and role changes, physical-copy status transitions, loan mutations, notifications, audit logs and subscription writes are deliberately blocked from direct browser writes in the starter rules. These operations require trusted backend functions and server-side validation. The rules are a starting point and are not production-ready until reviewed and tested with the Emulator Suite, including cross-tenant access-denial cases.

## Build

```bash
npm run build
npm run preview
```

## Roadmap

1. Complete authentication and library onboarding with trusted tenant provisioning.
2. Replace demo records with Firestore-backed inventory and member management.
3. Implement transactional checkout, returns, renewals and reservations.
4. Add scheduled email notifications, audit trails and data-backed reports.
5. Add subscription plans, payment-provider webhooks, usage limits and deployment monitoring.

## Repository workflow

The initial implementation is being developed on `feature/mctaba-foundation`; `main` is intentionally left unchanged until the foundation has been reviewed.
