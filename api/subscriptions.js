import { randomUUID, timingSafeEqual } from 'node:crypto';
import { authenticate, db, FieldValue, Timestamp, respondError, text } from './_lib/admin.js';
import { allowMethods, bodyObject } from './_lib/http.js';

const BILLING_CYCLES = new Set(['weekly', 'monthly', 'yearly']);
const CYCLE_ENV = {
  weekly: 'MCTABA_PRICE_WEEKLY_KES',
  monthly: 'MCTABA_PRICE_MONTHLY_KES',
  yearly: 'MCTABA_PRICE_YEARLY_KES',
};
const PERIOD_DAYS = { weekly: 7, monthly: 30, yearly: 365 };
const INTASEND_API = 'https://api.intasend.com/api/v1/';

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length === b.length && timingSafeEqual(a, b);
}

function configuredPrice(cycle) {
  const raw = process.env[CYCLE_ENV[cycle]];
  if (!raw || !/^\d+(\.\d{1,2})?$/.test(raw) || Number(raw) <= 0) return null;
  return Number(raw);
}

async function ownerLibrary(database, libraryId, uid) {
  const libraryRef = database.doc(`libraries/${libraryId}`);
  const library = await libraryRef.get();
  if (!library.exists) { const error = new Error('Library not found.'); error.status = 404; throw error; }
  if (library.get('ownerId') !== uid) {
    const error = new Error('Only the library owner can manage billing.'); error.status = 403; throw error;
  }
  return { libraryRef, library };
}

