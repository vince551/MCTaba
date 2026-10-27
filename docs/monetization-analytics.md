# Mctaba monetization and analytics

## Implemented on this branch
- The existing Vercel API subscription workflow provisions a one-time 14-day trial and retains the existing IntaSend checkout/webhook verification path.
- The trusted `POST /api/analytics` Vercel API returns real circulation metrics from Firestore and checks the caller's active library membership, role, and subscription.
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
1. Run `npm install` and `npm run build` at the repository root.
2. Configure the existing Vercel server-side environment variables using `docs/SUBSCRIPTIONS.md`; never put service-account or IntaSend secrets in Vite variables.
3. Deploy the feature branch to a Vercel Preview and confirm `/api/analytics` is available.
4. Create a test library and verify the existing Vercel API provisions exactly one 14-day trial and the client cannot write billing state.
5. Open Reports as an active librarian and compare live metrics against known test books/loans.
6. Test expired-trial access and the existing IntaSend webhook with test credentials before launch. Deploy Firestore rules only after reviewing the current branch's rollout instructions.
