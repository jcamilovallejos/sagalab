import { createHash } from 'node:crypto';

import type { NextFunction, Request, RequestHandler, Response } from 'express';

import type { IdempotencyRepository } from '../repository/idempotency.ts';
import type { Clock } from '../resilience/clock.ts';

export interface IdempotencyMiddlewareOptions {
  // Nombre estable del endpoint protegido (ej. 'POST /checkout'), decidido
  // al montar el middleware — nunca inferido de req.path, que puede variar
  // con params dinámicos.
  readonly endpoint: string;
  readonly ttlMs: number;
}

// Stringify con claves ordenadas: el mismo payload lógico no debe producir
// hashes distintos solo porque el cliente mandó las claves en otro orden.
function canonicalize(value: unknown): string {
  if (Array.isArray(value)) {
    return `[${value.map(canonicalize).join(',')}]`;
  }
  if (value !== null && typeof value === 'object') {
    const entries = Object.entries(value as Record<string, unknown>).sort(([a], [b]) =>
      a < b ? -1 : a > b ? 1 : 0,
    );
    return `{${entries.map(([k, v]) => `${JSON.stringify(k)}:${canonicalize(v)}`).join(',')}}`;
  }
  return JSON.stringify(value);
}

function hashRequest(body: unknown): string {
  return createHash('sha256').update(canonicalize(body)).digest('hex');
}

// Envuelve res.json/res.send para marcar la llave 'done' con la respuesta
// real que salió, sea éxito o el 500 del error-handler global — ambos pasan
// por el mismo objeto Response. Si la conexión muere antes de responder
// (el caso "charged_but_timeout"), nada llama a complete() y la fila queda
// 'in_progress' hasta que el TTL la purgue: esta capa no resuelve esa
// ambigüedad, la fase 6 (saga, queryBeforeCompensate) sí.
function interceptResponse(
  res: Response,
  repo: IdempotencyRepository,
  endpoint: string,
  key: string,
): void {
  let completed = false;

  const complete = (body: unknown): void => {
    if (completed) return;
    completed = true;
    void repo.complete({ key, endpoint, responseStatus: res.statusCode, responseBody: body });
  };

  const originalJson = res.json.bind(res);
  res.json = ((body?: unknown) => {
    complete(body);
    return originalJson(body);
  }) as Response['json'];

  const originalSend = res.send.bind(res);
  res.send = ((body?: unknown) => {
    complete(body);
    return originalSend(body);
  }) as Response['send'];
}

export function idempotencyMiddleware(
  repo: IdempotencyRepository,
  clock: Clock,
  options: IdempotencyMiddlewareOptions,
): RequestHandler {
  return (req: Request, res: Response, next: NextFunction): void => {
    void run(req, res, next);
  };

  async function run(req: Request, res: Response, next: NextFunction): Promise<void> {
    const key = req.header('Idempotency-Key');
    if (!key) {
      res.status(400).json({ error: 'falta el header Idempotency-Key' });
      return;
    }

    const requestHash = hashRequest(req.body);
    const expiresAt = new Date(clock.now().getTime() + options.ttlMs);

    // INSERT primero, nunca SELECT + INSERT: el constraint único de la
    // implementación real es el árbitro, no una lectura previa del código.
    const result = await repo.reserve({
      key,
      endpoint: options.endpoint,
      requestHash,
      expiresAt,
    });

    if (result.outcome === 'conflict') {
      const { record } = result;

      if (record.requestHash !== requestHash) {
        res.status(422).json({ error: 'Idempotency-Key ya usada con un payload distinto' });
        return;
      }

      if (record.status === 'in_progress') {
        res.status(409).json({ error: 'ya hay una petición en vuelo con esta Idempotency-Key' });
        return;
      }

      // Mismo hash, ya 'done': réplay de la respuesta original, sin
      // re-ejecutar el efecto.
      res.status(record.responseStatus ?? 200).json(record.responseBody);
      return;
    }

    interceptResponse(res, repo, options.endpoint, key);
    next();
  }
}
