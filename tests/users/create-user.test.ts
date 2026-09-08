import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { UserRole, type UserRoleType } from '../../src/common/constants/roles.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { signAccessToken } from '../../src/common/utils/jwt.js';
import { User } from '../../src/modules/users/user.model.js';

describe('POST /api/v1/users', () => {
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

  const createAdminAndLogin = async () => {
    const admin = await createUserInDb({
      name: 'Admin User',
      email: 'admin@test.com',
      password: 'Admin@12345',
      role: UserRole.ADMIN,
    });

    const token = await loginAndGetToken({
      email: 'admin@test.com',
      password: 'Admin@12345',
    });

    return { admin, token };
  };

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const validClientPayload = {
    name: 'Client User',
    email: 'client@test.com',
    password: 'Password1!',
    role: UserRole.CLIENT,
  };

  describe('authentication and authorization', () => {
    it('returns 401 when no authorization header is provided', async () => {
      const response = await request(app).post('/api/v1/users').send(validClientPayload);

      expect(response.status).toBe(401);
      expect(response.body).toMatchObject({
        success: false,
        code: 'UNAUTHORIZED',
      });
    });

    it('returns 401 for an invalid bearer token', async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader('invalid-token'))
        .send(validClientPayload);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 401 when the authenticated user is inactive', async () => {
      const inactiveAdmin = await createUserInDb({
        name: 'Inactive Admin',
        email: 'inactive-admin@test.com',
        password: 'Admin@12345',
        role: UserRole.ADMIN,
        isActive: false,
      });

      const token = signAccessToken({
        sub: inactiveAdmin._id.toString(),
        role: UserRole.ADMIN,
      });

      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send(validClientPayload);

      expect(response.status).toBe(401);
      expect(response.body.code).toBe('UNAUTHORIZED');
    });

    it('returns 403 when an inspection manager attempts to create a user', async () => {
      await createUserInDb({
        name: 'Inspection Manager',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

      const token = await loginAndGetToken({
        mobile: '9876543210',
        password: 'Password1!',
      });

      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send(validClientPayload);

      expect(response.status).toBe(403);
      expect(response.body).toMatchObject({
        success: false,
        code: 'FORBIDDEN',
        message: 'Insufficient permissions',
      });
    });

    it('returns 403 when a client attempts to create a user', async () => {
      await createUserInDb({
        name: 'Client User',
        email: 'client-existing@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      const token = await loginAndGetToken({
        email: 'client-existing@test.com',
        password: 'Password1!',
      });

      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send(validClientPayload);

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });

  describe('successful creation', () => {
    it('creates a procurement manager', async () => {
      const { admin, token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Procurement Manager',
        email: 'pm@test.com',
        password: 'Password1!',
        role: UserRole.PROCUREMENT_MANAGER,
      });

      expect(response.status).toBe(201);
      expect(response.body).toMatchObject({
        success: true,
        message: 'User created successfully',
        data: {
          name: 'Procurement Manager',
          email: 'pm@test.com',
          role: UserRole.PROCUREMENT_MANAGER,
          isActive: true,
        },
      });
      expect(response.body.data.id).toBeDefined();
      expect(response.body.data.password).toBeUndefined();
      expect(response.body.data.createdAt).toBeDefined();

      const savedUser = await User.findById(response.body.data.id);
      expect(savedUser?.createdBy?.toString()).toBe(admin._id.toString());
    });

    it('creates a client', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send(validClientPayload);

      expect(response.status).toBe(201);
      expect(response.body.data.role).toBe(UserRole.CLIENT);
      expect(response.body.data.email).toBe('client@test.com');
    });

    it('creates an inspection manager with mobile only', async () => {
      const { token } = await createAdminAndLogin();

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
      });
      expect(response.body.data.managerId).toBeUndefined();
    });

    it('creates an inspection manager assigned to a procurement manager', async () => {
      const { token } = await createAdminAndLogin();

      const pmResponse = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Procurement Manager',
        email: 'pm-manager@test.com',
        password: 'Password1!',
        role: UserRole.PROCUREMENT_MANAGER,
      });

      const managerId = pmResponse.body.data.id as string;

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: '9123456789',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
        managerId,
      });

      expect(response.status).toBe(201);
      expect(response.body.data.managerId).toBe(managerId);
    });
  });

  describe('validation errors', () => {
    it('returns 400 when name is missing', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        email: 'client@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when name is only whitespace', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: '   ',
        email: 'client@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when password is shorter than 8 characters', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        email: 'client@test.com',
        password: 'short',
        role: UserRole.CLIENT,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when role is missing', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        email: 'client@test.com',
        password: 'Password1!',
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when role is invalid', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        email: 'client@test.com',
        password: 'Password1!',
        role: 'SUPER_ADMIN',
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when client is created without email', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when inspection manager is created without mobile', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid email format', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        email: 'not-an-email',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid mobile format', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: 'abc123',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 for an invalid managerId format', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
        managerId: 'invalid-id',
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when managerId is provided for a client', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Client User',
        email: 'client@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
        managerId: new mongoose.Types.ObjectId().toString(),
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        code: 'BAD_REQUEST',
        message: 'managerId is only allowed for Inspection Manager',
      });
    });

    it('returns 400 when managerId is provided for a procurement manager', async () => {
      const { token } = await createAdminAndLogin();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Procurement Manager',
        email: 'pm@test.com',
        password: 'Password1!',
        role: UserRole.PROCUREMENT_MANAGER,
        managerId: new mongoose.Types.ObjectId().toString(),
      });

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('BAD_REQUEST');
    });
  });

  describe('business rule errors', () => {
    it('returns 404 when managerId does not exist', async () => {
      const { token } = await createAdminAndLogin();
      const missingManagerId = new mongoose.Types.ObjectId().toString();

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
        managerId: missingManagerId,
      });

      expect(response.status).toBe(404);
      expect(response.body).toMatchObject({
        success: false,
        code: 'NOT_FOUND',
        message: 'Manager not found',
      });
    });

    it('returns 400 when managerId references a non-procurement-manager user', async () => {
      const { token } = await createAdminAndLogin();

      const clientResponse = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send(validClientPayload);

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
        managerId: clientResponse.body.data.id,
      });

      expect(response.status).toBe(400);
      expect(response.body).toMatchObject({
        success: false,
        code: 'BAD_REQUEST',
        message: 'managerId must reference a Procurement Manager',
      });
    });
  });

  describe('conflict errors', () => {
    it('returns 409 when email already exists', async () => {
      const { token } = await createAdminAndLogin();

      await request(app).post('/api/v1/users').set(authHeader(token)).send(validClientPayload);

      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(token))
        .send({
          ...validClientPayload,
          name: 'Another Client',
        });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        code: 'CONFLICT',
        message: 'Email already in use',
      });
    });

    it('returns 409 when mobile already exists', async () => {
      const { token } = await createAdminAndLogin();

      await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Inspection Manager',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

      const response = await request(app).post('/api/v1/users').set(authHeader(token)).send({
        name: 'Another Inspector',
        mobile: '9876543210',
        password: 'Password1!',
        role: UserRole.INSPECTION_MANAGER,
      });

      expect(response.status).toBe(409);
      expect(response.body).toMatchObject({
        success: false,
        code: 'CONFLICT',
        message: 'Mobile already in use',
      });
    });
  });
});
