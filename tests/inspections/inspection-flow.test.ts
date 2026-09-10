import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import request from 'supertest';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { createApp } from '../../src/app.js';
import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import { ChecklistTemplate } from '../../src/modules/checklist-templates/checklist-template.model.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { OrderChecklist } from '../../src/modules/orders/order-checklist.model.js';
import { OrderCounter } from '../../src/modules/orders/order-counter.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { File } from '../../src/modules/files/file.model.js';
import { User } from '../../src/modules/users/user.model.js';
import {
  seedChecklistTemplateForClient,
  seedOrderTestFixture,
} from '../orders/order-test-fixture.js';

describe('Inspection APIs', () => {
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
    await File.deleteMany({});
    await OrderChecklist.deleteMany({});
    await ChecklistTemplate.deleteMany({});
    await Order.deleteMany({});
    await OrderCounter.deleteMany({});
    await User.deleteMany({});
  });

  const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

  const startInspection = async (fixture: Awaited<ReturnType<typeof seedOrderTestFixture>>) => {
    const templateId = await seedChecklistTemplateForClient({
      clientId: fixture.clientAId,
      createdBy: fixture.pmAId,
      questions: [
        {
          id: 'q1',
          label: 'Is equipment operational?',
          type: QuestionType.BOOLEAN,
          required: true,
          order: 1,
        },
        {
          id: 'q2',
          label: 'Summary',
          type: QuestionType.TEXT,
          required: true,
          order: 2,
        },
        {
          id: 'q3',
          label: 'Vehicle image',
          type: QuestionType.FILE,
          required: true,
          order: 3,
        },
      ],
    });

    await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken))
      .send({ checklistTemplateId: templateId });

    await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/status`)
      .set(authHeader(fixture.imAToken))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });
  };

  it('allows authorized users to read an attached order checklist', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken));

    expect(response.status).toBe(200);
    expect(response.body.data.orderId).toBe(fixture.orderPmAId);
    expect(response.body.data.questionsSnapshot).toHaveLength(3);
  });

  it('allows assigned inspection manager to save answers', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/checklist/answers`)
      .set(authHeader(fixture.imAToken))
      .send({
        answers: [
          { questionId: 'q1', value: true },
          { questionId: 'q2', value: 'All good' },
        ],
      });

    expect(response.status).toBe(200);
    expect(response.body.data.answers).toEqual(
      expect.arrayContaining([
        { questionId: 'q1', value: true },
        { questionId: 'q2', value: 'All good' },
      ]),
    );
  });

  it('uploads a file for a FILE question and stores answer metadata', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    const uploadResponse = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist/questions/q3/file`)
      .set(authHeader(fixture.imAToken))
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'vehicle.jpg',
        contentType: 'image/jpeg',
      });

    expect(uploadResponse.status).toBe(201);
    expect(uploadResponse.body.data).toMatchObject({
      orderId: fixture.orderPmAId,
      questionId: 'q3',
      originalName: 'vehicle.jpg',
      mimeType: 'image/jpeg',
    });

    const checklistResponse = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken));

    const fileAnswer = checklistResponse.body.data.answers.find(
      (answer: { questionId: string }) => answer.questionId === 'q3',
    );

    expect(fileAnswer.value.fileId).toBe(uploadResponse.body.data.id);
  });

  it('submits inspection and moves order to INSPECTION_COMPLETED', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/checklist/answers`)
      .set(authHeader(fixture.imAToken))
      .send({
        answers: [
          { questionId: 'q1', value: true },
          { questionId: 'q2', value: 'All good' },
        ],
      });

    await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist/questions/q3/file`)
      .set(authHeader(fixture.imAToken))
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'vehicle.jpg',
        contentType: 'image/jpeg',
      });

    const submitResponse = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist/submit`)
      .set(authHeader(fixture.imAToken));

    expect(submitResponse.status).toBe(200);

    const orderResponse = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}`)
      .set(authHeader(fixture.pmAToken));

    expect(orderResponse.body.data.status).toBe(OrderStatus.INSPECTION_COMPLETED);
  });

  it('returns 400 when submitting with missing required answers', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    const response = await request(app)
      .post(`/api/v1/orders/${fixture.orderPmAId}/checklist/submit`)
      .set(authHeader(fixture.imAToken));

    expect(response.status).toBe(400);
    expect(response.body.code).toBe('INVALID_CHECKLIST_ANSWER');
  });

  it('returns 403 when procurement manager attempts to update answers', async () => {
    const fixture = await seedOrderTestFixture(app);
    await startInspection(fixture);

    const response = await request(app)
      .patch(`/api/v1/orders/${fixture.orderPmAId}/checklist/answers`)
      .set(authHeader(fixture.pmAToken))
      .send({ answers: [{ questionId: 'q1', value: true }] });

    expect(response.status).toBe(403);
    expect(response.body.code).toBe('FORBIDDEN');
  });

  it('returns 404 when checklist is not attached', async () => {
    const fixture = await seedOrderTestFixture(app);

    const response = await request(app)
      .get(`/api/v1/orders/${fixture.orderPmAId}/checklist`)
      .set(authHeader(fixture.pmAToken));

    expect(response.status).toBe(404);
    expect(response.body.code).toBe('ORDER_CHECKLIST_NOT_FOUND');
  });
});
