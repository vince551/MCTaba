const { initializeApp } = require('firebase-admin/app');
const { getFirestore, FieldValue, Timestamp } = require('firebase-admin/firestore');
const { onCall, HttpsError } = require('firebase-functions/v2/https');

initializeApp();
const db = getFirestore();

const LIBRARY_TYPES = new Set([
  'school', 'university', 'public', 'community', 'church', 'private', 'other',
]);
const STAFF_ROLES = new Set(['owner', 'admin', 'librarian']);

function requireAuth(request) {
  if (!request.auth) {
    throw new HttpsError('unauthenticated', 'Sign in to continue.');
  }
  return request.auth.uid;
}

function cleanString(value, field, max = 120) {
  if (typeof value !== 'string') {
    throw new HttpsError('invalid-argument', `${field} is required.`);
  }
  const result = value.trim();
  if (!result || result.length > max) {
    throw new HttpsError('invalid-argument', `${field} must be between 1 and ${max} characters.`);
  }
  return result;
}

async function requireLibraryRole(libraryId, uid, roles) {
  const membershipRef = db.doc(`libraries/${libraryId}/memberships/${uid}`);
  const membership = await membershipRef.get();
  if (!membership.exists || membership.get('status') !== 'active') {
    throw new HttpsError('permission-denied', 'You do not have access to this library.');
  }
  if (!roles.includes(membership.get('role'))) {
    throw new HttpsError('permission-denied', 'Your library role cannot perform this action.');
  }
  return membership.data();
}

/**
 * Creates a tenant and its initial owner membership atomically.
 * Clients cannot directly create library or membership documents.
 */
