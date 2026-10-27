/**
 * Pure, testable calculations for Mctaba. Currency values are integer KES
 * unless the caller explicitly supplies another unit.
 */
export function percentage(numerator, denominator) {
  const n = Number(numerator);
  const d = Number(denominator);
  if (!Number.isFinite(n) || !Number.isFinite(d) || n < 0 || d <= 0) return 0;
  return Math.round((n / d) * 10000) / 100;
}

export function annualSubscriptionPrice(monthlyPrice, discountPercent = 0) {
  const price = Number(monthlyPrice);
  const discount = Number(discountPercent);
  if (!Number.isFinite(price) || price < 0) throw new RangeError("Monthly price must be non-negative.");
  if (!Number.isFinite(discount) || discount < 0 || discount > 100) {
    throw new RangeError("Discount must be between 0 and 100 percent.");
  }
  return Math.round(price * 12 * (1 - discount / 100));
}

export function revenueSummary(payingLibraries, monthlyPrice, monthlyCosts = 0) {
  const customers = Number(payingLibraries);
  const price = Number(monthlyPrice);
  const costs = Number(monthlyCosts);
  if (![customers, price, costs].every(Number.isFinite) || customers < 0 || price < 0 || costs < 0) {
    throw new RangeError("Customers, price and costs must be non-negative numbers.");
  }
  const revenue = Math.round(customers * price);
  const profit = revenue - Math.round(costs);
  return {
    monthlyRevenueKes: revenue,
    annualizedRevenueKes: revenue * 12,
    monthlyCostsKes: Math.round(costs),
    monthlyProfitKes: profit,
    profitMarginPercent: revenue > 0 ? percentage(Math.max(0, profit), revenue) : 0,
  };
}

export function libraryCirculationMetrics({ totalCopies = 0, availableCopies = 0, activeLoans = 0, overdueLoans = 0 }) {
  const total = Math.max(0, Number(totalCopies) || 0);
  const available = Math.min(total, Math.max(0, Number(availableCopies) || 0));
  const active = Math.max(0, Number(activeLoans) || 0);
  const overdue = Math.min(active, Math.max(0, Number(overdueLoans) || 0));
  return {
    borrowedCopies: total - available,
    borrowingRatePercent: percentage(total - available, total),
    overdueRatePercent: percentage(overdue, active),
  };
}
