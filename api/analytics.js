import { authenticate, db, requireLibraryRole, requireSubscriptionAccess, respondError, text } from './_lib/admin.js';
import { allowMethods, bodyObject } from './_lib/http.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const identity = await authenticate(req);
    const input = bodyObject(req.body);
    if (input.action !== 'getLibraryAnalytics') {
      const error = new Error('Unsupported analytics action.');
      error.status = 400;
      throw error;
    }
    const libraryId = text(input.libraryId, 'Library ID', 140);
    const database = db();
    await requireLibraryRole(database, libraryId, identity.uid, ['owner', 'admin', 'librarian']);
    await requireSubscriptionAccess(database, libraryId);

    const [booksSnapshot, loansSnapshot, subscriptionSnapshot] = await Promise.all([
      database.collection(`libraries/${libraryId}/books`).get(),
      database.collection(`libraries/${libraryId}/loans`).get(),
      database.doc(`subscriptions/${libraryId}`).get(),
    ]);
    const books = booksSnapshot.docs.map((item) => item.data());
    const loans = loansSnapshot.docs.map((item) => item.data());
    const totalTitles = books.length;
    const totalCopies = books.reduce((sum, book) => sum + Math.max(0, Number(book.copies) || 0), 0);
    const availableCopies = books.reduce((sum, book) => sum + Math.max(0, Number(book.available) || 0), 0);
    const borrowedCopies = Math.max(0, totalCopies - Math.min(totalCopies, availableCopies));
    const activeLoans = loans.filter((loan) => loan.status === 'active');
    const overdueLoans = activeLoans.filter((loan) => {
      const dueAt = loan.dueAt?.toDate ? loan.dueAt.toDate() : new Date(loan.dueAt);
      return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now();
    }).length;
    const percentage = (numerator, denominator) => denominator > 0
      ? Math.round((numerator / denominator) * 10000) / 100
      : 0;

    return res.status(200).json({
      totalTitles,
      totalCopies,
      availableCopies: Math.min(totalCopies, availableCopies),
      borrowedCopies,
      activeLoans: activeLoans.length,
      overdueLoans,
      borrowingRatePercent: percentage(borrowedCopies, totalCopies),
      overdueRatePercent: percentage(overdueLoans, activeLoans.length),
      subscription: subscriptionSnapshot.exists ? {
        planId: subscriptionSnapshot.get('planId') || subscriptionSnapshot.get('billingCycle') || 'unknown',
        status: subscriptionSnapshot.get('status') || 'unknown',
        currentPeriodEnd: subscriptionSnapshot.get('currentPeriodEnd')?.toDate?.().toISOString() || null,
      } : null,
      calculatedAt: new Date().toISOString(),
    });
  } catch (error) {
    return respondError(res, error);
  }
}
