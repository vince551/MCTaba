import { env } from '../config/env.js';
import { pool } from '../database/pool.js';

export async function requireSupabaseUser(request, response, next) {
  const authorization = request.get('authorization') || '';
  const match = authorization.match(/^Bearer\\s+(.+)$/i);
  if (!match) {
    return response.status(401).json({ error: 'A valid Supabase access token is required.' });
  }

  if (!env.SUPABASE_URL || !env.SUPABASE_PUBLISHABLE_KEY) {
    return response.status(503).json({ error: 'Authentication is not configured on this API.' });
  }

  try {
    const authResponse = await fetch(new URL('/auth/v1/user', env.SUPABASE_URL), {
      method: 'GET',
      headers: {
        apikey: env.SUPABASE_PUBLISHABLE_KEY,
        Authorization: `Bearer ${match[1]}`,
      },
      signal: AbortSignal.timeout(6000),
    });

    if (authResponse.status === 401 || authResponse.status === 403) {
      return response.status(401).json({ error: 'Your session is invalid or has expired.' });
    }
    if (!authResponse.ok) {
      return response.status(503).json({ error: 'The authentication service is temporarily unavailable.' });
    }

    const authUser = await authResponse.json();
    if (!authUser?.id || !authUser?.email) {
      return response.status(401).json({ error: 'The authentication service returned an incomplete user.' });
    }

    const metadata = authUser.user_metadata || {};
    const fullName = String(metadata.full_name || metadata.name || authUser.email.split('@')[0]).trim().slice(0, 160);
    const verifiedAt = authUser.email_confirmed_at || authUser.confirmed_at || null;
    const values = [authUser.id, authUser.email, fullName, verifiedAt];

    // First reuse an account already linked to this exact Supabase identity.
    let result = await pool.query(
      `UPDATE users
       SET email = $2,
           full_name = $3,
           email_verified_at = COALESCE($4, email_verified_at),
           updated_at = CURRENT_TIMESTAMP
       WHERE supabase_user_id = $1
       RETURNING id, email, full_name, email_verified_at`,
      values,
    );

    // Safely claim a legacy email record only when it has no Supabase identity.
    // This preserves its existing user ID, memberships, and library ownership.
    if (result.rowCount === 0) {
      result = await pool.query(
        `UPDATE users
         SET supabase_user_id = $1,
             email = $2,
             full_name = $3,
             email_verified_at = COALESCE($4, email_verified_at),
             updated_at = CURRENT_TIMESTAMP
         WHERE lower(email) = lower($2)
           AND supabase_user_id IS NULL
         RETURNING id, email, full_name, email_verified_at`,
        values,
      );
    }

    // Create a fresh identity record when no reusable account exists.
    if (result.rowCount === 0) {
      result = await pool.query(
        `INSERT INTO users (supabase_user_id, email, full_name, password_hash, email_verified_at)
         VALUES ($1, $2, $3, NULL, $4)
         ON CONFLICT (supabase_user_id) WHERE supabase_user_id IS NOT NULL DO UPDATE
           SET email = EXCLUDED.email,
               full_name = EXCLUDED.full_name,
               email_verified_at = COALESCE(EXCLUDED.email_verified_at, users.email_verified_at),
               updated_at = CURRENT_TIMESTAMP
         RETURNING id, email, full_name, email_verified_at`,
        values,
      );
    }

    request.user = result.rows[0];
    request.supabaseUser = authUser;
    return next();
  } catch (error) {
    if (error.name === 'TimeoutError' || error.name === 'AbortError') {
      return response.status(503).json({ error: 'The authentication service timed out. Please retry.' });
    }
    if (error.code === '23505') {
      return response.status(409).json({ error: 'This email is linked to a different account. Contact support.' });
    }
    console.error('Supabase authentication request failed:', error.message);
    return response.status(503).json({ error: 'Authentication could not be completed. Please retry.' });
  }
}
