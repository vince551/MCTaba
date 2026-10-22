import { authenticate, db, FieldValue, Timestamp, requireSubscriptionAccess, requireLibraryRole, respondError, text } from './_lib/admin.js';
import { allowMethods, bodyObject } from './_lib/http.js';

const LIBRARY_TYPES = new Set(['school', 'university', 'public', 'community', 'church', 'private', 'other']);

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const identity = await authenticate(req);
    const input = bodyObject(req.body);
    const action = text(input.action, 'Action', 40);
    const database = db();
    const uid = identity.uid;

    if (action === 'createLibrary') {
      const name = text(input.name, 'Library name');
      const type = text(input.type || 'other', 'Library type', 30).toLowerCase();
      if (!LIBRARY_TYPES.has(type)) {
        const error = new Error('Choose a supported library type.');
        error.status = 400;
        throw error;
      }
      const location = typeof input.location === 'string' ? input.location.trim().slice(0, 160) : '';
      const libraryRef = database.collection('libraries').doc();
      const membershipRef = libraryRef.collection('memberships').doc(uid);
      const userRef = database.doc(`users/${uid}`);
      const auditRef = libraryRef.collection('auditLogs').doc();
      const subscriptionRef = database.doc(`subscriptions/${libraryRef.id}`);
      const trialNow = Timestamp.now();
      const trialEnd = Timestamp.fromMillis(trialNow.toMillis() + 14 * 24 * 60 * 60 * 1000);
      await database.runTransaction(async (tx) => {
        const userSnapshot = await tx.get(userRef);
        tx.create(libraryRef, {
          name, type, location, ownerId: uid, status: 'active',
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
        });
        tx.create(membershipRef, {
          userId: uid, role: 'owner', permissions: ['*'], status: 'active',
          joinedAt: FieldValue.serverTimestamp(),
        });
        const trialAvailable = !userSnapshot.get('trialUsedAt');
        tx.set(userRef, {
          ...(trialAvailable ? { trialUsedAt: trialNow } : {}),
          displayName: typeof identity.name === 'string' ? identity.name.slice(0, 120) : '',
          email: typeof identity.email === 'string' ? identity.email : '',
          updatedAt: FieldValue.serverTimestamp(),
          libraryIds: FieldValue.arrayUnion(libraryRef.id),
          ...(userSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
        }, { merge: true });
        tx.create(auditRef, {
          actorId: uid, action: 'library.created', targetId: libraryRef.id,
          createdAt: FieldValue.serverTimestamp(),
        });
        tx.create(subscriptionRef, {
          libraryId: libraryRef.id, ownerId: uid, libraryName: name,
          status: trialAvailable ? 'trialing' : 'awaiting_payment_setup',
          paymentStatus: trialAvailable ? 'not_required' : 'not_started',
          provider: null, billingCycle: 'monthly', currency: 'KES', amount: null,
          ...(trialAvailable ? { trialStartedAt: trialNow, trialUsedAt: trialNow, currentPeriodStart: trialNow, trialEndsAt: trialEnd, currentPeriodEnd: trialEnd } : {}),
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      });
      return res.status(201).json({ libraryId: libraryRef.id, name });
    }

    if (action === 'createBook') {
      const libraryId = text(input.libraryId, 'Library ID', 140);
      const title = text(input.title, 'Book title');
      const author = text(input.author, 'Author');
      const category = text(input.category || 'General', 'Category', 80);
      const isbn = typeof input.isbn === 'string' ? input.isbn.trim().slice(0, 32) : '';
      const copies = Number(input.copies);
      if (!Number.isInteger(copies) || copies < 1 || copies > 300) {
        const error = new Error('Add between 1 and 300 copies per title.');
        error.status = 400;
        throw error;
      }
      await requireLibraryRole(database, libraryId, uid, ['owner', 'admin', 'librarian']);
      await requireSubscriptionAccess(database, libraryId);
      const libraryRef = database.doc(`libraries/${libraryId}`);
      const bookRef = libraryRef.collection('books').doc();
      const auditRef = libraryRef.collection('auditLogs').doc();
      const batch = database.batch();
      batch.create(bookRef, {
        title, author, category, isbn, copies, available: copies, status: 'Available',
        createdBy: uid, createdAt: FieldValue.serverTimestamp(),
        updatedAt: FieldValue.serverTimestamp(), schemaVersion: 1,
      });
      for (let index = 1; index <= copies; index += 1) {
        const copyRef = libraryRef.collection('copies').doc();
        batch.create(copyRef, {
          bookId: bookRef.id, copyNumber: index, status: 'available',
          createdAt: FieldValue.serverTimestamp(), updatedAt: FieldValue.serverTimestamp(),
        });
      }
      batch.create(auditRef, {
        actorId: uid, action: 'book.created', targetId: bookRef.id,
        metadata: { copies }, createdAt: FieldValue.serverTimestamp(),
      });
      await batch.commit();
      return res.status(201).json({ bookId: bookRef.id, copies });
    }

    return res.status(400).json({ error: 'Unsupported library action.' });
  } catch (error) {
    return respondError(res, error);
  }
}
