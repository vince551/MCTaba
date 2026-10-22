import { timingSafeEqual } from 'node:crypto';
import { db, FieldValue, Timestamp } from './_lib/admin.js';

const INTASEND_API = 'https://api.intasend.com/api/v1/';
const PERIOD_DAYS = { weekly: 7, monthly: 30, yearly: 365 };

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ''));
  const b = Buffer.from(String(right || ''));
  return a.length > 0 && a.length === b.length && timingSafeEqual(a, b);
}
function cents(value) {
  const n = Number(value);
  return Number.isFinite(n) ? Math.round(n * 100) : null;
}
function json(res, status, body) {
  return res.status(status).json(body);
}

export default async function handler(req, res) {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return json(res, 405, { error: 'Method not allowed.' });
  }
  const expectedChallenge = process.env.INTASEND_WEBHOOK_CHALLENGE;
  const secretKey = process.env.INTASEND_SECRET_KEY;
  if (!expectedChallenge || !secretKey) return json(res, 503, { error: 'Payment webhook is not configured.' });

  const event = req.body && typeof req.body === 'object' ? req.body : {};
  if (!safeEqual(event.challenge, expectedChallenge)) return json(res, 401, { error: 'Invalid webhook challenge.' });
  if (event.topic !== 'collection_event') return json(res, 200, { received: true, ignored: true });
  if (event.state !== 'COMPLETE') return json(res, 200, { received: true, ignored: true });

  const invoiceId = typeof event.invoice_id === 'string' ? event.invoice_id : '';
  const apiRef = typeof event.api_ref === 'string' ? event.api_ref : '';
  if (!invoiceId || !apiRef) return json(res, 400, { error: 'Missing invoice or payment reference.' });

  try {
    // Confirm the critical payment state directly with IntaSend rather than trusting the webhook body alone.
    const verifyResponse = await fetch(INTASEND_API + 'payment/status/', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + secretKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoice_id: invoiceId }),
    });
    const verifyBody = await verifyResponse.json().catch(() => ({}));
    const invoice = verifyBody.invoice || verifyBody;
    if (!verifyResponse.ok || invoice.state !== 'COMPLETE' || invoice.invoice_id !== invoiceId || invoice.api_ref !== apiRef) {
      return json(res, 400, { error: 'IntaSend could not verify this completed payment.' });
    }

    const database = db();
    const paymentRef = database.doc(`subscriptionPayments/${apiRef}`);
    const paymentSnapshot = await paymentRef.get();
    if (!paymentSnapshot.exists) return json(res, 404, { error: 'Payment reference was not found.' });
    const payment = paymentSnapshot.data();
    if (payment.provider !== 'intasend' || payment.apiRef !== apiRef) return json(res, 400, { error: 'Payment reference mismatch.' });
    if (invoice.currency !== payment.currency || cents(invoice.value) !== cents(payment.amount)) {
      return json(res, 400, { error: 'Verified payment amount or currency does not match the pending payment.' });
    }

    const subscriptionRef = database.doc(`subscriptions/${payment.libraryId}`);
    const now = Timestamp.now();
    const periodEnd = Timestamp.fromMillis(now.toMillis() + PERIOD_DAYS[payment.billingCycle] * 24 * 60 * 60 * 1000);
    await database.runTransaction(async (transaction) => {
      const freshPayment = await transaction.get(paymentRef);
      const freshSubscription = await transaction.get(subscriptionRef);
      const latestPayment = freshPayment.data();
      if (latestPayment.status === 'paid' && latestPayment.invoiceId === invoiceId) return;
      if (latestPayment.status !== 'pending') throw new Error('Payment is not pending.');
      if (latestPayment.libraryId !== payment.libraryId || latestPayment.ownerId !== payment.ownerId) throw new Error('Payment ownership mismatch.');
      transaction.set(paymentRef, {
        status: 'paid',
        invoiceId,
        providerReference: invoice.provider_ref || invoice.mpesa_reference || null,
        verifiedAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
      transaction.set(subscriptionRef, {
        libraryId: payment.libraryId,
        ownerId: payment.ownerId,
        status: 'active',
        paymentStatus: 'paid',
        provider: 'intasend',
        billingCycle: payment.billingCycle,
        amount: payment.amount,
        currency: payment.currency,
        lastPaymentRef: apiRef,
        lastInvoiceId: invoiceId,
        currentPeriodStart: now,
        currentPeriodEnd: periodEnd,
        updatedAt: FieldValue.serverTimestamp(),
      }, { merge: true });
    });
    return json(res, 200, { received: true, verified: true });
  } catch (error) {
    console.error('IntaSend webhook processing failed:', error?.message || error);
    return json(res, 500, { error: 'Payment verification could not be completed; retry delivery.' });
  }
}
