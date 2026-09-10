import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { UserRole } from '../../src/common/constants/roles.js';
import { OrderChecklist } from '../../src/modules/orders/order-checklist.model.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { User } from '../../src/modules/users/user.model.js';
import { seedOrderTestFixture } from './order-test-fixture.js';

describe('PATCH /api/v1/orders/:orderId/inspection-manager', () => {
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
    await OrderChecklist.deleteMany({});
    await Order.deleteMany({});
    await OrderCounter.deleteMany({});
    await User.deleteMany({});
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('allows procurement manager to assign their own inspection manager', async () => {
    const fixture = await seedOrderTestFixture(app);

    const createImResponse = await request(app)
      .post('/api/v1/users')
      .set(authHeader(fixture.pmAToken))
      .send({
        name: 'IM A2',
        mobile: '9333333333',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

    expect(createImResponse.status).toBe(201);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/inspection-manager`)
      .set(authHeader(fixture.pmAToken))
      .send({ inspectionManagerId: createImResponse.body.data.id });

    expect(response.status).toBe(200);
    expect(response.body.data.inspectionManagerId).toBe(createImResponse.body.data.id);
  });

  it('allows admin to assign inspection manager while order is CREATED', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/inspection-manager`)
      .set(authHeader(fixture.adminToken))
      .send({ inspectionManagerId: fixture.imAId });

    expect(response.status).toBe(200);
    expect(response.body.data.inspectionManagerId).toBe(fixture.imAId);
  });

  it('returns 404 when procurement manager assigns another procurement manager inspection manager', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/inspection-manager`)
      .set(authHeader(fixture.pmAToken))
      .send({ inspectionManagerId: fixture.imBId });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('INSPECTION_MANAGER_NOT_FOUND');
  });

  it('returns 400 when changing inspection manager after inspection has started', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmBId}/inspection-manager`)
      .set(authHeader(fixture.pmBToken))
      .send({ inspectionManagerId: fixture.imBId });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ORDER_INSPECTION_ALREADY_STARTED');
  });

  it('returns 404 when procurement manager assigns on another procurement manager order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmBId}/inspection-manager`)
      .set(authHeader(fixture.pmAToken))
      .send({ inspectionManagerId: fixture.imAId });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 403 when inspection manager attempts to assign', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/inspection-manager`)
      .set(authHeader(fixture.imAToken))
      .send({ inspectionManagerId: fixture.imAId });

    expect(response.status).toBe(403);
  });

  it('returns 403 when client attempts to assign', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/inspection-manager`)
      .set(authHeader(fixture.clientAToken))
      .send({ inspectionManagerId: fixture.imAId });

    expect(response.status).toBe(403);
  });
});
