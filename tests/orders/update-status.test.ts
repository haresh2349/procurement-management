import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { OrderChecklist } from '../../src/modules/orders/order-checklist.model.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { completeInspectionForOrder } from '../../src/modules/orders/order.service.js';
import { User } from '../../src/modules/users/user.model.js';
import { seedOrderChecklistForOrder, seedOrderTestFixture } from './order-test-fixture.js';

describe('PATCH /api/v1/orders/:orderId/status', () => {
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

  it('allows assigned inspection manager to start inspection when checklist exists', async () => {
    const fixture = await seedOrderTestFixture(app);
    await seedOrderChecklistForOrder(fixture.orderPmAId);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(OrderStatus.INSPECTION_IN_PROGRESS);
  });

  it('returns 400 when starting inspection without an assigned inspection manager', async () => {
    const fixture = await seedOrderTestFixture(app);

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(fixture.pmBToken))
      .send({ clientId: fixture.clientBId });

    expect(orderResponse.status).toBe(201);

    const orderId = orderResponse.body.data.orderId as string;
    await seedOrderChecklistForOrder(orderId);

    const response = await request(app)
      .patch(`/api/v1/orders/${orderId}/status`)
      .set(authHeader(fixture.imBToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ORDER_HAS_NO_INSPECTION_MANAGER');
  });

  it('returns 400 when starting inspection without a checklist', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ORDER_HAS_NO_CHECKLIST');
  });

  it('returns 400 for invalid transition CREATED to COMPLETED', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.pmAToken))
      .send({ status: OrderStatus.COMPLETED });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
  });

  it('allows procurement manager to approve an inspection-completed order', async () => {
    const fixture = await seedOrderTestFixture(app);
    await seedOrderChecklistForOrder(fixture.orderPmAId);

    await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    await completeInspectionForOrder(fixture.imAId, fixture.orderPmAId);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.pmAToken))
      .send({ status: OrderStatus.APPROVED });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(OrderStatus.APPROVED);
  });

  it('allows procurement manager to cancel a created order', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.pmAToken))
      .send({ status: OrderStatus.CANCELLED });

    expect(response.status).toBe(200);
    expect(response.body.data.status).toBe(OrderStatus.CANCELLED);
  });

  it('returns 400 when cancelling a completed order', async () => {
    const fixture = await seedOrderTestFixture(app);

    await Order.findOneAndUpdate({ orderId: fixture.orderPmAId }, { status: OrderStatus.COMPLETED });

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.pmAToken))
      .send({ status: OrderStatus.CANCELLED });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
  });

  it('rejects inspection completion through public status endpoint', async () => {
    const fixture = await seedOrderTestFixture(app);
    await seedOrderChecklistForOrder(fixture.orderPmAId);

    await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_COMPLETED });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_ORDER_STATUS_TRANSITION');
  });

  it('returns 403 when client attempts to update status', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.clientAToken))
      .send({ status: OrderStatus.CANCELLED });

    expect(response.status).toBe(403);
  });

  it('returns 403 when procurement manager attempts to start inspection', async () => {
    const fixture = await seedOrderTestFixture(app);
    await seedOrderChecklistForOrder(fixture.orderPmAId);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.pmAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    expect(response.status).toBe(403);
  });
});
