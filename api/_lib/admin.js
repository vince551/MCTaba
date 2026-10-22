import { cert, getApps, initializeApp } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { FieldValue, Timestamp, getFirestore } from 'firebase-admin/firestore';

let app;
export function adminApp() {
  if (app) return app;
  if (getApps().length) {
    app = getApps()[0];
    return app;
  }
  const raw = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
  if (!raw) throw new Error('Server billing configuration is missing FIREBASE_SERVICE_ACCOUNT_JSON.');
  let serviceAccount;
  try {
    serviceAccount = JSON.parse(raw);
  } catch {
    throw new Error('FIREBASE_SERVICE_ACCOUNT_JSON must contain valid service-account JSON.');
  }
  if (!serviceAccount.project_id || !serviceAccount.client_email || !serviceAccount.private_key) {
    throw new Error('Firebase service-account JSON is missing required fields.');
  }
  serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
  app = initializeApp({
    credential: cert(serviceAccount),
    projectId: process.env.FIREBASE_PROJECT_ID || serviceAccount.project_id,
  });
  return app;
}

export function db() {
  adminApp();
  return getFirestore();
}

export async function authenticate(req) {
  const header = req.headers.authorization || '';
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match) {
    const error = new Error('Sign in to continue.');
    error.status = 401;
    throw error;
  }
  try {
    return await getAuth(adminApp()).verifyIdToken(match[1]);
  } catch {
    const error = new Error('Your session is invalid or has expired. Sign in again.');
    error.status = 401;
    throw error;
  }
}

export function text(value, field, max = 120) {
  if (typeof value !== 'string') {
    const error = new Error(field + ' is required.');
    error.status = 400;
    throw error;
  }
  const result = value.trim();
  if (!result || result.length > max) {
    const error = new Error(field + ' must be between 1 and ' + max + ' characters.');
    error.status = 400;
    throw error;
  }
  return result;
}

export async function requireSubscriptionAccess(database, libraryId) {
  const snapshot = await database.doc(`subscriptions/${libraryId}`).get();
  if (!snapshot.exists) {
    const error = new Error('Start the 14-day free trial or activate a paid plan to use library tools.');
    error.status = 402;
    throw error;
  }
  const subscription = snapshot.data();
  const end = subscription.currentPeriodEnd?.toMillis?.();
  if (!['active', 'trialing'].includes(subscription.status) || !end || end <= Date.now()) {
    const error = new Error('This library subscription has expired. The owner can open Subscription & billing to renew or review billing.');
    error.status = 402;
    throw error;
  }
}

export async function requireLibraryRole(database, libraryId, uid, roles) {
  const membership = await database.doc(`libraries/${libraryId}/memberships/${uid}`).get();
  if (!membership.exists || membership.get('status') !== 'active') {
    const error = new Error('You do not have access to this library.');
    error.status = 403;
    throw error;
  }
  if (!roles.includes(membership.get('role'))) {
    const error = new Error('Your library role cannot perform this action.');
    error.status = 403;
    throw error;
  }
  return membership.data();
}

export function respondError(res, error) {
  const status = Number.isInteger(error?.status) ? error.status : 500;
  if (status === 500) console.error('MCTaba API error:', error?.message || error);
  return res.status(status).json({
    error: status === 500 ? 'The server could not complete this request.' : error.message,
  });
}

export { FieldValue, Timestamp };
