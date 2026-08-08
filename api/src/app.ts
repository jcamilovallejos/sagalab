import express, { type Express } from 'express';

import type { Env } from './config/env.ts';
import { docsRouter } from './routes/docs.ts';
import { healthRouter } from './routes/health.ts';
import { errorHandler } from './middleware/error-handler.ts';
import { corsWhitelist, securityHeaders } from './middleware/security.ts';

export function buildApp(env: Env): Express {
  const app = express();

  app.use(securityHeaders);
  app.use(corsWhitelist(env.CORS_ORIGINS));
  app.use(express.json());

  app.use(healthRouter());
  app.use(docsRouter());

  app.use(errorHandler);

  return app;
}
