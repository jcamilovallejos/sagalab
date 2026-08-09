import type { ErrorRequestHandler } from 'express';

// Express only recognizes the error handler if it has arity 4; _next must exist even if unused.
// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const errorHandler: ErrorRequestHandler = (err, _req, res, _next) => {
  const message = err instanceof Error ? err.message : 'Error inesperado';
  res.status(500).json({ error: message });
};
