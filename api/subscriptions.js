import { authenticate, db, FieldValue, respondError, text } from './_lib/admin.js';
import { allowMethods, bodyObject } from './_lib/http.js';

const BILLING_CYCLES = new Set(['weekly', 'monthly', 'yearly']);

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const identity = await authenticate(req);
    const input = bodyObject(req.body);
    const libraryId = text(input.libraryId, 'Library ID', 140);
    const billingCycle = text(input.billingCycle, 'Billing cycle', 20).toLowerCase();
    if (!BILLING_CYCLES.has(billingCycle)) {
      const error = new Error('Choose weekly, monthly or yearly billing.');
      error.status = 400;
      throw error;
    }
    const database = db();
    const libraryRef = database.doc(`libraries/${libraryId}`);
    const library = await libraryRef.get();
    if (!library.exists) { const error = new Error('Library not found.'); error.status = 404; throw error; }
    if (library.get('ownerId') !== identity.uid) {
      const error = new Error('Only the library owner can change subscription billing.'); error.status = 403; throw error;
    }
    const subscriptionRef = database.doc(`subscriptions/${libraryId}`);
    const existing = await subscriptionRef.get();
    const previousStatus = existing.exists ? existing.get('status') : null;
    const now = FieldValue.serverTimestamp();
    const record = {
      libraryId,
      ownerId: identity.uid,
      libraryName: library.get('name') || '',
      billingCycle,
      status: 'awaiting_payment_setup',
      paymentStatus: 'not_started',
      amount: null,
      currency: 'KES',
      provider: null,
      updatedAt: now,
      ...(existing.exists ? {} : { createdAt: now }),
      ...(previousStatus === 'active' ? { previousActivePeriodPreserved: true } : {}),
    };
    await subscriptionRef.set(record, { merge: true });
    await libraryRef.update({ updatedAt: now });
    return res.status(200).json({
      libraryId, billingCycle, status: 'awaiting_payment_setup',
      message: 'Billing cycle saved. Payment activation is disabled until a verified payment provider is configured.',
    });
  } catch (error) {
    return respondError(res, error);
  }
}
