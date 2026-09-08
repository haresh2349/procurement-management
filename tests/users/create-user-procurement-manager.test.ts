import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { UserRole, type UserRoleType } from '../../src/common/constants/roles.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { User } from '../../src/modules/users/user.model.js';

describe('POST /api/v1/users (Procurement Manager)', () => {
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
    await User.deleteMany({});
  });

  const createUserInDb = async (input: {
    name: string;
    email?: string;
    mobile?: string;
    password: string;
    role: UserRoleType;
    isActive?: boolean;
  }) => {
    const passwordHash = await hashPassword(input.password);

    return User.create({
      name: input.name,
      email: input.email,
      mobile: input.mobile,
      password: passwordHash,
      role: input.role,
      isActive: input.isActive ?? true,
    });
  };

  const loginAndGetToken = async (credentials: {
    email?: string;
    mobile?: string;
    password: string;
  }) => {
    const response = await request(app).post('/api/v1/auth/login').send(credentials);

    expect(response.status).toBe(200);
    expect(response.body.success).toBe(true);

    return response.body.data.accessToken as string;
  };

  const createProcurementManagerAndLogin = async () => {
    await createUserInDb({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Admin@12345',
      role: UserRole.ADMIN,
    });

    const adminToken = await loginAndGetToken({
      email: 'admin@test.com',
      password: 'Admin@12345',
    });

    const pmResponse = await request(app)
      .post('/api/v1/users')
      .set({ Authorization: `Bearer ${adminToken}` })
      .send({
        name: 'Procurement Manager',
        email: 'pm@test.com',
        password: 'Password1!',
        role: UserRole.PROCUREMENT_MANAGER,
      });

    expect(pmResponse.status).toBe(201);

    const token = await loginAndGetToken({
      email: 'pm@test.com',
      password: 'Password1!',
    });

    return {
      procurementManagerId: pmResponse.body.data.id as string,
      token,
    };
  };

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('creates a client when called by procurement manager', async () => {
    const { token } = await createProcurementManagerAndLogin();

    const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
      name: 'Client User',
      email: 'client@test.com',
      password: 'Password1!',
      role: UserRole.CLIENT,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Client User',
      email: 'client@test.com',
      role: UserRole.CLIENT,
      isActive: true,
    });
    expect(response.body.data.managerId).toBeUndefined();
  });

  it('creates an inspection manager assigned to the calling procurement manager', async () => {
    const { procurementManagerId, token } = await createProcurementManagerAndLogin();

    const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
      name: 'Inspection Manager',
      mobile: '9876543210',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
    });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Inspection Manager',
      mobile: '9876543210',
      role: UserRole.INSPECTION_MANAGER,
      managerId: procurementManagerId,
    });

    const savedUser = await User.findById(response.body.data.id);
    expect(savedUser?.managerId?.toString()).toBe(procurementManagerId);
    expect(savedUser?.createdBy?.toString()).toBe(procurementManagerId);
  });

  it('returns 400 when procurement manager sends managerId in request body', async () => {
    const { token } = await createProcurementManagerAndLogin();

    const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
      name: 'Inspection Manager',
      mobile: '9876543210',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
      managerId: new mongoose.Types.ObjectId().toString(),
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 400 when procurement manager tries to create another procurement manager', async () => {
    const { token } = await createProcurementManagerAndLogin();

    const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
      name: 'Another Procurement Manager',
      email: 'pm2@test.com',
      password: 'Password1!',
      role: UserRole.PROCUREMENT_MANAGER,
    });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('VALIDATION_ERROR');
  });

  it('returns 409 when email already exists', async () => {
    const { token } = await createProcurementManagerAndLogin();

    const payload = {
      name: 'Client User',
      email: 'client@test.com',
      password: 'Password1!',
      role: UserRole.CLIENT,
    };

    await request(app).post('/api/v1/users').set(authHeader(token)).send(payload);

    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(token))
      .send({
        ...payload,
        name: 'Another Client',
      });

    expect(response.status).toBe(409);
    expect(response.body.message).toBe('Email already in use');
  });

  it('does not create a user when procurement manager sends managerId', async () => {
    const { token } = await createProcurementManagerAndLogin();

    const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
      name: 'Inspection Manager',
      mobile: '9123456789',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
      managerId: new mongoose.Types.ObjectId().toString(),
    });

    expect(response.status).toBe(400);

    const inspectionManager = await User.findOne({ mobile: '9123456789' });
    expect(inspectionManager).toBeNull();
  });
});
