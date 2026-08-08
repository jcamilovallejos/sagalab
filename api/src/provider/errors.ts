export abstract class PaymentProviderError extends Error {
  protected constructor(message: string) {
    super(message);
    this.name = new.target.name;
  }
}

// Rechazo de negocio: el banco dijo que no. Nunca reintentable (fase 4).
export class PaymentProviderDeclinedError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`Pago ${paymentId} rechazado por el proveedor`);
  }
}

// Fallo transitorio del proveedor (error500 o flaky en sus intentos fallidos).
// Reintentable (fase 4).
export class PaymentProviderServerError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`Error del proveedor al procesar el pago ${paymentId}`);
  }
}

// El proveedor no respondió a tiempo. Reintentable (fase 4) — pero ver
// charged_but_timeout: que expire no implica que el cobro no haya ocurrido.
export class PaymentProviderTimeoutError extends PaymentProviderError {
  constructor(paymentId: string) {
    super(`El proveedor no respondió a tiempo para el pago ${paymentId}`);
  }
}
