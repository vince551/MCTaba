import pg from 'pg';
import { env } from '../config/env.js';

const { Pool } = pg;

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  max: env.DATABASE_POOL_MAX,
  idleTimeoutMillis: env.DATABASE_IDLE_TIMEOUT_MS,
  connectionTimeoutMillis: env.DATABASE_CONNECTION_TIMEOUT_MS,
  application_name: 'mctaba-api',
  ssl: env.DATABASE_SSL
    ? { rejectUnauthorized: env.DATABASE_SSL_REJECT_UNAUTHORIZED }
    : false,
});

pool.on('error', (error) => {
  // Observe idle-client errors without ever logging credentials or connection strings.
  console.error('Unexpected PostgreSQL pool error:', error.message);
});

export async function checkDatabaseConnection() {
  const result = await pool.query('SELECT 1 AS connected');
  return result.rows[0]?.connected === 1;
}
