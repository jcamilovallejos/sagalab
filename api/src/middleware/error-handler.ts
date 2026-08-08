import type { ErrorRequestHandler } from 'express';

// Express solo reconoce el error handler si tiene aridad 4; _next debe existir aunque no se use.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const message = err instanceof Error ? err.message : 'Error inesperado';
  res.status(500).json({ error: message });
};
