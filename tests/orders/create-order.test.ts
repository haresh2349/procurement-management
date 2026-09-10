import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { UserRole } from '../../src/common/constants/roles.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { User } from '../../src/modules/users/user.model.js';

describe('POST /api/v1/orders', () => {
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

  const loginAndGetToken = async (credentials: {
    email?: string;
    mobile?: string;
    password: string;
  }) => {
    const response = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(response.status).toBe(200);
    return response.body.data.accessToken as string;
  };

  const seedAdminAndLogin = async () => {
    const passwordHash = await hashPassword('Admin@12345');

    await User.create({
      name: 'Admin User',
      email: 'admin@test.com',
      password: passwordHash,
      role: UserRole.ADMIN,
      isActive: true,
    });

    return loginAndGetToken({
      email: 'admin@test.com',
      password: 'Admin@12345',
    });
  };

  const createProcurementManager = async (adminToken: string, email = 'pm@test.com') => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        name: 'Procurement Manager',
        email,
        password: 'Password1!',
        role: UserRole.PROCUREMENT_MANAGER,
      });

    expect(response.status).toBe(201);

    const token = await loginAndGetToken({
      email,
      password: 'Password1!',
    });

    return {
      procurementManagerId: response.body.data.id as string,
      token,
    };
  };

  const createClientForPm = async (pmToken: string, email = 'client@test.com') => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(pmToken))
      .send({
        name: 'Client User',
        email,
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

    expect(response.status).toBe(201);

    return response.body.data.id as string;
  };

  const createInspectionManagerForPm = async (pmToken: string, mobile = '9876543210') => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(pmToken))
      .send({
        name: 'Inspection Manager',
        mobile,
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

    expect(response.status).toBe(201);

    return response.body.data.id as string;
  };

  const setupPmWithClient = async () => {
    const adminToken = await seedAdminAndLogin();
    const { procurementManagerId, token } = await createProcurementManager(adminToken);
    const clientId = await createClientForPm(token);

    return { adminToken, procurementManagerId, token, clientId };
  };

  it('creates an order for a client owned by the procurement manager', async () => {
    const { procurementManagerId, token, clientId } = await setupPmWithClient();

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({ clientId });

    expect(response.status).toBe(201);
    expect(response.body.success).toBe(true);
    expect(response.body.data).toMatchObject({
      clientId,
      procurementManagerId,
      createdBy: procurementManagerId,
      status: OrderStatus.CREATED,
    });
    expect(response.body.data.inspectionManagerId).toBeUndefined();
    expect(response.body.data.orderId).toMatch(/^ORD-\d{4,}$/);
  });

  it('generates sequential order ids starting from ORD-0001', async () => {
    const { token, clientId } = await setupPmWithClient();

    const firstResponse = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({ clientId });

    const secondResponse = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({ clientId });

    expect(firstResponse.body.data.orderId).toBe('ORD-0001');
    expect(secondResponse.body.data.orderId).toBe('ORD-0002');
  });

  it('creates an order with an inspection manager assigned to the procurement manager', async () => {
    const adminToken = await seedAdminAndLogin();
    const { procurementManagerId, token } = await createProcurementManager(adminToken);
    const clientId = await createClientForPm(token);
    const inspectionManagerId = await createInspectionManagerForPm(token);

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({ clientId, inspectionManagerId });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      clientId,
      procurementManagerId,
      inspectionManagerId,
      status: OrderStatus.CREATED,
    });
  });

  it('returns 404 when procurement manager creates an order for another procurement manager client', async () => {
    const adminToken = await seedAdminAndLogin();
    const { token: pm1Token } = await createProcurementManager(adminToken, 'pm1@test.com');
    const { token: pm2Token } = await createProcurementManager(adminToken, 'pm2@test.com');
    const foreignClientId = await createClientForPm(pm2Token, 'client2@test.com');

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(pm1Token))
      .send({ clientId: foreignClientId });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('CLIENT_NOT_FOUND');
  });

  it('returns 404 when procurement manager assigns another procurement manager inspection manager', async () => {
    const { adminToken, token: pm1Token, clientId } = await setupPmWithClient();
    const { token: pm2Token } = await createProcurementManager(adminToken, 'pm2@test.com');
    const foreignInspectionManagerId = await createInspectionManagerForPm(pm2Token, '9123456789');

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(pm1Token))
      .send({
        clientId,
        inspectionManagerId: foreignInspectionManagerId,
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('INSPECTION_MANAGER_NOT_FOUND');
  });

  it('returns 403 when a client attempts to create an order', async () => {
    const { token: pmToken, clientId } = await setupPmWithClient();
    const clientToken = await loginAndGetToken({
      email: 'client@test.com',
      password: 'Password1!',
    });

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(clientToken))
      .send({ clientId });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 403 when an inspection manager attempts to create an order', async () => {
    const { token: pmToken, clientId } = await setupPmWithClient();
    await createInspectionManagerForPm(pmToken);

    const imToken = await loginAndGetToken({
      mobile: '9876543210',
      password: 'Password1!',
    });

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(imToken))
      .send({ clientId });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 403 when admin attempts to create an order', async () => {
    const adminToken = await seedAdminAndLogin();

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(adminToken))
      .send({
        clientId: new mongoose.Types.ObjectId().toString(),
      });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 400 when clientId is invalid', async () => {
    const { token } = await setupPmWithClient();

    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(token))
      .send({ clientId: 'invalid-id' });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 401 when unauthenticated', async () => {
    const response = await request(app).post('/api/v1/orders').send({
      clientId: new mongoose.Types.ObjectId().toString(),
    });

    expect(response.status).toBe(401);
    expect(response.body.code).toBe('UNAUTHORIZED');
  });
});
