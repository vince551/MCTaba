import 'dotenv/config';
import { z } from 'zod';

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
  PORT: z.coerce.number().int().min(1).max(65535).default(4000),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),
  DATABASE_SSL: z.enum(['true', 'false']).default('false').transform((value) => value === 'true'),
  DATABASE_SSL_REJECT_UNAUTHORIZED: z.enum(['true', 'false']).default('true').transform((value) => value === 'true'),
  DATABASE_POOL_MAX: z.coerce.number().int().min(1).max(50).default(10),
  DATABASE_IDLE_TIMEOUT_MS: z.coerce.number().int().positive().default(30000),
  DATABASE_CONNECTION_TIMEOUT_MS: z.coerce.number().int().positive().default(5000),
  CORS_ORIGINS: z.string().default('http://localhost:5173,http://127.0.0.1:5173'),
}).superRefine((value, context) => {
  if (value.NODE_ENV === 'production' && !value.CORS_ORIGINS.trim()) {
    context.addIssue({
      code: 'custom',
      path: ['CORS_ORIGINS'],
      message: 'Set CORS_ORIGINS to the exact Vercel frontend origin in production.',
    });
  }
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  const details = parsed.error.issues
    .map((issue) => `${issue.path.join('.')}: ${issue.message}`)
    .join('; ');
  throw new Error(`Invalid backend environment: ${details}`);
}

export const env = Object.freeze({
  ...parsed.data,
  corsOrigins: parsed.data.CORS_ORIGINS.split(',').map((origin) => origin.trim()).filter(Boolean),
});
