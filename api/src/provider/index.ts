import type { FaultMode } from '../types/fault-injection.ts';

export interface ChargeRequest {
  readonly paymentId: string;
  readonly amountCents: number;
  readonly idempotencyKey: string;
  readonly fault?: FaultMode;
}

export interface ChargeResult {
  readonly providerRef: string;
}

export interface PaymentProvider {
  charge(request: ChargeRequest): Promise<ChargeResult>;
}
