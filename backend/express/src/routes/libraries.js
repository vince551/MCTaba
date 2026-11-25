import { Router } from 'express';
import { randomUUID } from 'node:crypto';
import { z } from 'zod';
import { pool } from '../database/pool.js';
import { requireSupabaseUser } from '../middleware/require-supabase-user.js';

export const librariesRouter = Router();

const createLibrarySchema = z.object({
  name: z.string().trim().min(2).max(180),
  library_type: z.string().trim().min(2).max(40).regex(/^[a-zA-Z0-9 _-]+$/),
  location: z.string().trim().max(180).optional().nullable(),
});

librariesRouter.use(requireSupabaseUser);

librariesRouter.get('/', async (request, response, next) => {
  try {
    const result = await pool.query(
      `SELECT l.id, l.name, l.slug, l.library_type, l.location, l.status,
              m.role, m.status AS membership_status
       FROM memberships m
       JOIN libraries l ON l.id = m.library_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY l.name ASC`,
      [request.user.id],
    );
    return response.status(200).json({ libraries: result.rows });
  } catch (error) {
    return next(error);
  }
});

librariesRouter.post('/', async (request, response, next) => {
  const parsed = createLibrarySchema.safeParse(request.body);
  if (!parsed.success) {
    return response.status(400).json({
      error: 'Please provide a valid library name and type.',
      details: parsed.error.issues.map((issue) => ({ field: issue.path.join('.'), message: issue.message })),
    });
  }

  const client = await pool.connect();
  try {
    const { name, library_type, location } = parsed.data;
    const baseSlug = name.toLowerCase().normalize('NFKD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .slice(0, 80) || 'library';
    const slug = `${baseSlug}-${randomUUID().slice(0, 8)}`;

    await client.query('BEGIN');
    const libraryResult = await client.query(
      `INSERT INTO libraries (name, slug, library_type, location, created_by)
       VALUES ($1, $2, $3, $4, $5)
       RETURNING id, name, slug, library_type, location, status, created_at`,
      [name, slug, library_type.toLowerCase(), location || null, request.user.id],
    );
    const library = libraryResult.rows[0];

    await client.query(
      `INSERT INTO memberships (library_id, user_id, role, status)
       VALUES ($1, $2, 'owner', 'active')`,
      [library.id, request.user.id],
    );
    await client.query(
      `INSERT INTO audit_logs (library_id, actor_user_id, action, resource_type, resource_id)
       VALUES ($1, $2, 'library.created', 'library', $3)`,
      [library.id, request.user.id, library.id],
    );
    await client.query('COMMIT');

    return response.status(201).json({
      library: { ...library, role: 'owner', membership_status: 'active' },
    });
  } catch (error) {
    await client.query('ROLLBACK');
    return next(error);
  } finally {
    client.release();
  }
});
