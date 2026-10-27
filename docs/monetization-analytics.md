# Mctaba monetization and analytics

## Implemented on this branch
- Creating a library now creates a server-managed 14-day trial subscription at `subscriptions/{libraryId}`.
- The subscription record starts as `trialing`, `planId: trial`, `amountMinor: 0`, and expires 14 days after creation.
- Firestore rules already deny browser writes to subscription records and require an unexpired `active` or `trialing` subscription for core catalogue/circulation reads.
- Callable `getLibraryAnalytics` returns metrics computed from that library's real books and loans. It verifies authentication, membership, and role before reading data.
- `src/lib/saas-math.js` contains reusable pure calculations for discounts, revenue, profit, and library circulation.

## Formulas
- Borrowing rate (%) = (total copies - available copies) / total copies × 100.
- Overdue rate (%) = overdue active loans / active loans × 100.
- Monthly revenue = paying libraries × monthly price.
- Annualized revenue = monthly revenue × 12; this is a run-rate estimate, not guaranteed collected revenue.
- Profit = revenue - operating costs.

## Payment integration release gate
No payment is marked as paid by browser code. Before charging customers, configure a server-side IntaSend integration using secret-managed credentials, validate provider webhook signatures and payment status against the provider, make webhook processing idempotent, and update `subscriptions/{libraryId}` only from trusted server code. Do not invent live plan prices: set and approve the KES price catalog before opening checkout.

## Deploy and verify
1. From the repository, run `npm install` at the root and `npm install` in `functions/`.
2. Run `npm run build` at the root and `npm run lint` in `functions/`.
3. Configure Firebase project aliases and environment variables outside source control.
4. Deploy rules and functions with `firebase deploy --only firestore:rules,functions`.
5. Create a test library and verify the trial record exists, its end date is 14 days ahead, and the client cannot write billing state.
6. Call `getLibraryAnalytics` as an active librarian and verify the metrics against known test books/loans.
7. Test expired-trial access and payment webhook handling in a non-production Firebase project before launch.
