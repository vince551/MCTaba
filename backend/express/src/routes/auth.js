import { Router } from 'express';
import { requireSupabaseUser } from '../middleware/require-supabase-user.js';
import { pool } from '../database/pool.js';

export const authRouter = Router();

authRouter.get('/me', requireSupabaseUser, async (request, response, next) => {
  try {
    const memberships = await pool.query(
      `SELECT l.id, l.name, l.slug, l.library_type, l.location, l.status,
              m.role, m.status AS membership_status
       FROM memberships m
       JOIN libraries l ON l.id = m.library_id
       WHERE m.user_id = $1 AND m.status = 'active'
       ORDER BY l.name ASC`,
      [request.user.id],
    );

    return response.status(200).json({
      user: request.user,
      memberships: memberships.rows,
    });
  } catch (error) {
    return next(error);
  }
});