async function startTrial(database, identity, libraryId, library) {
  const subscriptionRef = database.doc(`subscriptions/${libraryId}`);
  const userRef = database.doc(`users/${identity.uid}`);
  const now = Timestamp.now();
  const trialEnd = Timestamp.fromMillis(now.toMillis() + 14 * 24 * 60 * 60 * 1000);
  const result = await database.runTransaction(async (transaction) => {
    const [snapshot, userSnapshot] = await Promise.all([transaction.get(subscriptionRef), transaction.get(userRef)]);
    const previous = snapshot.exists ? snapshot.data() : {};
    if (previous.trialUsedAt || userSnapshot.get('trialUsedAt')) {
      const error = new Error('This library has already used its 14-day free trial.');
      error.status = 409;
      throw error;
    }
    if (previous.status === 'active' || previous.status === 'trialing') {
      const error = new Error('This library already has an active subscription or trial.');
      error.status = 409;
      throw error;
    }
    transaction.set(userRef, { trialUsedAt: now, updatedAt: FieldValue.serverTimestamp() }, { merge: true });
    transaction.set(subscriptionRef, {
      libraryId,
      ownerId: identity.uid,
      libraryName: library.get('name') || '',
      status: 'trialing',
      paymentStatus: 'not_required',
      provider: null,
      billingCycle: previous.billingCycle || 'monthly',
      trialStartedAt: now,
      trialUsedAt: now,
      trialEndsAt: trialEnd,
      currentPeriodStart: now,
      currentPeriodEnd: trialEnd,
      updatedAt: FieldValue.serverTimestamp(),
      ...(snapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    return { status: 'trialing', trialEndsAt: trialEnd.toDate().toISOString() };
  });
  return result;
}

async function createCheckout(database, identity, libraryId, library, billingCycle) {
  const price = configuredPrice(billingCycle);
  if (price === null) {
    const error = new Error(`Pricing for the ${billingCycle} plan has not been configured yet. No payment was started.`);
    error.status = 409;
    throw error;
  }
  const publishableKey = process.env.INTASEND_PUBLISHABLE_KEY;
  const challenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
  const baseUrl = process.env.APP_BASE_URL;
  if (!publishableKey || !challenge || !baseUrl) {
    const error = new Error('IntaSend is not fully configured. Ask the platform administrator to finish secure billing setup.');
    error.status = 503;
    throw error;
  }
  const subscriptionRef = database.doc(`subscriptions/${libraryId}`);
  const existing = await subscriptionRef.get();
  const previous = existing.exists ? existing.data() : {};
  if (previous.status === 'trialing' && previous.currentPeriodEnd?.toMillis?.() > Date.now()) {
    // A trial can be upgraded, but it is not extended by starting checkout.
  }
  const apiRef = `mctaba-${libraryId.slice(0, 36)}-${randomUUID()}`;
  const redirectUrl = new URL('/?billing=return', baseUrl).toString();
  const payload = {
    amount: price,
    currency: 'KES',
    email: identity.email || undefined,
    api_ref: apiRef,
    unique_api_ref: true,
    redirect_url: redirectUrl,
    host: baseUrl,
  };
  const response = await fetch(INTASEND_API + 'checkout/', {
    method: 'POST',
    headers: { 'X-IntaSend-Public-API-Key': publishableKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
  const providerResult = await response.json().catch(() => ({}));
  if (!response.ok || !providerResult.url || !providerResult.id) {
    console.error('IntaSend checkout creation failed:', response.status);
    const error = new Error('IntaSend could not start checkout. No subscription was activated.');
    error.status = 502;
    throw error;
  }
  const paymentRef = database.doc(`subscriptionPayments/${apiRef}`);
  const now = FieldValue.serverTimestamp();
  await database.runTransaction(async (transaction) => {
    transaction.set(paymentRef, {
      apiRef,
      provider: 'intasend',
      providerCheckoutId: providerResult.id,
      libraryId,
      ownerId: identity.uid,
      billingCycle,
      amount: price,
      currency: 'KES',
      status: 'pending',
      createdAt: now,
      updatedAt: now,
    });
    transaction.set(subscriptionRef, {
      libraryId,
      ownerId: identity.uid,
      libraryName: library.get('name') || '',
      requestedBillingCycle: billingCycle,
      paymentStatus: 'pending',
      pendingPaymentRef: apiRef,
      provider: 'intasend',
      updatedAt: now,
      ...(existing.exists ? {} : { status: 'awaiting_payment', createdAt: now }),
    }, { merge: true });
  });
  return { checkoutUrl: providerResult.url, apiRef, message: 'Checkout created. The subscription stays inactive until IntaSend confirms payment.' };
}

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const input = bodyObject(req.body);
    if (input.action === 'intasendWebhook') {
      const expectedChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
      if (!expectedChallenge) return res.status(503).json({ error: 'Payment webhook is not configured.' });
      if (!safeEqual(input.challenge, expectedChallenge)) return res.status(401).json({ error: 'Invalid webhook challenge.' });
      return res.status(400).json({ error: 'Use the dedicated IntaSend webhook endpoint.' });
    }

    const identity = await authenticate(req);
    const libraryId = text(input.libraryId, 'Library ID', 140);
    const database = db();
    const { library } = await ownerLibrary(database, libraryId, identity.uid);

    if (input.action === 'startTrial') {
      const result = await startTrial(database, identity, libraryId, library);
      return res.status(200).json({ ...result, message: 'Your 14-day free trial has started. It will not renew automatically.' });
    }

    const billingCycle = text(input.billingCycle, 'Billing cycle', 20).toLowerCase();
    if (!BILLING_CYCLES.has(billingCycle)) {
      const error = new Error('Choose weekly, monthly or yearly billing.');
      error.status = 400;
      throw error;
    }

    if (input.action === 'createCheckout') {
      const result = await createCheckout(database, identity, libraryId, library, billingCycle);
      return res.status(200).json(result);
    }

    if (input.action !== 'selectCycle') {
      const error = new Error('Unsupported subscription action.');
      error.status = 400;
      throw error;
    }

    const subscriptionRef = database.doc(`subscriptions/${libraryId}`);
    const existing = await subscriptionRef.get();
    const previous = existing.exists ? existing.data() : null;
    const now = FieldValue.serverTimestamp();
    const record = previous?.status === 'active' || previous?.status === 'trialing'
      ? {
          libraryId,
          ownerId: identity.uid,
          libraryName: library.get('name') || '',
          requestedBillingCycle: billingCycle,
          billingChangeStatus: 'awaiting_payment',
          updatedAt: now,
        }
      : {
          libraryId,
          ownerId: identity.uid,
          libraryName: library.get('name') || '',
          billingCycle,
          status: previous?.status || 'awaiting_payment_setup',
          paymentStatus: previous?.paymentStatus || 'not_started',
          amount: null,
          currency: 'KES',
          provider: previous?.provider || null,
          updatedAt: now,
          ...(existing.exists ? {} : { createdAt: now }),
        };
    await subscriptionRef.set(record, { merge: true });
    return res.status(200).json({
      libraryId, billingCycle,
      status: previous?.status || 'awaiting_payment_setup',
      message: 'Billing cycle saved. This selection does not start a payment or activate paid access.',
    });
  } catch (error) {
    return respondError(res, error);
  }
}
