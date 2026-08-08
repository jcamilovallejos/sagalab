import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import {
  authorize,
  capture,
  refund,
  decline,
  type PendingPayment,
  chargeback,
  expire,
} from '../../src/domain/payment-state.ts';

test('Payment created - authorized', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    assert.strictEqual(authorizedPayment.status, 'authorized');
  });
});

test('Payment created - expired', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    assert.strictEqual(authorizedPayment.status, 'authorized');
    const expiredPayment = expire(authorizedPayment, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(expiredPayment.status, 'expired');
  });
});

test('Payment created - declined', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const payment: PendingPayment = {
      status: 'pending',
      id: 'payment-id',
      amountCents: 1000,
      lastEventAt: new Date(eventAt.getTime() - 1000),
    };
    const declinedPayment = decline(payment, eventAt);
    assert.strictEqual(declinedPayment.status, 'declined');
  });
});

test('Payment authorized - captured', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(capturedPayment.status, 'captured');
  });
});

test('Payment authorized - refunded', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    const refundedPayment = refund(capturedPayment, 1000, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(refundedPayment.status, 'refunded');
  });
});

test('Payment authorized - partially_refunded', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    const refundedPayment = refund(capturedPayment, 500, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(refundedPayment.status, 'partially_refunded');
  });
});

test('Payment authorized - partially_refunded - refunded', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    const partiallyRefundedPayment = refund(
      capturedPayment,
      500,
      new Date(eventAt.getTime() + 1000),
    );
    if (partiallyRefundedPayment.status !== 'partially_refunded') {
      throw new Error('se esperaba partially_refunded');
    }
    const refundedPayment = refund(
      partiallyRefundedPayment,
      500,
      new Date(eventAt.getTime() + 1000),
    );
    assert.strictEqual(refundedPayment.status, 'refunded');
  });
});

test('Payment captured - charged_back', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    const chargedBackPayment = chargeback(capturedPayment, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(chargedBackPayment.status, 'charged_back');
  });
});

test('Payment refunded - charged_back', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    const refundedPayment = refund(capturedPayment, 1000, new Date(eventAt.getTime() + 1000));
    if (refundedPayment.status !== 'refunded') {
      throw new Error('se esperaba partially_refunded');
    }
    const chargedBackPayment = chargeback(refundedPayment, new Date(eventAt.getTime() + 1000));
    assert.strictEqual(chargedBackPayment.status, 'charged_back');
  });
});

test('Payment must be fail when evenAt is in the past', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    assert.strictEqual(authorizedPayment.status, 'authorized');
    assert.throws(() => capture(authorizedPayment, new Date('2020-01-01T00:00:00Z')), {
      name: 'StaleWebhookEventError',
      message: /fuera de orden/,
      paymentId: 'payment-id',
    });
  });
});

test('Payment authorized - refunded', async (t: TestContext) => {
  await t.test('should return the correct payment state', async () => {
    const eventAt = new Date();
    const authorizedPayment = authorize(
      {
        status: 'pending',
        id: 'payment-id',
        amountCents: 1000,
        lastEventAt: new Date(eventAt.getTime() - 1000),
      } as PendingPayment,
      eventAt,
    );
    const capturedPayment = capture(authorizedPayment, new Date(eventAt.getTime() + 1000));
    assert.throws(() => refund(capturedPayment, 2000, new Date(eventAt.getTime() + 1000)), {
      name: 'InvalidRefundAmountError',
      message: /reembolso inválido/,
      paymentId: 'payment-id',
    });
  });
});
