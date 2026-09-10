import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { Order } from '../../src/modules/orders/order.model.js';

describe('Order model', () => {
  jest.setTimeout(30000);

  let mongoServer: MongoMemoryServer;

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await Order.deleteMany({});
  });

  it('creates an order with CREATED status by default', async () => {
    const clientId = new mongoose.Types.ObjectId();
    const procurementManagerId = new mongoose.Types.ObjectId();

    const order = await Order.create({
      orderId: 'ORD-0001',
      clientId,
      procurementManagerId,
      createdBy: procurementManagerId,
    });

    expect(order.orderId).toBe('ORD-0001');
    expect(order.status).toBe(OrderStatus.CREATED);
    expect(order.inspectionManagerId).toBeUndefined();
    expect(order._id).toBeDefined();
  });

  it('persists optional inspectionManagerId', async () => {
    const clientId = new mongoose.Types.ObjectId();
    const procurementManagerId = new mongoose.Types.ObjectId();
    const inspectionManagerId = new mongoose.Types.ObjectId();

    const order = await Order.create({
      orderId: 'ORD-0002',
      clientId,
      procurementManagerId,
      inspectionManagerId,
      createdBy: procurementManagerId,
    });

    expect(order.inspectionManagerId?.toString()).toBe(inspectionManagerId.toString());
  });
});
