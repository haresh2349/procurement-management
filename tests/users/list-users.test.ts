import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { UserRole, type UserRoleType } from '../../src/common/constants/roles.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { User } from '../../src/modules/users/user.model.js';

describe('User listing and assignment APIs', () => {
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
    await User.deleteMany({});
  });

  const createUserInDb = async (input: {
    name: string;
    email?: string;
    mobile?: string;
    password: string;
    role: UserRoleType;
    managerId?: string;
    createdBy?: string;
    isActive?: boolean;
  }) => {
    const passwordHash = await hashPassword(input.password);

    return User.create({
      name: input.name,
      email: input.email,
      mobile: input.mobile,
      password: passwordHash,
      role: input.role,
      managerId: input.managerId,
      createdBy: input.createdBy,
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
    return response.body.data.accessToken as string;
  };

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const seedOwnershipFixture = async () => {
    const admin = await createUserInDb({
      name: 'Admin',
      email: 'admin@test.com',
      password: 'Admin@12345',
      role: UserRole.ADMIN,
    });

    const adminToken = await loginAndGetToken({
      email: 'admin@test.com',
      password: 'Admin@12345',
    });

    const pmA = await createUserInDb({
      name: 'PM A',
      email: 'pma@test.com',
      password: 'Password1!',
      role: UserRole.PROCUREMENT_MANAGER,
      createdBy: admin._id.toString(),
    });

    const pmB = await createUserInDb({
      name: 'PM B',
      email: 'pmb@test.com',
      password: 'Password1!',
      role: UserRole.PROCUREMENT_MANAGER,
      createdBy: admin._id.toString(),
    });

    const clientByPmA = await createUserInDb({
      name: 'Client PM A',
      email: 'client-pma@test.com',
      password: 'Password1!',
      role: UserRole.CLIENT,
      createdBy: pmA._id.toString(),
    });

    const clientByAdmin = await createUserInDb({
      name: 'Client Admin',
      email: 'client-admin@test.com',
      password: 'Password1!',
      role: UserRole.CLIENT,
      createdBy: admin._id.toString(),
    });

    const imForPmA = await createUserInDb({
      name: 'IM PM A',
      mobile: '9111111111',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
      managerId: pmA._id.toString(),
      createdBy: pmA._id.toString(),
    });

    const imForPmB = await createUserInDb({
      name: 'IM PM B',
      mobile: '9222222222',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
      managerId: pmB._id.toString(),
      createdBy: pmB._id.toString(),
    });

    const imUnassigned = await createUserInDb({
      name: 'IM Unassigned',
      mobile: '9333333333',
      password: 'Password1!',
      role: UserRole.INSPECTION_MANAGER,
      createdBy: admin._id.toString(),
    });

    const pmAToken = await loginAndGetToken({ email: 'pma@test.com', password: 'Password1!' });
    const pmBToken = await loginAndGetToken({ email: 'pmb@test.com', password: 'Password1!' });

    return {
      adminToken,
      pmAId: pmA._id.toString(),
      pmBId: pmB._id.toString(),
      pmAToken,
      pmBToken,
      clientByPmAId: clientByPmA._id.toString(),
      clientByAdminId: clientByAdmin._id.toString(),
      imForPmAId: imForPmA._id.toString(),
      imForPmBId: imForPmB._id.toString(),
      imUnassignedId: imUnassigned._id.toString(),
    };
  };

  describe('GET /api/v1/users', () => {
    it('allows admin to list procurement managers, inspection managers, and clients', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app).get('/api/v1/users').set(authHeader(fixture.adminToken));

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);

      const roles = response.body.data.items.map((user: { role: string }) => user.role);
      expect(roles).toEqual(
        expect.arrayContaining([
          UserRole.PROCUREMENT_MANAGER,
          UserRole.INSPECTION_MANAGER,
          UserRole.CLIENT,
        ]),
      );
      expect(roles).not.toContain(UserRole.ADMIN);
      expect(response.body.data.items).toHaveLength(7);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 20,
        total: 7,
        totalPages: 1,
      });
    });

    it('allows procurement manager A to see only their clients and inspection managers', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app).get('/api/v1/users').set(authHeader(fixture.pmAToken));

      expect(response.status).toBe(200);

      const ids = response.body.data.items.map((user: { id: string }) => user.id);
      expect(ids).toEqual(expect.arrayContaining([fixture.clientByPmAId, fixture.imForPmAId]));
      expect(ids).not.toContain(fixture.clientByAdminId);
      expect(ids).not.toContain(fixture.imForPmBId);
      expect(ids).not.toContain(fixture.imUnassignedId);
      expect(response.body.data.items).toHaveLength(2);
    });

    it('returns 403 for clients', async () => {
      await createUserInDb({
        name: 'Client',
        email: 'client@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

      const token = await loginAndGetToken({ email: 'client@test.com', password: 'Password1!' });

      const response = await request(app).get('/api/v1/users').set(authHeader(token));

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('filters clients for admin using role query param', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: UserRole.CLIENT })
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
      expect(
        response.body.data.items.every((user: { role: string }) => user.role === UserRole.CLIENT),
      ).toBe(true);
      expect(response.body.data.pagination.total).toBe(2);
    });

    it('filters clients for procurement manager within ownership scope', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: UserRole.CLIENT })
        .set(authHeader(fixture.pmAToken));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].id).toBe(fixture.clientByPmAId);
    });

    it('filters inspection managers for procurement manager within ownership scope', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: UserRole.INSPECTION_MANAGER })
        .set(authHeader(fixture.pmAToken));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(1);
      expect(response.body.data.items[0].id).toBe(fixture.imForPmAId);
    });

    it('returns empty list when procurement manager filters by procurement manager role', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: UserRole.PROCUREMENT_MANAGER })
        .set(authHeader(fixture.pmAToken));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(0);
      expect(response.body.data.pagination.total).toBe(0);
    });

    it('paginates results', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ page: 1, limit: 2 })
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data.items).toHaveLength(2);
      expect(response.body.data.pagination).toMatchObject({
        page: 1,
        limit: 2,
        total: 7,
        totalPages: 4,
      });
    });

    it('returns 400 for invalid role filter', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ role: 'INVALID_ROLE' })
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });

    it('returns 400 when limit exceeds maximum', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get('/api/v1/users')
        .query({ limit: 101 })
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(400);
      expect(response.body.code).toBe('VALIDATION_ERROR');
    });
  });

  describe('GET /api/v1/users/:id', () => {
    it('allows admin to get any listable user by id', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get(`/api/v1/users/${fixture.imForPmBId}`)
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data.id).toBe(fixture.imForPmBId);
    });

    it('returns 404 when procurement manager B requests inspection manager of manager A', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get(`/api/v1/users/${fixture.imForPmAId}`)
        .set(authHeader(fixture.pmBToken));

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });

    it('returns 404 when procurement manager requests a client created by admin', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .get(`/api/v1/users/${fixture.clientByAdminId}`)
        .set(authHeader(fixture.pmAToken));

      expect(response.status).toBe(404);
      expect(response.body.code).toBe('NOT_FOUND');
    });
  });

  describe('PATCH /api/v1/users/:inspectionManagerId/assign', () => {
    it('allows admin to assign an inspection manager to a procurement manager', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .patch(`/api/v1/users/${fixture.imUnassignedId}/assign`)
        .set(authHeader(fixture.adminToken))
        .send({ managerId: fixture.pmAId });

      expect(response.status).toBe(200);
      expect(response.body.data.managerId).toBe(fixture.pmAId);
    });

    it('returns 403 when procurement manager attempts to assign', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .patch(`/api/v1/users/${fixture.imUnassignedId}/assign`)
        .set(authHeader(fixture.pmAToken))
        .send({ managerId: fixture.pmAId });

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });

    it('returns 400 when target user is not an inspection manager', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .patch(`/api/v1/users/${fixture.clientByAdminId}/assign`)
        .set(authHeader(fixture.adminToken))
        .send({ managerId: fixture.pmAId });

      expect(response.status).toBe(400);
      expect(response.body.message).toBe(
        'Only Inspection Manager users can be assigned or unassigned',
      );
    });
  });

  describe('PATCH /api/v1/users/:inspectionManagerId/unassign', () => {
    it('allows admin to unassign an inspection manager', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .patch(`/api/v1/users/${fixture.imForPmAId}/unassign`)
        .set(authHeader(fixture.adminToken));

      expect(response.status).toBe(200);
      expect(response.body.data.managerId).toBeUndefined();

      const saved = await User.findById(fixture.imForPmAId);
      expect(saved?.managerId).toBeUndefined();
    });

    it('returns 403 when procurement manager attempts to unassign', async () => {
      const fixture = await seedOwnershipFixture();

      const response = await request(app)
        .patch(`/api/v1/users/${fixture.imForPmAId}/unassign`)
        .set(authHeader(fixture.pmBToken));

      expect(response.status).toBe(403);
      expect(response.body.code).toBe('FORBIDDEN');
    });
  });
});
