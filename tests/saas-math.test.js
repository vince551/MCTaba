import test from "node:test";
import assert from "node:assert/strict";
import { annualSubscriptionPrice, libraryCirculationMetrics, percentage, revenueSummary } from "../src/lib/saas-math.js";

test("percentage safely handles empty denominators", () => {
  assert.equal(percentage(1, 0), 0);
  assert.equal(percentage(25, 100), 25);
});

test("annual subscription discount is calculated correctly", () => {
  assert.equal(annualSubscriptionPrice(500, 15), 5100);
  assert.throws(() => annualSubscriptionPrice(500, 101), RangeError);
});

test("revenue and profit summary uses arithmetic, not estimates", () => {
  assert.deepEqual(revenueSummary(30, 500, 4000), {
    monthlyRevenueKes: 15000,
    annualizedRevenueKes: 180000,
    monthlyCostsKes: 4000,
    monthlyProfitKes: 11000,
    profitMarginPercent: 73.33,
  });
});

test("circulation metrics avoid division by zero", () => {
  assert.deepEqual(libraryCirculationMetrics({
    totalCopies: 100,
    availableCopies: 75,
    activeLoans: 20,
    overdueLoans: 5,
  }), { borrowedCopies: 25, borrowingRatePercent: 25, overdueRatePercent: 25 });
  assert.equal(libraryCirculationMetrics({}).borrowingRatePercent, 0);
});
