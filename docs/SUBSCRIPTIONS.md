# MCTaba subscription workflow and Vercel API setup

## Current subscription workflow

1. A library owner signs in and creates a library. The Vercel API verifies the Firebase ID token, then atomically creates the library, owner membership and user profile link.
2. The owner opens **Subscription & billing** and selects Weekly, Monthly or Yearly.
3. The API verifies the caller owns that library and saves the requested billing cycle in `subscriptions/{libraryId}`. Selecting a cycle never marks the subscription paid or active.
4. Once MCTaba's payment provider is chosen and configured, the API should create a provider checkout/payment request and save a pending payment record.
5. A verified server-to-server provider callback/webhook must validate the provider signature and transaction reference, amount, currency, library and billing cycle. Only then may trusted server code mark the payment successful and the subscription active.
6. The subscription stores the period start/end and renewal status. A scheduled job should mark expired subscriptions and apply the agreed access policy. Account access and billing history should remain available so owners can renew.
7. A library owner can see their own subscription record. Client-side writes to subscription documents are denied by Firestore rules.

## Current implementation

- Vercel API endpoints: `/api/library`, `/api/circulation`, and `/api/subscriptions`.
- The endpoints verify Firebase ID tokens with Firebase Admin and enforce library membership/owner checks.
- Book creation, checkout and return use trusted server-side transactions so copies, aggregate availability and loans remain consistent.
- Firebase Cloud Functions are no longer called by the browser.
- Payment collection is intentionally not enabled yet: no provider, pricing or merchant credentials have been selected. The API stores a billing-cycle selection as `awaiting_payment_setup`; it does not simulate a payment or grant a paid subscription.

## Required Vercel environment variables

Add these under Vercel Project Settings → Environment Variables for the environments you intend to use:

- `FIREBASE_PROJECT_ID`: `mctaba-85685`
- `FIREBASE_SERVICE_ACCOUNT_JSON`: the complete JSON contents of a Firebase service-account key for project `mctaba-85685`

Keep `FIREBASE_SERVICE_ACCOUNT_JSON` server-only. Do not prefix it with `VITE_`, commit it to GitHub, put it in frontend code, or paste it into chat. Create/download the key from Firebase Console → Project settings → Service accounts, then paste its complete JSON into Vercel's encrypted environment-variable value field. Restrict access to the Vercel project and rotate the key if it is ever exposed. Redeploy after adding the variables.

The service account grants privileged access because Firebase Admin bypasses Firestore Security Rules. Use it only in server-side Vercel functions.

## Decisions still required before live payments

- Payment provider (for Kenya, M-Pesa is one option; it has not been enabled).
- Weekly, monthly and yearly prices in KES.
- Whether a free trial exists and its duration.
- Grace period and what library features become read-only or unavailable after expiry.
- Payment provider credentials and the public callback/webhook URL.

Do not activate subscriptions from a browser request, screenshot, receipt upload or unverified callback. Only verified provider transaction data may activate or renew paid access.
