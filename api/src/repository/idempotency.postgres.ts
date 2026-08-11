import type { Pool } from 'pg';

import type {
  CompleteParams,
  IdempotencyRecord,
  IdempotencyRepository,
  ReserveParams,
  ReserveResult,
} from './idempotency.ts';

const UNIQUE_VIOLATION = '23505';

function isUniqueViolation(error: unknown): boolean {
  return (
    typeof error === 'object' &&
    error !== null &&
    'code' in error &&
    (error as { code: unknown }).code === UNIQUE_VIOLATION
  );
}

interface IdempotencyRow {
  key: string;
  endpoint: string;
  request_hash: string;
  status: 'in_progress' | 'done';
  response_status: number | null;
  response_body: unknown;
  expires_at: Date;
}

function toRecord(row: IdempotencyRow): IdempotencyRecord {
  return {
    key: row.key,
    endpoint: row.endpoint,
    requestHash: row.request_hash,
    status: row.status,
    responseStatus: row.response_status,
    responseBody: row.response_body,
    expiresAt: row.expires_at,
  };
}

export class PostgresIdempotencyRepository implements IdempotencyRepository {
  private readonly pool: Pool;

  constructor(pool: Pool) {
    this.pool = pool;
  }

  async reserve(params: ReserveParams): Promise<ReserveResult> {
    try {
      await this.pool.query(
        `INSERT INTO idempotency_keys (key, endpoint, request_hash, status, expires_at)
         VALUES ($1, $2, $3, 'in_progress', $4)`,
        [params.key, params.endpoint, params.requestHash, params.expiresAt],
      );
      return { outcome: 'reserved' };
    } catch (error) {
      if (!isUniqueViolation(error)) throw error;

      const result = await this.pool.query<IdempotencyRow>(
        `SELECT key, endpoint, request_hash, status, response_status, response_body, expires_at
         FROM idempotency_keys
         WHERE key = $1 AND endpoint = $2`,
        [params.key, params.endpoint],
      );
      const row = result.rows[0];
      if (row === undefined) {
        // Perdimos el INSERT contra otra fila, pero ya no existe al leerla
        // (purgada por TTL entremedio): tratamos como si nunca hubiera
        // reservado nadie y dejamos que el llamador reintente.
        throw new Error(
          `idempotency_keys: violación de unicidad para (${params.key}, ${params.endpoint}) sin fila legible`,
        );
      }
      return { outcome: 'conflict', record: toRecord(row) };
    }
  }

  async complete(params: CompleteParams): Promise<void> {
    await this.pool.query(
      `UPDATE idempotency_keys
       SET status = 'done', response_status = $1, response_body = $2
       WHERE key = $3 AND endpoint = $4`,
      [params.responseStatus, JSON.stringify(params.responseBody), params.key, params.endpoint],
    );
  }

  async purgeExpired(now: Date): Promise<number> {
    const result = await this.pool.query('DELETE FROM idempotency_keys WHERE expires_at < $1', [
      now,
    ]);
    return result.rowCount ?? 0;
  }
}
