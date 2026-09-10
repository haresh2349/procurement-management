import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import { ChecklistTemplate } from '../../src/modules/checklist-templates/checklist-template.model.js';
import { OrderChecklist } from '../../src/modules/orders/order-checklist.model.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { User } from '../../src/modules/users/user.model.js';
import {
  seedChecklistTemplateForClient,
  seedOrderTestFixture,
} from './order-test-fixture.js';

describe('POST /api/v1/orders/:orderId/checklist', () => {
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
    await ChecklistTemplate.deleteMany({});
    await Order.deleteMany({});
    await OrderCounter.deleteMany({});
    await User.deleteMany({});
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  it('attaches a checklist template and creates an immutable order checklist snapshot', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(201);
    expect(response.body.data).toMatchObject({
      orderId: fixture.orderPmAId,
      checklistTemplateId: templateId,
      templateVersion: 1,
      checklistName: 'Vehicle Inspection Checklist',
      answers: [],
    });
    expect(response.body.data.questionsSnapshot).toHaveLength(2);
    expect(response.body.data.questionsSnapshot[0]).toMatchObject({
      id: 'q1',
      label: 'Is equipment operational?',
      type: QuestionType.BOOLEAN,
      required: true,
      order: 1,
    });

    const savedChecklist = await OrderChecklist.findOne({ orderId: fixture.orderPmAId });
    expect(savedChecklist).not.toBeNull();
    expect(savedChecklist?.questionsSnapshot).toHaveLength(2);
  });

  it('allows admin to attach a checklist while order is CREATED', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.adminToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(201);
    expect(response.body.data.orderId).toBe(fixture.orderPmAId);
  });

  it('returns 400 when checklist belongs to a different client', async () => {
    const fixture = await seedOrderTestFixture(app);
    const foreignTemplateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientBId,
      createdBy: fixture.pmBId,
      name: 'Client B Checklist',
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.adminToken))
      .send({ checklistTemplateId: foreignTemplateId });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('CHECKLIST_CLIENT_MISMATCH');
  });

  it('returns 409 when attaching a checklist to the same order twice', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const firstResponse = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken))
      .send({ checklistTemplateId: templateId });

    expect(firstResponse.status).toBe(201);

    const secondTemplateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
      name: 'Second Checklist',
    });

    const secondResponse = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken))
      .send({ checklistTemplateId: secondTemplateId });

    expect(secondResponse.status).toBe(409);
    expect(secondResponse.body.code).toBe('ORDER_CHECKLIST_ALREADY_ATTACHED');
  });

  it('keeps the existing order checklist unchanged when the template is updated later', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken))
      .send({ checklistTemplateId: templateId });

    await ChecklistTemplate.findByIdAndUpdate(templateId, {
      version: 2,
      questions: [
        {
          id: 'q1',
          label: 'Updated question',
          type: QuestionType.TEXT,
          required: true,
          order: 1,
        },
        {
          id: 'q3',
          label: 'New question',
          type: QuestionType.BOOLEAN,
          required: false,
          order: 2,
        },
      ],
    });

    const savedChecklist = await OrderChecklist.findOne({ orderId: fixture.orderPmAId });

    expect(savedChecklist?.templateVersion).toBe(1);
    expect(savedChecklist?.questionsSnapshot).toHaveLength(2);
    expect(savedChecklist?.questionsSnapshot[0].label).toBe('Is equipment operational?');
    expect(savedChecklist?.questionsSnapshot.some((question) => question.id === 'q3')).toBe(false);
  });

  it('returns 400 when attaching checklist after inspection has started', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientBId,
      createdBy: fixture.pmBId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmBId}/checklist`)
      .set(authHeader(fixture.pmBToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('ORDER_INSPECTION_ALREADY_STARTED');
  });

  it('returns 404 when procurement manager attaches to another procurement manager order', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmBToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_NOT_FOUND');
  });

  it('returns 404 when procurement manager uses another procurement manager checklist template', async () => {
    const fixture = await seedOrderTestFixture(app);
    const foreignTemplateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const orderResponse = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(fixture.pmBToken))
      .send({ clientId: fixture.clientBId });

    expect(orderResponse.status).toBe(201);

    const response = await request(app)
      .post(`/api/v1/orders/${orderResponse.body.data.orderId}/checklist`)
      .set(authHeader(fixture.pmBToken))
      .send({ checklistTemplateId: foreignTemplateId });

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('CHECKLIST_NOT_FOUND');
  });

  it('returns 403 when inspection manager attempts to attach a checklist', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.imAToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(403);
  });

  it('returns 403 when client attempts to attach a checklist', async () => {
    const fixture = await seedOrderTestFixture(app);
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
    });

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.clientAToken))
      .send({ checklistTemplateId: templateId });

    expect(response.status).toBe(403);
  });
});
