import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../database/pool.js';
import { requireSupabaseUser } from '../middleware/require-supabase-user.js';

export const booksRouter = Router({ mergeParams: true });

const createBookSchema = z.object({
  title: z.string().trim().min(1).max(240),
  author: z.string().trim().min(1).max(180),
  category: z.string().trim().min(1).max(80).default('Uncategorized'),
  isbn: z.string().trim().max(20).optional().nullable(),
  copies: z.coerce.number().int().min(1).max(300).default(1),
});

booksRouter.use(requireSupabaseUser);

async function getMembership(libraryId, userId) {
  const result = await pool.query(
    `SELECT m.role
     FROM memberships m
     JOIN libraries l ON l.id = m.library_id
     WHERE m.library_id = $1 AND m.user_id = $2
       AND m.status = 'active' AND l.status = 'active'
     LIMIT 1`,
    [libraryId, userId],
  );
  return result.rows[0] || null;
}

booksRouter.get('/libraries/:libraryId/books', async (request, response, next) => {
  try {
    const membership = await getMembership(request.params.libraryId, request.user.id);
    if (!membership) {
      return response.status(404).json({ error: 'Library workspace not found.' });
    }

    const result = await pool.query(
      `SELECT b.id, b.title, b.author, b.category, b.isbn, b.status,
              b.created_at,
              COUNT(c.id)::int AS total_copies,
              COUNT(c.id) FILTER (WHERE c.status = 'available')::int AS available_copies
       FROM books b
       LEFT JOIN book_copies c
         ON c.book_id = b.id AND c.library_id = b.library_id
       WHERE b.library_id = $1 AND b.status = 'active'
       GROUP BY b.id
       ORDER BY b.created_at DESC, b.title ASC`,
      [request.params.libraryId],
    );
    return response.status(200).json({ data: result.rows });
  } catch (error) {
    return next(error);
  }
});

booksRouter.post('/libraries/:libraryId/books', async (request, response, next) => {
  const parsed = createBookSchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: 'Please provide a valid book title, author and copy count.',
      details: parsed.error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
      })),
    });
  }

  const client = await pool.connect();
  try {
    const membership = await getMembership(request.params.libraryId, request.user.id);
    if (!membership) {
      return response.status(404).json({ error: 'Library workspace not found.' });
    }
    if (!['owner', 'admin', 'librarian', 'staff'].includes(membership.role)) {
      return response.status(403).json({ error: 'You do not have permission to add books to this library.' });
    }

    const { title, author, category, isbn, copies } = parsed.data;
    await client.query('BEGIN');
    const inserted = await client.query(
      `INSERT INTO books (library_id, title, author, category, isbn, created_by)
       VALUES ($1, $2, $3, $4, $5, $6)
       RETURNING id, title, author, category, isbn, status, created_at`,
      [request.params.libraryId, title, author, category, isbn || null, request.user.id],
    );
    const book = inserted.rows[0];

    for (let index = 0; index < copies; index += 1) {
      const barcode = `MCT-${randomUUID().replaceAll('-', '').slice(0, 16).toUpperCase()}`;
      await client.query(
        `INSERT INTO book_copies (library_id, book_id, barcode)
         VALUES ($1, $2, $3)`,
        [request.params.libraryId, book.id, barcode],
      );
    }

    await client.query(
      `INSERT INTO audit_logs (library_id, actor_user_id, action, resource_type, resource_id, metadata)
       VALUES ($1, $2, 'book.created', 'book', $3, $4::jsonb)`,
      [
        request.params.libraryId,
        request.user.id,
        book.id,
        JSON.stringify({ copies_created: copies, title: book.title }),
      ],
    );
    await client.query('COMMIT');

    return response.status(201).json({
      data: {
        ...book,
        total_copies: copies,
        available_copies: copies,
      },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});
