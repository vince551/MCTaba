import { after, before, test } from 'node:test';
import assert from 'node:assert/strict';

process.env.NODE_ENV = 'test';
process.env.DATABASE_URL ||= 'postgresql://test:test@127.0.0.1:5432/mctaba_test';
process.env.CORS_ORIGINS = 'http://localhost:5173';

const { app } = await import('./app.js');
const { pool } = await import('./database/pool.js');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0, '127.0.0.1');
  await new Promise((resolve, reject) => {
    server.once('listening', resolve);
    server.once('error', reject);
  });
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) await new Promise((resolve) => server.close(resolve));
  await pool.end();
});

test('root endpoint identifies the API without exposing framework headers', async () => {
  const response = await fetch(baseUrl);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { service: 'mctaba-api', status: 'online' });
  assert.equal(response.headers.get('x-powered-by'), null);
});

test('liveness endpoint responds without requiring PostgreSQL', async () => {
  const response = await fetch(`${baseUrl}/health/live`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok', service: 'mctaba-api' });
});

test('unknown routes return a consistent JSON 404', async () => {
  const response = await fetch(`${baseUrl}/not-a-route`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Route not found.' });
});

test('requests from unlisted browser origins are rejected', async () => {
  const response = await fetch(`${baseUrl}/health/live`, {
    headers: { Origin: 'https://untrusted.example' },
  });
  assert.equal(response.status, 403);
  assert.deepEqual(await response.json(), { error: 'This origin is not allowed.' });
});
