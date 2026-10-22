# MCTaba subscription workflow and IntaSend setup

## User workflow

1. A library owner signs in and creates a library. The trusted Vercel API provisions the library and owner membership. If the account has not used its one free trial, the library receives a **14-day trial** immediately.
2. An owner with an existing library opens **Subscription & billing** and selects a billing cycle. The first selection starts the 14-day trial if the account has not already used it.
3. Trial access ends after 14 days. The API and Firestore rules compare the subscription period end with the current time; expired workspaces lose access to inventory, readers and circulation data. Owners can still sign in, view the library workspace shell and access billing to renew.
4. The owner chooses Weekly, Monthly or Yearly and selects **Continue to secure checkout**. Checkout uses the published default prices and remains unavailable until the server-side IntaSend configuration is complete.
5. When configured, the API creates an IntaSend hosted checkout and stores a pending record at `subscriptionPayments/{apiRef}`. The subscription is not activated from the redirect or frontend.
6. IntaSend sends a `collection_event` webhook to `/api/intasend-webhook`. The endpoint checks the configured challenge, then verifies the invoice with IntaSend's server-side payment-status API. It also matches the invoice reference, exact amount in cents and currency to the stored pending payment.
7. Only a verified `COMPLETE` payment can mark that payment as paid and set the subscription to active. Duplicate webhook delivery is handled idempotently. Failed, partial, pending or mismatched payments never activate access.
8. The subscription stores billing cycle, paid amount, currency, provider reference and current period start/end. Expiry enforcement is time-based in the trusted API and Firestore rules; no Firebase scheduled function is required.

## IntaSend environment variables (Vercel server-side only)

Configure these in Vercel → Project → Settings → Environment Variables. Use test credentials for Preview until the complete workflow has been tested.

- `FIREBASE_PROJECT_ID`: `mctaba-85685`
- `FIREBASE_SERVICE_ACCOUNT_JSON`: full Firebase service-account JSON for project `mctaba-85685`
- `INTASEND_PUBLISHABLE_KEY`: IntaSend publishable key (test key for Preview; live key only when approved)
- `INTASEND_SECRET_KEY`: IntaSend secret key, used only to verify invoice status on the server
- `INTASEND_WEBHOOK_CHALLENGE`: a long, random secret challenge configured to the same value in the IntaSend webhook dashboard
- `APP_BASE_URL`: canonical MCTaba site URL, e.g. `https://mctaba-five.vercel.app`
- `MCTABA_PRICE_WEEKLY_KES`: optional weekly price override; defaults to `1200`
- `MCTABA_PRICE_MONTHLY_KES`: optional monthly price override; defaults to `3500`
- `MCTABA_PRICE_YEARLY_KES`: optional yearly price override; defaults to `35000`

**Published default prices (KES):** Weekly KSh 1,200; Monthly KSh 3,500; Yearly KSh 35,000. The API defaults to these values so checkout and the pricing UI agree without extra configuration. Optional environment-variable overrides are supported; if used, update the visible plan prices at the same time so customers are never shown a different amount from the checkout amount. Keep secrets in Vercel environment variables only. Never prefix secrets with `VITE_`, put them in frontend code, commit them to GitHub, or paste them into chat. Firebase Admin bypasses Firestore Security Rules, so restrict access to the Vercel project and rotate any exposed key.

## Configure the IntaSend webhook

After deploying the API route and setting `INTASEND_WEBHOOK_CHALLENGE`:

1. Open IntaSend Dashboard → Settings → Webhooks.
2. Create a webhook endpoint: `https://mctaba-five.vercel.app/api/intasend-webhook` (use the actual deployed domain if it changes).
3. Set the challenge to the exact same secret value as `INTASEND_WEBHOOK_CHALLENGE`.
4. Subscribe to `collection_event`.
5. Start with IntaSend test keys and test pending, failed and completed payments. Confirm only a completed invoice with matching amount, currency and reference activates the subscription.

IntaSend's checkout redirect is not payment proof. The webhook challenge and server-side invoice-status lookup are required before fulfilment.

## Firestore rules and deployment safety

The rules allow each owner to read their own subscription and payment records, while client writes to these records are denied. They gate book inventory, copies, readers, loans and notifications on a valid active/trial period. Library creation, book creation and circulation mutations use authenticated Vercel APIs.

**Deploy order matters:** first deploy the latest `feature/subscriptions` branch to Vercel and configure the Firebase Admin service account. Smoke-test sign-in, library creation, and API access. Only then deploy the updated rules with `firebase deploy --only firestore:rules --project mctaba-85685`. The previous production deployment may still use older frontend logic, and a rules deployment before the API is ready can break book access.

Firebase Cloud Functions are deliberately not used because this project must remain on the Firebase Spark free plan. The IntaSend account may have its own transaction fees or account requirements; these are separate from Firebase billing.

## Current limitations / decisions

- Default prices are Weekly KSh 1,200, Monthly KSh 3,500 and Yearly KSh 35,000. Optional environment overrides must match the frontend display.
- IntaSend credentials and the webhook challenge must be entered securely in Vercel and IntaSend's dashboard by the project owner.
- Trial is limited to one per owner account and does not auto-renew.
- Paid subscriptions activate only after server-side verified payment. The code does not create recurring card mandates; renewals currently require the owner to initiate a new checkout.
- Use test keys and verify the deployed webhook before switching to live credentials.