exports.createLibrary = onCall(async (request) => {
  const uid = requireAuth(request);
  const name = cleanString(request.data?.name, 'Library name');
  const type = cleanString(request.data?.type || 'other', 'Library type', 30).toLowerCase();
  if (!LIBRARY_TYPES.has(type)) {
    throw new HttpsError('invalid-argument', 'Choose a supported library type.');
  }
  const location = typeof request.data?.location === 'string'
    ? request.data.location.trim().slice(0, 160)
    : '';
  const libraryRef = db.collection('libraries').doc();
  const membershipRef = libraryRef.collection('memberships').doc(uid);
  const userRef = db.doc(`users/${uid}`);
  const auditRef = libraryRef.collection('auditLogs').doc();

  await db.runTransaction(async (transaction) => {
    const userSnapshot = await transaction.get(userRef);
    transaction.create(libraryRef, {
      name,
      type,
      location,
      ownerId: uid,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
      schemaVersion: 1,
    });
    transaction.create(membershipRef, {
      userId: uid,
      role: 'owner',
      permissions: ['*'],
      status: 'active',
      joinedAt: FieldValue.serverTimestamp(),
    });
    transaction.set(userRef, {
      displayName: typeof request.auth.token.name === 'string'
        ? request.auth.token.name.slice(0, 120)
        : '',
      email: typeof request.auth.token.email === 'string'
        ? request.auth.token.email
        : '',
      updatedAt: FieldValue.serverTimestamp(),
      libraryIds: FieldValue.arrayUnion(libraryRef.id),
      ...(userSnapshot.exists ? {} : { createdAt: FieldValue.serverTimestamp() }),
    }, { merge: true });
    transaction.create(auditRef, {
      actorId: uid,
      action: 'library.created',
      targetId: libraryRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { libraryId: libraryRef.id, name };
});


/**
 * Creates a catalogue title and its physical copy records as one trusted batch.
 * Copy writes are intentionally blocked from browser clients.
 */
exports.createBook = onCall(async (request) => {
  const uid = requireAuth(request);
  const libraryId = cleanString(request.data?.libraryId, 'Library ID', 140);
  const title = cleanString(request.data?.title, 'Book title');
  const author = cleanString(request.data?.author, 'Author');
  const category = cleanString(request.data?.category || 'General', 'Category', 80);
  const isbn = typeof request.data?.isbn === 'string' ? request.data.isbn.trim().slice(0, 32) : '';
  const copies = Number(request.data?.copies);
  if (!Number.isInteger(copies) || copies < 1 || copies > 300) {
    throw new HttpsError('invalid-argument', 'Add between 1 and 300 copies per title.');
  }

  await requireLibraryRole(libraryId, uid, ['owner', 'admin', 'librarian']);
  const libraryRef = db.doc(`libraries/${libraryId}`);
  const bookRef = libraryRef.collection('books').doc();
  const auditRef = libraryRef.collection('auditLogs').doc();
  const batch = db.batch();
  batch.create(bookRef, {
    title,
    author,
    category,
    isbn,
    copies,
    available: copies,
    status: 'Available',
    createdBy: uid,
    createdAt: FieldValue.serverTimestamp(),
    updatedAt: FieldValue.serverTimestamp(),
    schemaVersion: 1,
  });

  for (let index = 1; index <= copies; index += 1) {
    const copyRef = libraryRef.collection('copies').doc();
    batch.create(copyRef, {
      bookId: bookRef.id,
      copyNumber: index,
      status: 'available',
      createdAt: FieldValue.serverTimestamp(),
      updatedAt: FieldValue.serverTimestamp(),
    });
  }

  batch.create(auditRef, {
    actorId: uid,
    action: 'book.created',
    targetId: bookRef.id,
    metadata: { copies },
    createdAt: FieldValue.serverTimestamp(),
  });
  await batch.commit();
  return { bookId: bookRef.id, copies };
});

/**
 * Checks out one physical copy. Transactional validation prevents two readers
 * from borrowing the same copy at the same time.
 */
exports.checkoutBook = onCall(async (request) => {
  const uid = requireAuth(request);
  const libraryId = cleanString(request.data?.libraryId, 'Library ID', 140);
  const copyId = cleanString(request.data?.copyId, 'Copy ID', 140);
  const readerId = cleanString(request.data?.readerId, 'Reader ID', 140);
  const dueDateInput = request.data?.dueAt;
  const dueDate = typeof dueDateInput === 'string' ? new Date(dueDateInput) : null;
  if (!dueDate || Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
    throw new HttpsError('invalid-argument', 'A valid future due date is required.');
  }

  await requireLibraryRole(libraryId, uid, ['owner', 'admin', 'librarian']);
  const copyRef = db.doc(`libraries/${libraryId}/copies/${copyId}`);
  const readerRef = db.doc(`libraries/${libraryId}/readers/${readerId}`);
  const loanRef = db.collection(`libraries/${libraryId}/loans`).doc();
  const auditRef = db.collection(`libraries/${libraryId}/auditLogs`).doc();

  await db.runTransaction(async (transaction) => {
    const [copySnapshot, readerSnapshot] = await Promise.all([
      transaction.get(copyRef),
      transaction.get(readerRef),
    ]);
    if (!copySnapshot.exists) throw new HttpsError('not-found', 'Book copy not found.');
    if (!readerSnapshot.exists || readerSnapshot.get('status') !== 'active') {
      throw new HttpsError('failed-precondition', 'The reader is missing or inactive.');
    }
    if (copySnapshot.get('status') !== 'available') {
      throw new HttpsError('failed-precondition', 'This copy is not available for checkout.');
    }

    const bookId = copySnapshot.get('bookId');
    if (typeof bookId !== 'string' || !bookId) {
      throw new HttpsError('failed-precondition', 'This copy has no valid book reference.');
    }
    const bookRef = db.doc(`libraries/${libraryId}/books/${bookId}`);
    const bookSnapshot = await transaction.get(bookRef);
    if (!bookSnapshot.exists) {
      throw new HttpsError('failed-precondition', 'The catalogue record for this copy no longer exists.');
    }
    const availableCount = Number(bookSnapshot.get('available'));
    if (!Number.isInteger(availableCount) || availableCount < 1) {
      throw new HttpsError('failed-precondition', 'The catalogue shows no available copies. Refresh the inventory and try again.');
    }

    transaction.update(copyRef, {
      status: 'borrowed',
      currentReaderId: readerId,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(bookRef, {
      available: availableCount - 1,
      status: availableCount - 1 === 0 ? 'All borrowed' : availableCount - 1 <= 2 ? 'Low stock' : 'Available',
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(loanRef, {
      copyId,
      bookId: copySnapshot.get('bookId'),
      readerId,
      checkedOutBy: uid,
      checkedOutAt: FieldValue.serverTimestamp(),
      dueAt: Timestamp.fromDate(dueDate),
      returnedAt: null,
      status: 'active',
      createdAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      actorId: uid,
      action: 'loan.checked_out',
      targetId: loanRef.id,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { loanId: loanRef.id, status: 'active' };
});

/** Returns an active loan and releases its physical copy atomically. */
exports.returnBook = onCall(async (request) => {
  const uid = requireAuth(request);
  const libraryId = cleanString(request.data?.libraryId, 'Library ID', 140);
  const loanId = cleanString(request.data?.loanId, 'Loan ID', 140);
  await requireLibraryRole(libraryId, uid, ['owner', 'admin', 'librarian']);

  const loanRef = db.doc(`libraries/${libraryId}/loans/${loanId}`);
  const auditRef = db.collection(`libraries/${libraryId}/auditLogs`).doc();

  await db.runTransaction(async (transaction) => {
    const loanSnapshot = await transaction.get(loanRef);
    if (!loanSnapshot.exists) throw new HttpsError('not-found', 'Loan not found.');
    if (loanSnapshot.get('status') !== 'active') {
      throw new HttpsError('failed-precondition', 'This loan has already been returned or closed.');
    }

    const copyId = loanSnapshot.get('copyId');
    if (typeof copyId !== 'string' || !copyId) {
      throw new HttpsError('failed-precondition', 'This loan has no valid copy reference.');
    }
    const copyRef = db.doc(`libraries/${libraryId}/copies/${copyId}`);
    const copySnapshot = await transaction.get(copyRef);
    if (!copySnapshot.exists) throw new HttpsError('failed-precondition', 'The linked book copy no longer exists.');
    if (copySnapshot.get('status') !== 'borrowed' || copySnapshot.get('currentReaderId') !== loanSnapshot.get('readerId')) {
      throw new HttpsError('failed-precondition', 'The copy status does not match this loan. Review the circulation records before returning it.');
    }

    const bookId = loanSnapshot.get('bookId') || copySnapshot.get('bookId');
    if (typeof bookId !== 'string' || !bookId) {
      throw new HttpsError('failed-precondition', 'This loan has no valid book reference.');
    }
    const bookRef = db.doc(`libraries/${libraryId}/books/${bookId}`);
    const bookSnapshot = await transaction.get(bookRef);
    if (!bookSnapshot.exists) throw new HttpsError('failed-precondition', 'The catalogue record for this book no longer exists.');
    const totalCopies = Number(bookSnapshot.get('copies')) || 0;
    const availableCount = Number(bookSnapshot.get('available')) || 0;
    const nextAvailable = Math.min(totalCopies, availableCount + 1);

    transaction.update(loanRef, {
      status: 'returned',
      returnedAt: FieldValue.serverTimestamp(),
      returnedBy: uid,
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(copyRef, {
      status: 'available',
      currentReaderId: FieldValue.delete(),
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.update(bookRef, {
      available: nextAvailable,
      status: nextAvailable === 0 ? 'All borrowed' : nextAvailable <= 2 ? 'Low stock' : 'Available',
      updatedAt: FieldValue.serverTimestamp(),
    });
    transaction.create(auditRef, {
      actorId: uid,
      action: 'loan.returned',
      targetId: loanId,
      createdAt: FieldValue.serverTimestamp(),
    });
  });

  return { loanId, status: 'returned' };
});

/**
 * Returns real circulation metrics calculated from this library's Firestore records.
 * All access is tenant-scoped and role-checked; demo arrays are never used.
 */
exports.getLibraryAnalytics = onCall(async (request) => {
  const uid = requireAuth(request);
  const libraryId = cleanString(request.data?.libraryId, 'Library ID', 140);
  await requireLibraryRole(libraryId, uid, ['owner', 'admin', 'librarian']);

  const [booksSnapshot, loansSnapshot, subscriptionSnapshot] = await Promise.all([
    db.collection(`libraries/${libraryId}/books`).get(),
    db.collection(`libraries/${libraryId}/loans`).get(),
    db.doc(`subscriptions/${libraryId}`).get(),
  ]);
  const books = booksSnapshot.docs.map((doc) => doc.data());
  const loans = loansSnapshot.docs.map((doc) => doc.data());
  const totalTitles = books.length;
  const totalCopies = books.reduce((sum, book) => sum + Math.max(0, Number(book.copies) || 0), 0);
  const availableCopies = books.reduce((sum, book) => sum + Math.max(0, Number(book.available) || 0), 0);
  const borrowedCopies = Math.max(0, totalCopies - availableCopies);
  const activeLoans = loans.filter((loan) => loan.status === 'active');
  const overdueLoans = activeLoans.filter((loan) => {
    const dueAt = loan.dueAt?.toDate ? loan.dueAt.toDate() : new Date(loan.dueAt);
    return !Number.isNaN(dueAt.getTime()) && dueAt.getTime() < Date.now();
  }).length;
  const percentage = (numerator, denominator) => denominator > 0
    ? Math.round((numerator / denominator) * 10000) / 100
    : 0;

  return {
    totalTitles,
    totalCopies,
    availableCopies,
    borrowedCopies,
    activeLoans: activeLoans.length,
    overdueLoans,
    borrowingRatePercent: percentage(borrowedCopies, totalCopies),
    overdueRatePercent: percentage(overdueLoans, activeLoans.length),
    subscription: subscriptionSnapshot.exists ? {
      planId: subscriptionSnapshot.get('planId') || 'unknown',
      status: subscriptionSnapshot.get('status') || 'unknown',
      currentPeriodEnd: subscriptionSnapshot.get('currentPeriodEnd')?.toDate?.().toISOString() || null,
    } : null,
    calculatedAt: new Date().toISOString(),
  };
});
