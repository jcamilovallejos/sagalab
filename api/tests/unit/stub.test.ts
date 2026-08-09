import { test, type TestContext } from 'node:test';
import assert from 'node:assert/strict';
import { StubPaymentProvider } from '../../src/provider/stub.ts';
import { FakeClock } from '../../src/resilience/clock.ts';
import {
  PaymentProviderDeclinedError,
  PaymentProviderServerError,
  PaymentProviderTimeoutError,
} from '../../src/provider/errors.ts';

test('StubPaymentProvider - charge', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should approve charge with no fault', async () => {
    const result = await provider.charge({
      idempotencyKey: 'key1',
      paymentId: 'payment1',
      amountCents: 1000,
    });
    assert.match(result.providerRef, /^[0-9a-f-]{36}$/);
  });
});

test('StubPaymentProvider - declined', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should decline charge with fault', async () => {
    try {
      await provider.charge({
        idempotencyKey: 'key2',
        paymentId: 'payment2',
        amountCents: 1000,
        fault: { kind: 'declined' },
      });
      assert.fail('Expected PaymentProviderDeclinedError to be thrown');
    } catch (error) {
      assert.ok(error instanceof PaymentProviderDeclinedError);
    }
  });
});

test('StubPaymentProvider - error500', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should throw server error with fault', async () => {
    try {
      await provider.charge({
        idempotencyKey: 'key2',
        paymentId: 'payment2',
        amountCents: 1000,
        fault: { kind: 'error500' },
      });
      assert.fail('Expected PaymentProviderServerError to be thrown');
    } catch (error) {
      assert.ok(error instanceof PaymentProviderServerError);
    }
  });
});

test('StubPaymentProvider - slow response', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should throw server error with fault', async () => {
    const promise = provider.charge({
      idempotencyKey: 'key2',
      paymentId: 'payment2',
      amountCents: 1000,
      fault: { kind: 'slow', ms: 1000 },
    });
    clock.advance(1000);
    const result = await promise;
    assert.match(result.providerRef, /^[0-9a-f-]{36}$/);
  });
});

test('StubPaymentProvider - timeout', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should throw timeout error with fault', async () => {
    const promise = provider.charge({
      idempotencyKey: 'key2',
      paymentId: 'payment2',
      amountCents: 1000,
      fault: { kind: 'timeout', ms: 1000 },
    });
    clock.advance(1000);
    try {
      await promise;
      assert.fail('Expected PaymentProviderTimeoutError to be thrown');
    } catch (error) {
      assert.ok(error instanceof PaymentProviderTimeoutError);
    }
  });
});

test('StubPaymentProvider - flaky', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should fail the first n attempts, then succeed', async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await provider.charge({
          idempotencyKey: 'key2',
          paymentId: 'payment2',
          amountCents: 1000,
          fault: { kind: 'flaky', n: 3 },
        });
        assert.fail(`Expected attempt ${attempt} to throw PaymentProviderServerError`);
      } catch (error) {
        assert.ok(error instanceof PaymentProviderServerError);
      }
    }

    const result = await provider.charge({
      idempotencyKey: 'key2',
      paymentId: 'payment2',
      amountCents: 1000,
      fault: { kind: 'flaky', n: 3 },
    });
    assert.match(result.providerRef, /^[0-9a-f-]{36}$/);
  });

  await t.test('should track attempts per idempotency key', async () => {
    try {
      await provider.charge({
        idempotencyKey: 'key3',
        paymentId: 'payment3',
        amountCents: 1000,
        fault: { kind: 'flaky', n: 3 },
      });
      assert.fail('Expected PaymentProviderServerError to be thrown');
    } catch (error) {
      assert.ok(error instanceof PaymentProviderServerError);
    }
  });
});

test('StubPaymentProvider - charged_but_timeout', async (t: TestContext) => {
  const clock = new FakeClock();
  const provider = new StubPaymentProvider(clock);

  await t.test('should record the charge but never settle the promise', async () => {
    void provider.charge({
      idempotencyKey: 'key2',
      paymentId: 'payment2',
      amountCents: 1000,
      fault: { kind: 'charged_but_timeout' },
    });

    assert.strictEqual(provider.wasChargedDespiteTimeout('key2'), true);
  });
});
