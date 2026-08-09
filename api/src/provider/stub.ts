import { randomUUID } from 'node:crypto';

import {
  PaymentProviderDeclinedError,
  PaymentProviderServerError,
  PaymentProviderTimeoutError,
} from './errors.ts';
import type { ChargeRequest, ChargeResult, PaymentProvider } from './index.ts';
import type { Clock } from '../resilience/clock.ts';

// Main stub: simulates a bank/payment gateway in memory, no real network.
// The fault mode arrives per request in ChargeRequest.fault (parsed by
// middleware/fault-inject.ts from the X-Fault-Inject header).
export class StubPaymentProvider implements PaymentProvider {
  private readonly clock: Clock;
  private readonly flakyAttempts = new Map<string, number>();
  private readonly chargedDespiteTimeout = new Set<string>();

  constructor(clock: Clock) {
    this.clock = clock;
  }

  async charge(request: ChargeRequest): Promise<ChargeResult> {
    const fault = request.fault ?? { kind: 'ok' as const };

    switch (fault.kind) {
      case 'ok':
        return this.approve();

      case 'declined':
        throw new PaymentProviderDeclinedError(request.paymentId);

      case 'error500':
        throw new PaymentProviderServerError(request.paymentId);

      case 'slow':
        await this.clock.sleep(fault.ms);
        return this.approve();

      case 'timeout':
        await this.clock.sleep(fault.ms);
        throw new PaymentProviderTimeoutError(request.paymentId);

      case 'flaky':
        return this.chargeFlaky(request, fault.n);

      case 'charged_but_timeout':
        // The charge does happen (it gets recorded), but the response never
        // arrives — this is the perverse case: the caller has no way to
        // know, from this promise, that the money already moved.
        this.chargedDespiteTimeout.add(request.idempotencyKey);
        return new Promise<never>(() => {});
    }
  }

  // Test introspection, not part of the PaymentProvider interface: no other
  // implementation (altstub, phase 10) needs to expose this.
  wasChargedDespiteTimeout(idempotencyKey: string): boolean {
    return this.chargedDespiteTimeout.has(idempotencyKey);
  }

  private async chargeFlaky(
    request: ChargeRequest,
    failuresBeforeSuccess: number,
  ): Promise<ChargeResult> {
    const attempts = (this.flakyAttempts.get(request.idempotencyKey) ?? 0) + 1;
    this.flakyAttempts.set(request.idempotencyKey, attempts);

    if (attempts <= failuresBeforeSuccess) {
      throw new PaymentProviderServerError(request.paymentId);
    }

    return this.approve();
  }

  private approve(): ChargeResult {
    return { providerRef: randomUUID() };
  }
}
