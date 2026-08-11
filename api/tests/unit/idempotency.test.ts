import { test } from 'node:test';
import assert from 'node:assert/strict';
import express from 'express';
import supertest from 'supertest';

import { idempotencyMiddleware } from '../../src/middleware/idempotency.ts';
import { InMemoryIdempotencyRepository } from '../../src/repository/idempotency.memory.ts';
import { FakeClock } from '../../src/resilience/clock.ts';

test('idempotencyMiddleware - falta el header Idempotency-Key', async () => {
  const repo = new InMemoryIdempotencyRepository();
  const clock = new FakeClock();

  const app = express();
  app.use(express.json());
  app.post(
    '/widgets',
    idempotencyMiddleware(repo, clock, { endpoint: 'POST /widgets', ttlMs: 60_000 }),
    (_req, res) => res.status(201).json({ ok: true }),
  );

  const response = await supertest(app).post('/widgets').send({ data: 'test' });

  assert.strictEqual(response.status, 400);
});

test('IdempotencyMiddleware - should replay the original response on second request with same Idempotency-Key', async () => {
  const repo = new InMemoryIdempotencyRepository();
  const clock = new FakeClock();

  let handled = 0;
  const app = express();
  app.use(express.json());
  app.post(
    '/widgets',
    idempotencyMiddleware(repo, clock, { endpoint: 'POST /widgets', ttlMs: 60_000 }),
    (_req, res) => {
      handled++;
      res.status(201).json({ ok: true });
    },
  );

  const idempotencyKey = 'test-key';

  // First request
  const firstResponse = await supertest(app)
    .post('/widgets')
    .set('Idempotency-Key', idempotencyKey)
    .send({ data: 'test' });

  assert.strictEqual(firstResponse.status, 201);
  assert.deepStrictEqual(firstResponse.body, { ok: true });
  assert.strictEqual(handled, 1);

  // Second request with the same Idempotency-Key: réplay, el handler no debe volver a correr
  const secondResponse = await supertest(app)
    .post('/widgets')
    .set('Idempotency-Key', idempotencyKey)
    .send({ data: 'test' });

  assert.strictEqual(secondResponse.status, 201);
  assert.deepStrictEqual(secondResponse.body, { ok: true });
  assert.strictEqual(handled, 1);
});


test('IdempotencyMiddleware - should return 422 on second request with different body and same Idempotency-Key', async () => {
  const repo = new InMemoryIdempotencyRepository();
  const clock = new FakeClock();

  const app = express();
  app.use(express.json());
  app.post(
    '/widgets',
    idempotencyMiddleware(repo, clock, { endpoint: 'POST /widgets', ttlMs: 60_000 }),
    (_req, res) => res.status(201).json({ ok: true }),
  );

  const idempotencyKey = 'test-key';

  // First request
  const firstResponse = await supertest(app)
    .post('/widgets')
    .set('Idempotency-Key', idempotencyKey)
    .send({ data: 'test' });

  assert.strictEqual(firstResponse.status, 201);
  assert.deepStrictEqual(firstResponse.body, { ok: true });

  // Second request with the same Idempotency-Key but different body
  const secondResponse = await supertest(app)
    .post('/widgets')
    .set('Idempotency-Key', idempotencyKey)
    .send({ data: 'different-test' });

  assert.strictEqual(secondResponse.status, 422);
  assert.deepStrictEqual(secondResponse.body, { error: 'Idempotency-Key ya usada con un payload distinto' });
});