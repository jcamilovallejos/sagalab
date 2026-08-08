import cors from 'cors';
import helmet from 'helmet';
import type { RequestHandler } from 'express';

export function corsWhitelist(allowedOrigins: readonly string[]): RequestHandler {
  return cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`Origin no permitido: ${origin}`));
    },
    credentials: true,
  });
}

export const securityHeaders: RequestHandler = helmet();
