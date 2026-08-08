export abstract class DomainError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Política del dominio ante webhooks fuera de orden: rechazar, nunca bufferizar.
// Un evento con timestamp anterior al último aplicado se descarta explícitamente
// en vez de encolarse — bufferizar requeriría estado adicional (cola, reintentos)
// que esta capa pura no tiene forma de sostener.
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
