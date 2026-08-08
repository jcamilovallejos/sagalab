import { InvalidRefundAmountError, StaleWebhookEventError } from './errors.ts';

interface PaymentBase {
  readonly id: string;
  readonly amountCents: number;
  // Timestamp del último evento del proveedor aplicado a este pago. Toda
  // transición lo compara contra el timestamp del evento entrante para
  // decidir si el evento está fuera de orden.
  readonly lastEventAt: Date;
}

export interface PendingPayment extends PaymentBase {
  readonly status: 'pending';
}

export interface AuthorizedPayment extends PaymentBase {
  readonly status: 'authorized';
}

export interface CapturedPayment extends PaymentBase {
  readonly status: 'captured';
}

export interface DeclinedPayment extends PaymentBase {
  readonly status: 'declined';
}

export interface ExpiredPayment extends PaymentBase {
  readonly status: 'expired';
}

export interface RefundedPayment extends PaymentBase {
  readonly status: 'refunded';
  readonly refundedCents: number;
}

export interface PartiallyRefundedPayment extends PaymentBase {
  readonly status: 'partially_refunded';
  readonly refundedCents: number;
}

// captured y refunded no son terminales: un chargeback puede llegar después.
export interface ChargedBackPayment extends PaymentBase {
  readonly status: 'charged_back';
}

export type Payment =
  | PendingPayment
  | AuthorizedPayment
  | CapturedPayment
  | DeclinedPayment
  | ExpiredPayment
  | RefundedPayment
  | PartiallyRefundedPayment
  | ChargedBackPayment;

function assertNotStale(payment: PaymentBase, eventAt: Date): void {
  if (eventAt.getTime() < payment.lastEventAt.getTime()) {
    throw new StaleWebhookEventError(payment.id, payment.lastEventAt, eventAt);
  }
}

export function authorize(payment: PendingPayment, eventAt: Date): AuthorizedPayment {
  assertNotStale(payment, eventAt);
  return { ...payment, status: 'authorized', lastEventAt: eventAt };
}

export function decline(payment: PendingPayment, eventAt: Date): DeclinedPayment {
  assertNotStale(payment, eventAt);
  return { ...payment, status: 'declined', lastEventAt: eventAt };
}

export function expire(payment: AuthorizedPayment, eventAt: Date): ExpiredPayment {
  assertNotStale(payment, eventAt);
  return { ...payment, status: 'expired', lastEventAt: eventAt };
}

export function capture(payment: AuthorizedPayment, eventAt: Date): CapturedPayment {
  assertNotStale(payment, eventAt);
  return { ...payment, status: 'captured', lastEventAt: eventAt };
}

export function refund(
  payment: CapturedPayment | PartiallyRefundedPayment,
  amountCents: number,
  eventAt: Date,
): RefundedPayment | PartiallyRefundedPayment {
  assertNotStale(payment, eventAt);

  const previouslyRefunded = payment.status === 'partially_refunded' ? payment.refundedCents : 0;
  const totalRefunded = previouslyRefunded + amountCents;

  if (totalRefunded > payment.amountCents) {
    throw new InvalidRefundAmountError(payment.id, amountCents);
  }

  if (totalRefunded === payment.amountCents) {
    return { ...payment, status: 'refunded', refundedCents: totalRefunded, lastEventAt: eventAt };
  }

  return {
    ...payment,
    status: 'partially_refunded',
    refundedCents: totalRefunded,
    lastEventAt: eventAt,
  };
}

export function chargeback(
  payment: CapturedPayment | RefundedPayment,
  eventAt: Date,
): ChargedBackPayment {
  assertNotStale(payment, eventAt);
  return { ...payment, status: 'charged_back', lastEventAt: eventAt };
}
