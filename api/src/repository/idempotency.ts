export type IdempotencyStatus = 'in_progress' | 'done';

export interface IdempotencyRecord {
  readonly key: string;
  readonly endpoint: string;
  readonly requestHash: string;
  readonly status: IdempotencyStatus;
  readonly responseStatus: number | null;
  readonly responseBody: unknown;
  readonly expiresAt: Date;
}

export interface ReserveParams {
  readonly key: string;
  readonly endpoint: string;
  readonly requestHash: string;
  readonly expiresAt: Date;
}

// 'reserved': el INSERT ganó la carrera, el llamador puede ejecutar el efecto.
// 'conflict': ya existía (key, endpoint) — el record devuelto decide si es
// réplay (mismo hash, 'done'), en vuelo ('in_progress') o payload distinto.
export type ReserveResult =
  | { readonly outcome: 'reserved' }
  | { readonly outcome: 'conflict'; readonly record: IdempotencyRecord };

export interface CompleteParams {
  readonly key: string;
  readonly endpoint: string;
  readonly responseStatus: number;
  readonly responseBody: unknown;
}

export interface IdempotencyRepository {
  // Nunca SELECT + INSERT: implementaciones reales deben intentar el INSERT
  // y atrapar la violación del constraint único — eso es lo que arbitra.
  reserve(params: ReserveParams): Promise<ReserveResult>;
  complete(params: CompleteParams): Promise<void>;
  purgeExpired(now: Date): Promise<number>;
}
