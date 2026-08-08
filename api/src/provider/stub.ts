import { randomUUID } from 'node:crypto';

import {
  PaymentProviderDeclinedError,
  PaymentProviderServerError,
  PaymentProviderTimeoutError,
} from './errors.ts';
import type { ChargeRequest, ChargeResult, PaymentProvider } from './index.ts';
import type { Clock } from '../resilience/clock.ts';

// Stub principal: simula un banco/pasarela de pago en memoria, sin red real.
// El modo de fallo llega por request en ChargeRequest.fault (lo parsea
// middleware/fault-inject.ts a partir del header X-Fault-Inject).
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
        // El cobro sí ocurre (queda registrado), pero la respuesta nunca
        // llega — es el caso perverso: el llamador no tiene forma de saber,
        // por esta promesa, que el dinero ya se movió.
        this.chargedDespiteTimeout.add(request.idempotencyKey);
        return new Promise<never>(() => {});
    }
  }

  // Introspección de prueba, no forma parte de la interfaz PaymentProvider:
  // ninguna otra implementación (altstub, fase 10) tiene por qué exponerla.
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
