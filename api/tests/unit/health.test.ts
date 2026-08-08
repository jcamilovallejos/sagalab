import {test} from 'node:test';
import assert from 'node:assert/strict';
import supertest from 'supertest';
import {buildApp} from '../../src/app.ts';
import type {Env} from '../../src/config/env.ts';


test('GET /health should return 200 OK', async () => {
  const env = {
    NODE_ENV: 'test' as Env['NODE_ENV'],
    PORT: 3000,
    DATABASE_URL: 'http://localhost:5432/testdb',
    RABBITMQ_URL: 'amqp://localhost:5672',
    CORS_ORIGINS: ['http://localhost'],
  };

  const app = buildApp(env);
  const request = supertest(app);

  const response = await request.get('/health');

  assert.strictEqual(response.status, 200);
  assert.strictEqual(response.body.status, 'ok');
});