# Mctaba monetization and analytics

## Implemented on this branch
- The existing Vercel API subscription workflow provisions a one-time 14-day trial and retains the existing IntaSend checkout/webhook verification path.
- The trusted `getLibraryAnalytics` callable returns real circulation metrics from Firestore and checks the caller's active library membership and role.
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
The repository already includes a server-side IntaSend checkout route and `/api/intasend-webhook` that verifies completed invoices against IntaSend before activating a subscription. Before charging real customers, configure the documented secrets in Vercel, test pending/failed/completed and duplicate webhook events with IntaSend test credentials, confirm the published prices and environment overrides match, and review the provider API behavior. Never activate payment from a browser redirect.

## Deploy and verify
1. From the repository, run `npm install` at the root and `npm install` in `functions/`.
2. Run `npm run build` at the root and `npm run lint` in `functions/`.
3. Configure Firebase project aliases and environment variables outside source control.
4. Deploy rules and functions with `firebase deploy --only firestore:rules,functions`.
5. Create a test library and verify the existing Vercel API provisions exactly one 14-day trial and the client cannot write billing state.
6. Call `getLibraryAnalytics` as an active librarian and verify the metrics against known test books/loans.
7. Test expired-trial access and the existing IntaSend webhook with test credentials before launch.
