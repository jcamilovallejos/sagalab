export abstract class PaymentProviderError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Business rejection: the bank said no. Never retryable (phase 4).
export class PaymentProviderDeclinedError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`Pago ${paymentId} rechazado por el proveedor`);
  }
}

// Transient provider failure (error500, or flaky on its failing attempts).
// Retryable (phase 4).
export class PaymentProviderServerError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`Error del proveedor al procesar el pago ${paymentId}`);
  }
}

// The provider didn't respond in time. Retryable (phase 4) — but see
// charged_but_timeout: expiring doesn't mean the charge didn't happen.
export class PaymentProviderTimeoutError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`El proveedor no respondió a tiempo para el pago ${paymentId}`);
  }
}
