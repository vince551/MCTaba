import { authenticate, db, FieldValue, requireSubscriptionAccess, requireLibraryRole, respondError, text, Timestamp } from './_lib/admin.js';
import { allowMethods, bodyObject } from './_lib/http.js';

export default async function handler(req, res) {
  if (!allowMethods(req, res, ['POST'])) return;
  try {
    const identity = await authenticate(req);
    const input = bodyObject(req.body);
    const action = text(input.action, 'Action', 40);
    const libraryId = text(input.libraryId, 'Library ID', 140);
    const database = db();
    await requireLibraryRole(database, libraryId, identity.uid, ['owner', 'admin', 'librarian']);
    await requireSubscriptionAccess(database, libraryId);

    if (action === 'checkoutBook') {
      const copyId = text(input.copyId, 'Copy ID', 140);
      const readerId = text(input.readerId, 'Reader ID', 140);
      const dueDate = typeof input.dueAt === 'string' ? new Date(input.dueAt) : null;
      if (!dueDate || Number.isNaN(dueDate.getTime()) || dueDate.getTime() <= Date.now()) {
        const error = new Error('A valid future due date is required.');
        error.status = 400;
        throw error;
      }
      const copyRef = database.doc(`libraries/${libraryId}/copies/${copyId}`);
      const readerRef = database.doc(`libraries/${libraryId}/readers/${readerId}`);
      const loanRef = database.collection(`libraries/${libraryId}/loans`).doc();
      const auditRef = database.collection(`libraries/${libraryId}/auditLogs`).doc();
      await database.runTransaction(async (tx) => {
        const [copy, reader] = await Promise.all([tx.get(copyRef), tx.get(readerRef)]);
        if (!copy.exists) { const e = new Error('Book copy not found.'); e.status = 404; throw e; }
        if (!reader.exists || reader.get('status') !== 'active') {
          const e = new Error('The reader is missing or inactive.'); e.status = 409; throw e;
        }
        if (copy.get('status') !== 'available') {
          const e = new Error('This copy is not available for checkout.'); e.status = 409; throw e;
        }
        const bookId = copy.get('bookId');
        if (typeof bookId !== 'string' || !bookId) { const e = new Error('This copy has no valid book reference.'); e.status = 409; throw e; }
        const bookRef = database.doc(`libraries/${libraryId}/books/${bookId}`);
        const book = await tx.get(bookRef);
        if (!book.exists) { const e = new Error('The catalogue record for this copy no longer exists.'); e.status = 409; throw e; }
        const available = Number(book.get('available'));
        if (!Number.isInteger(available) || available < 1) { const e = new Error('The catalogue shows no available copies. Refresh inventory and try again.'); e.status = 409; throw e; }
        tx.update(copyRef, { status: 'borrowed', currentReaderId: readerId, updatedAt: FieldValue.serverTimestamp() });
        tx.update(bookRef, {
          available: available - 1,
          status: available - 1 === 0 ? 'All borrowed' : available - 1 <= 2 ? 'Low stock' : 'Available',
          updatedAt: FieldValue.serverTimestamp(),
        });
        tx.create(loanRef, {
          copyId, bookId, readerId, checkedOutBy: identity.uid,
          checkedOutAt: FieldValue.serverTimestamp(), dueAt: Timestamp.fromDate(dueDate),
          returnedAt: null, status: 'active', createdAt: FieldValue.serverTimestamp(),
        });
        tx.create(auditRef, { actorId: identity.uid, action: 'loan.checked_out', targetId: loanRef.id, createdAt: FieldValue.serverTimestamp() });
      });
      return res.status(201).json({ loanId: loanRef.id, status: 'active' });
    }

    if (action === 'returnBook') {
      const loanId = text(input.loanId, 'Loan ID', 140);
      const loanRef = database.doc(`libraries/${libraryId}/loans/${loanId}`);
      const auditRef = database.collection(`libraries/${libraryId}/auditLogs`).doc();
      await database.runTransaction(async (tx) => {
        const loan = await tx.get(loanRef);
        if (!loan.exists) { const e = new Error('Loan not found.'); e.status = 404; throw e; }
        if (loan.get('status') !== 'active') { const e = new Error('This loan has already been returned or closed.'); e.status = 409; throw e; }
        const copyId = loan.get('copyId');
        if (typeof copyId !== 'string' || !copyId) { const e = new Error('This loan has no valid copy reference.'); e.status = 409; throw e; }
        const copyRef = database.doc(`libraries/${libraryId}/copies/${copyId}`);
        const copy = await tx.get(copyRef);
        if (!copy.exists || copy.get('status') !== 'borrowed' || copy.get('currentReaderId') !== loan.get('readerId')) {
          const e = new Error('The copy status does not match this loan. Review circulation records.'); e.status = 409; throw e;
        }
        const bookId = loan.get('bookId') || copy.get('bookId');
        if (typeof bookId !== 'string' || !bookId) { const e = new Error('This loan has no valid book reference.'); e.status = 409; throw e; }
        const bookRef = database.doc(`libraries/${libraryId}/books/${bookId}`);
        const book = await tx.get(bookRef);
        if (!book.exists) { const e = new Error('The catalogue record for this book no longer exists.'); e.status = 409; throw e; }
        const total = Number(book.get('copies')) || 0;
        const available = Number(book.get('available')) || 0;
        const next = Math.min(total, available + 1);
        tx.update(loanRef, { status: 'returned', returnedAt: FieldValue.serverTimestamp(), returnedBy: identity.uid, updatedAt: FieldValue.serverTimestamp() });
        tx.update(copyRef, { status: 'available', currentReaderId: FieldValue.delete(), updatedAt: FieldValue.serverTimestamp() });
        tx.update(bookRef, { available: next, status: next === 0 ? 'All borrowed' : next <= 2 ? 'Low stock' : 'Available', updatedAt: FieldValue.serverTimestamp() });
        tx.create(auditRef, { actorId: identity.uid, action: 'loan.returned', targetId: loanId, createdAt: FieldValue.serverTimestamp() });
      });
      return res.status(200).json({ loanId, status: 'returned' });
    }

    return res.status(400).json({ error: 'Unsupported circulation action.' });
  } catch (error) {
    return respondError(res, error);
  }
}
