import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import { ChecklistTemplate } from '../../src/modules/checklist-templates/checklist-template.model.js';
import { UserRole } from '../../src/common/constants/roles.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { User } from '../../src/modules/users/user.model.js';

describe('Checklist template APIs', () => {
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
    await ChecklistTemplate.deleteMany({});
    await User.deleteMany({});
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const seedUsers = async () => {
    const adminPassword = await hashPassword('Admin@12345');
    const userPassword = await hashPassword('Password1!');

    const admin = await User.create({
      name: 'Admin',
      email: 'admin@test.com',
      password: adminPassword,
      role: UserRole.ADMIN,
      isActive: true,
    });

    const pm = await User.create({
      name: 'PM',
      email: 'pm@test.com',
      password: userPassword,
      role: UserRole.PROCUREMENT_MANAGER,
      createdBy: admin._id,
      isActive: true,
    });

    const client = await User.create({
      name: 'Client',
      email: 'client@test.com',
      password: userPassword,
      role: UserRole.CLIENT,
      createdBy: pm._id,
      isActive: true,
    });

    const adminLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'admin@test.com', password: 'Admin@12345' });
    const pmLogin = await request(app)
      .post('/api/v1/auth/login')
      .send({ email: 'pm@test.com', password: 'Password1!' });

    return {
      clientId: client._id.toString(),
      adminToken: adminLogin.body.data.accessToken as string,
      pmToken: pmLogin.body.data.accessToken as string,
    };
  };

  it('allows procurement manager to create a checklist template for own client', async () => {
    const { clientId, pmToken } = await seedUsers();

    const response = await request(app)
      .post('/api/v1/checklist-templates')
      .set(authHeader(pmToken))
      .send({
        name: 'Vehicle Inspection Checklist',
        clientId,
        questions: [
          {
            label: 'Is the vehicle roadworthy?',
            type: QuestionType.BOOLEAN,
            required: true,
            order: 1,
          },
        ],
      });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      name: 'Vehicle Inspection Checklist',
      clientId,
      version: 1,
      isDefault: false,
    });
    expect(response.body.data.questions).toHaveLength(1);
    expect(response.body.data.questions[0].id).toBeTruthy();
  });

  it('returns 404 when procurement manager creates checklist for another procurement manager client', async () => {
    const { adminToken, pmToken } = await seedUsers();

    const foreignClientResponse = await request(app)
      .post('/api/v1/users')
      .set(authHeader(adminToken))
      .send({
        name: 'Foreign Client',
        email: 'foreign-client@test.com',
        password: 'Password1!',
        role: UserRole.CLIENT,
      });

    const response = await request(app)
      .post('/api/v1/checklist-templates')
      .set(authHeader(pmToken))
      .send({
        name: 'Foreign Checklist',
        clientId: foreignClientResponse.body.data.id,
        questions: [
          {
            label: 'Check',
            type: QuestionType.BOOLEAN,
            required: true,
            order: 1,
          },
        ],
      });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('CLIENT_NOT_FOUND');
  });

  it('increments version when checklist questions change', async () => {
    const { clientId, pmToken } = await seedUsers();

    const createResponse = await request(app)
      .post('/api/v1/checklist-templates')
      .set(authHeader(pmToken))
      .send({
        name: 'Inspection Checklist',
        clientId,
        questions: [
          {
            label: 'Original question',
            type: QuestionType.TEXT,
            required: true,
            order: 1,
          },
        ],
      });

    const templateId = createResponse.body.data.id as string;
    const questionId = createResponse.body.data.questions[0].id as string;

    const updateResponse = await request(app)
      .patch(`/api/v1/checklist-templates/${templateId}`)
      .set(authHeader(pmToken))
      .send({
        questions: [
          {
            id: questionId,
            label: 'Updated question',
            type: QuestionType.TEXT,
            required: true,
            order: 1,
          },
        ],
      });

    expect(updateResponse.status).toBe(200);
    expect(updateResponse.body.data.version).toBe(2);
    expect(updateResponse.body.data.questions[0].label).toBe('Updated question');
  });

  it('lists checklist templates for procurement manager', async () => {
    const { clientId, pmToken } = await seedUsers();

    await request(app)
      .post('/api/v1/checklist-templates')
      .set(authHeader(pmToken))
      .send({
        name: 'Checklist A',
        clientId,
        questions: [
          {
            label: 'Question',
            type: QuestionType.BOOLEAN,
            required: true,
            order: 1,
          },
        ],
      });

    const response = await request(app)
      .get('/api/v1/checklist-templates')
      .set(authHeader(pmToken));

    expect(response.status).toBe(200);
    expect(response.body.data.items).toHaveLength(1);
    expect(response.body.data.pagination.total).toBe(1);
  });
});
