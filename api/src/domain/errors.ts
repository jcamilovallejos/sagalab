export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Domain policy for out-of-order webhooks: reject, never buffer. An event
// with a timestamp older than the last applied one is explicitly discarded
// instead of queued — buffering would need extra state (a queue, retries)
// that this pure layer has no way to sustain.
export class StaleWebhookEventError extends DomainError {
  readonly paymentId: string;
  readonly lastEventAt: Date;
  readonly eventAt: Date;

  constructor(paymentId: string, lastEventAt: Date, eventAt: Date) {
    super(
      `Evento fuera de orden para el pago ${paymentId}: último evento aplicado en ` +
        `${lastEventAt.toISOString()}, este evento es de ${eventAt.toISOString()}`,
    );
    this.paymentId = paymentId;
    this.lastEventAt = lastEventAt;
    this.eventAt = eventAt;
  }
}

export class InvalidRefundAmountError extends DomainError {
  readonly paymentId: string;
  readonly amountCents: number;

  constructor(paymentId: string, amountCents: number) {
    super(
      `Monto de reembolso inválido para el pago ${paymentId}: ${amountCents} centavos ` +
        `excede el saldo disponible para reembolsar`,
    );
    this.paymentId = paymentId;
    this.amountCents = amountCents;
  }
}
