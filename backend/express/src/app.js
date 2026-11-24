import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { env } from './config/env.js';
import { healthRouter } from './routes/health.js';

export const app = express();

app.disable('x-powered-by');
app.set('trust proxy', 1);
app.use(helmet());
app.use(cors({
  origin(origin, callback) {
    // Permit server-to-server requests and platform health probes without an Origin header.
    if (!origin || env.corsOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by CORS.'));
  },
}));
app.use(express.json({ limit: '1mb' }));

app.get('/', (_request, response) => {
  response.status(200).json({ service: 'mctaba-api', status: 'online' });
});

app.use('/health', healthRouter);

app.use((_request, response) => {
  response.status(404).json({ error: 'Route not found.' });
});

app.use((error, _request, response, _next) => {
  if (error.message === 'Origin is not allowed by CORS.') {
    return response.status(403).json({ error: 'This origin is not allowed.' });
  }
  if (error instanceof SyntaxError && 'body' in error) {
    return response.status(400).json({ error: 'Request body contains invalid JSON.' });
  }
  console.error('Unhandled API error:', error.message);
  return response.status(500).json({ error: 'An unexpected server error occurred.' });
});
