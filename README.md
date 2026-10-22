# Mctaba

**Your library. Smarter management.**

Mctaba is a multi-tenant library management system for school, university, public, community, church and private libraries.

## Live preview

https://mctaba-five.vercel.app

The current preview URL may still serve the previous deployment until the new branch is merged and Vercel finishes building it.

## Implemented in this branch

- Firebase Authentication screens for account creation, sign-in and password reset.
- Library onboarding: register a library with a name, type and optional location.
- Trusted Cloud Function creates the library, first owner membership, audit event and server-managed user-to-library index.
- Existing users can choose from their registered library workspaces or register another.
- Book inventory reads live documents from `libraries/{libraryId}/books` in Cloud Firestore.
- Adding a book writes to Firestore; live listeners keep inventory in sync across sessions.
- Firestore rules prevent browser users from creating libraries or editing memberships and protect the server-managed `libraryIds` index.
- Responsive authentication and onboarding screens.

**Not fully live yet:** circulation, members, reports, notifications, dashboard statistics, reservations, billing and most settings still contain preview/demo content. Do not use these sections as operational records until they are connected and tested.

## Stack

- React 19 + Vite
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Functions (Node.js 20)
- Firebase Storage scaffolding
- Recharts and Lucide icons

## 1. Create and configure a Firebase project

1. Open the [Firebase Console](https://console.firebase.google.com/) and create a project.
2. In **Project settings → General**, register a **Web app** and copy its web configuration.
3. Under **Build → Authentication → Sign-in method**, enable **Email/Password**.
4. Under **Build → Firestore Database**, create a database. Choose the region carefully; its location cannot easily be changed later.
5. Install Node.js 20+ and the Firebase CLI, then sign in:
   ```bash
   npm install
   npm install -g firebase-tools
   firebase login
   firebase use --add
   ```
6. Create a local `.env.local` file from `.env.example` and fill in the Web app configuration values:
   ```env
   VITE_FIREBASE_API_KEY=your-web-api-key
   VITE_FIREBASE_AUTH_DOMAIN=your-project-id.firebaseapp.com
   VITE_FIREBASE_PROJECT_ID=your-project-id
   VITE_FIREBASE_STORAGE_BUCKET=your-storage-bucket
   VITE_FIREBASE_MESSAGING_SENDER_ID=your-messaging-sender-id
   VITE_FIREBASE_APP_ID=your-web-app-id
   ```
7. Deploy the Firestore rules and the library provisioning / circulation functions:
   ```bash
   firebase deploy --only firestore:rules,functions
   ```
   Cloud Functions deployment may require enabling billing on the Firebase/Google Cloud project. Review usage and budgets before enabling billing.
8. Run locally:
   ```bash
   npm run dev
   ```
9. For Vercel, add the same six `VITE_FIREBASE_*` values in **Project Settings → Environment Variables**, for Preview and Production as needed, then redeploy.

## 2. How library registration works

1. A library administrator creates an account with an email and password.
2. They register a library and choose its type.
3. The trusted `createLibrary` Cloud Function creates the library and owner membership atomically. Browser clients cannot grant themselves an owner role.
4. The new library ID is indexed on the user's profile by the trusted function.
5. The administrator can select a workspace and add books. Inventory records are stored under that library's Firestore path.

## Firestore data model

- `users/{uid}` — user profile and server-managed `libraryIds` index.
- `libraries/{libraryId}` — library metadata.
- `libraries/{libraryId}/memberships/{uid}` — role and active status.
- `libraries/{libraryId}/books/{bookId}` — catalogue titles and aggregate copy counts.
- `libraries/{libraryId}/copies/{copyId}` — physical copies for circulation.
- `libraries/{libraryId}/readers/{readerId}` — registered library readers.
- `libraries/{libraryId}/loans/{loanId}` — transactional circulation records.
- `libraries/{libraryId}/auditLogs/{logId}` — backend-generated audit events.

The existing Cloud Functions include library provisioning and transactional checkout/return operations. The current UI does not yet connect the circulation screens to those functions.

## Security notes

- Firestore rules are a starter policy and must be tested with the Firebase Emulator Suite before real data is entered.
- The Cloud Function Admin SDK bypasses Firestore rules; server-side validation and least-privilege IAM are therefore important.
- Firebase Web app configuration is intended for client-side use, but it must be paired with correct Authentication, Firestore rules, API restrictions and App Check where appropriate.
- Never commit `.env.local`, service-account JSON, private keys, or payment secrets.
- Restrict authorized domains in Firebase Authentication to the domains you actually use.
- Do not treat the preview UI or unconnected modules as a production library system.

## Build and validation

```bash
npm run build
node --check functions/index.js
```

## Roadmap

1. Complete Firestore-backed readers and member administration.
2. Connect circulation UI to transaction-based checkout and return functions.
3. Add copy management, reservations, renewals and overdue workflows.
4. Implement notifications, data-backed reports and audit views.
5. Add emulator security tests, error monitoring, App Check and production deployment checks.
6. Add subscriptions only after the core library workflows and security model are validated.
