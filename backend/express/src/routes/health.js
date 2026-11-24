import { Router } from 'express';
import { checkDatabaseConnection } from '../database/pool.js';

export const healthRouter = Router();

healthRouter.get('/live', (_request, response) => {
  response.status(200).json({ status: 'ok', service: 'mctaba-api' });
});

healthRouter.get('/ready', async (_request, response) => {
  try {
    await checkDatabaseConnection();
    return response.status(200).json({ status: 'ready', database: 'connected' });
  } catch {
    return response.status(503).json({ status: 'not_ready', database: 'unavailable' });
  }
});
