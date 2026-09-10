import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { seedOrderTestFixture } from './order-test-fixture.js';

describe('GET /api/v1/orders', () => {
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

  it('allows admin to list all orders', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders')
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(2);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 20,
      total: 2,
      totalPages: 1,
    });
  });

  it('allows procurement manager to list only their own orders', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders')
      .set(authHeader(fixture.pmAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].orderId).toBe(fixture.orderPmAId);
    expect(response.body.data.items[0].procurementManagerId).toBe(fixture.pmAId);
  });

  it('allows inspection manager to list only assigned orders', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders')
      .set(authHeader(fixture.imAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].orderId).toBe(fixture.orderPmAId);
    expect(response.body.data.items[0].inspectionManagerId).toBe(fixture.imAId);
  });

  it('allows client to list only their own orders', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders')
      .set(authHeader(fixture.clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].clientId).toBe(fixture.clientAId);
  });

  it('does not expose another client orders when client passes foreign clientId filter', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders?clientId=${fixture.clientBId}`)
      .set(authHeader(fixture.clientAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].clientId).toBe(fixture.clientAId);
  });

  it('filters orders by status without bypassing authorization', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders?status=${OrderStatus.INSPECTION_IN_PROGRESS}`)
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.items[0].orderId).toBe(fixture.orderPmBId);
  });

  it('supports pagination', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get('/api/v1/orders?page=1&limit=1')
      .set(authHeader(fixture.adminToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination).toMatchObject({
      page: 1,
      limit: 1,
      total: 2,
      totalPages: 2,
    });
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app).get('/api/v1/orders');

    expect(response.status).toBe(401);
  });
});
