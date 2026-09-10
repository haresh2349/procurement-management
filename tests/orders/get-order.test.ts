import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { seedOrderTestFixture } from './order-test-fixture.js';

describe('GET /api/v1/orders/:orderId', () => {
  jest.setTimeout(30000);

  let mongoServer: MongoMemoryServer;
  const app = createApp();

  beforeAll(async () => {
    process.env.JWT_SECRET = 'test-jwt-secret';
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Order.deleteMany({});
    await OrderCounter.deleteMany({});
    await User.deleteMany({});
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('allows admin to read any order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmBId}`)
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.orderId).toBe(fixture.orderPmBId);
  });

  it('allows procurement manager to read their own order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}`)
      .set(authHeader(fixture.pmAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.procurementManagerId).toBe(fixture.pmAId);
  });

  it('returns 404 when procurement manager reads another procurement manager order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmBId}`)
      .set(authHeader(fixture.pmAToken));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('allows assigned inspection manager to read the order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}`)
      .set(authHeader(fixture.imAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.inspectionManagerId).toBe(fixture.imAId);
  });

  it('returns 404 when inspection manager reads an unassigned order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmBId}`)
      .set(authHeader(fixture.imAToken));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('allows client to read their own order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}`)
      .set(authHeader(fixture.clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.clientId).toBe(fixture.clientAId);
  });

  it('returns 404 when client reads another client order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmBId}`)
      .set(authHeader(fixture.clientAToken));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 when order does not exist', async () => {
    const fixture = await seedOrderTestFixture(app);
    const response = await request(app)
      .get('/api/v1/orders/ORD-9999')
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 400 when order id is invalid', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders/invalid-id')
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app).get(`/api/v1/orders/${fixture.orderPmAId}`);

    expect(response.status).toBe(401);
  });
});
