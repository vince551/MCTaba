# Mctaba

**Your library. Smarter management.**

Mctaba is a multi-tenant library management system for school, university, public, community, church and private libraries.

## Live preview

https://mctaba-five.vercel.app

The current preview URL may still serve the previous deployment until the new branch is merged and Vercel finishes building it.

## Implemented in this branch

- Firebase Authentication screens for account creation, sign-in and password reset.
- Library onboarding: register a library with a name, type and optional location.
- A trusted Vercel API route creates the library, first owner membership, audit event, initial trial record and server-managed user-to-library index.
- Existing users can choose from their registered library workspaces or register another.
- Book inventory reads live documents from `libraries/{libraryId}/books` in Cloud Firestore.
- Adding a book uses a trusted Vercel API route to create a title, physical-copy records and an audit event.
- Member registration, member search and CSV export use Firestore reader records.
- Checkout and returns use Vercel API routes and Firebase Admin transactions to update loan and copy records atomically.
- Firestore rules prevent browser users from creating libraries or editing memberships and protect the server-managed `libraryIds` index.
- Responsive authentication and onboarding screens.

**Not fully live yet:** reports, notifications, dashboard statistics, reservations, billing and most settings still contain preview/demo content. Member active-loan counts and some dashboard analytics are not yet data-backed. Test the authentication, rules and Cloud Functions end-to-end before using real library records.

## Stack

- React 19 + Vite
- Firebase Authentication
- Cloud Firestore
- Vercel Node.js API routes + Firebase Admin SDK
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
7. Deploy the Firestore rules using the Firebase CLI, or paste `firestore.rules` into Firebase Console → Firestore Database → Rules and publish them:
   ```bash
   firebase deploy --only firestore:rules
   ```
   The app's trusted server operations run as Vercel API routes, so you do not need Firebase Cloud Functions or a Firebase billing-plan upgrade for those routes.
8. In Vercel → Project Settings → Environment Variables, configure `FIREBASE_SERVICE_ACCOUNT_JSON` as a **Sensitive** variable for Production, Preview and Development. Its value must be the complete JSON key for a service account in project `mctaba-85685` with permission to access Authentication and Firestore. Never commit or share this key. Redeploy after adding it.
9. Run locally:
   ```bash
   npm run dev
   ```
10. For Vercel, set the six `VITE_FIREBASE_*` values from Firebase Console → Project settings → Your apps → Web app configuration for Preview and Production, then redeploy.

## 2. How library registration works

1. A library administrator creates an account with an email and password.
2. They register a library and choose its type.
3. The trusted `/api/library` Vercel route creates the library, owner membership, trial record, audit event and user profile index atomically. Browser clients cannot grant themselves an owner role.
4. The administrator can add catalogue titles. The trusted `/api/library` route creates both the title and physical copy records.
5. Staff can register readers, then check out and return physical copies through trusted API routes and transactions.

## Firestore data model

- `users/{uid}` — user profile and server-managed `libraryIds` index.
- `libraries/{libraryId}` — library metadata.
- `libraries/{libraryId}/memberships/{uid}` — role and active status.
- `libraries/{libraryId}/books/{bookId}` — catalogue titles and aggregate copy counts.
- `libraries/{libraryId}/copies/{copyId}` — physical copies for circulation.
- `libraries/{libraryId}/readers/{readerId}` — registered library readers.
- `libraries/{libraryId}/loans/{loanId}` — transactional circulation records.
- `libraries/{libraryId}/auditLogs/{logId}` — backend-generated audit events.

The UI connects library provisioning, book/copy creation, reader registration, checkout and returns to Firestore-backed services. More complete workflows such as renewals, reservations and member activity history remain on the roadmap.

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

1. Add emulator-based security tests for tenant isolation, user onboarding and all role combinations.
2. Add copy editing, renewals, reservations and member activity history.
3. Implement notifications, data-backed reports and audit views.
4. Add App Check, error monitoring, backups and production deployment checks.
5. Add subscriptions only after the core library workflows and security model are validated.
