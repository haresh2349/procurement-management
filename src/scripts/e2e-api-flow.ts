import 'dotenv/config';

import type { Express } from 'express';
import request from 'supertest';

import { createApp } from '../app.js';
import { connectDatabase, disconnectDatabase } from '../config/database.js';
import { ensureUploadRootExists } from '../modules/files/file.storage.js';
import { UserRole } from '../common/constants/roles.js';
import { OrderStatus } from '../modules/orders/order.constants.js';
import { QuestionType } from '../modules/checklist-templates/checklist-template.constants.js';
import { logger } from '../common/utils/logger.js';

const PASSWORD = 'Password1!';

interface ApiResponse {
  status: number;
  body: {
    success?: boolean;
    message?: string;
    code?: string;
    data?: Record<string, unknown>;
  };
}

interface FlowContext {
  runId: string;
  adminToken: string;
  pmToken: string;
  pmId: string;
  pmBToken: string;
  pmBId: string;
  clientId: string;
  clientToken: string;
  clientBId: string;
  imId: string;
  imToken: string;
  imMobile: string;
  checklistTemplateId: string;
  orderId: string;
  noChecklistOrderId: string;
  cancelOrderId: string;
  authCheckOrderId: string;
  fileQuestionId: string;
  fileId: string;
}

class FlowRunner {
  private passed = 0;
  private failed = 0;

  constructor() {}

  private logResult(name: string, ok: boolean, detail?: string): void {
    const prefix = ok ? '[PASS]' : '[FAIL]';
    const message = detail ? `${name} — ${detail}` : name;
    console.log(`${prefix} ${message}`);

    if (ok) {
      this.passed += 1;
      return;
    }

    this.failed += 1;
  }

  async step(name: string, fn: () => Promise<void>): Promise<void> {
    try {
      await fn();
      this.logResult(name, true);
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logResult(name, false, detail);
    }
  }

  async expect(
    name: string,
    fn: () => Promise<ApiResponse>,
    expected: { status: number; code?: string },
  ): Promise<ApiResponse | null> {
    try {
      const response = await fn();

      const statusMatches = response.status === expected.status;
      const codeMatches = expected.code ? response.body.code === expected.code : true;

      if (!statusMatches || !codeMatches) {
        this.logResult(
          name,
          false,
          `expected status ${expected.status}${expected.code ? ` code ${expected.code}` : ''}, got ${response.status}${response.body.code ? ` code ${response.body.code}` : ''}`,
        );
        return null;
      }

      this.logResult(name, true);
      return response;
    } catch (error) {
      const detail = error instanceof Error ? error.message : String(error);
      this.logResult(name, false, detail);
      return null;
    }
  }

  summary(): void {
    console.log('\n========================================');
    console.log(`E2E summary: ${this.passed} passed, ${this.failed} failed`);
    console.log('========================================\n');
  }

  hasFailures(): boolean {
    return this.failed > 0;
  }
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const assertOk = (response: ApiResponse, expectedStatus = 200): void => {
  if (response.status !== expectedStatus) {
    throw new Error(
      `Expected HTTP ${expectedStatus}, got ${response.status} (${response.body.code ?? response.body.message ?? 'unknown error'})`,
    );
  }

  if (response.body.success === false) {
    throw new Error(response.body.message ?? 'Request failed');
  }
};

const getData = <T extends Record<string, unknown>>(
  response: ApiResponse,
  expectedStatus = 200,
): T => {
  assertOk(response, expectedStatus);
  return response.body.data as T;
};

const login = async (
  app: Express,
  credentials: { email?: string; mobile?: string; password: string },
): Promise<string> => {
  const response = await request(app).post('/api/v1/auth/login').send(credentials);
  return getData<{ accessToken: string }>(response).accessToken;
};

const requireEnv = (): void => {
  const required = ['MONGODB_URI', 'JWT_SECRET', 'ADMIN_EMAIL', 'ADMIN_PASSWORD'] as const;

  for (const key of required) {
    if (!process.env[key]) {
      throw new Error(`${key} is required in .env`);
    }
  }
};

const runFlow = async (): Promise<void> => {
  requireEnv();

  await connectDatabase();
  await ensureUploadRootExists();

  const app = createApp();
  const runner = new FlowRunner();
  const runId = Date.now().toString();
  const adminEmail = process.env.ADMIN_EMAIL!;
  const adminPassword = process.env.ADMIN_PASSWORD!;

  const ctx: Partial<FlowContext> = { runId };

  console.log('\nStarting procurement-management E2E API flow\n');

  await runner.step('Health check', async () => {
    const response = await request(app).get('/api/v1/health');
    const data = getData<{ status: string }>(response);
    if (data.status !== 'ok') {
      throw new Error('Health status is not ok');
    }
  });

  await runner.expect(
    'Login fails with invalid password',
    async () => {
      const response = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: adminEmail, password: 'wrong-password' });
      return response as ApiResponse;
    },
    { status: 401 },
  );

  await runner.step('Admin login', async () => {
    ctx.adminToken = await login(app, { email: adminEmail, password: adminPassword });
  });

  await runner.step('Admin creates procurement manager A', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(ctx.adminToken!))
      .send({
        name: `PM A ${runId}`,
        email: `pm-a-${runId}@test.com`,
        password: PASSWORD,
        role: UserRole.PROCUREMENT_MANAGER,
      });

    const data = getData<{ id: string }>(response, 201);
    ctx.pmId = data.id;
  });

  await runner.step('Admin creates procurement manager B', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(ctx.adminToken!))
      .send({
        name: `PM B ${runId}`,
        email: `pm-b-${runId}@test.com`,
        password: PASSWORD,
        role: UserRole.PROCUREMENT_MANAGER,
      });

    const data = getData<{ id: string }>(response, 201);
    ctx.pmBId = data.id;
  });

  await runner.step('Procurement manager A login', async () => {
    ctx.pmToken = await login(app, { email: `pm-a-${runId}@test.com`, password: PASSWORD });
  });

  await runner.step('Procurement manager B login', async () => {
    ctx.pmBToken = await login(app, { email: `pm-b-${runId}@test.com`, password: PASSWORD });
  });

  await runner.step('PM A creates client', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(ctx.pmToken!))
      .send({
        name: `Client A ${runId}`,
        email: `client-a-${runId}@test.com`,
        password: PASSWORD,
        role: UserRole.CLIENT,
      });

    const data = getData<{ id: string }>(response, 201);
    ctx.clientId = data.id;
  });

  await runner.step('PM B creates client', async () => {
    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(ctx.pmBToken!))
      .send({
        name: `Client B ${runId}`,
        email: `client-b-${runId}@test.com`,
        password: PASSWORD,
        role: UserRole.CLIENT,
      });

    const data = getData<{ id: string }>(response, 201);
    ctx.clientBId = data.id;
  });

  await runner.step('PM A creates inspection manager', async () => {
    ctx.imMobile = `9${runId.slice(-9)}`;

    const response = await request(app)
      .post('/api/v1/users')
      .set(authHeader(ctx.pmToken!))
      .send({
        name: `IM A ${runId}`,
        mobile: ctx.imMobile,
        password: PASSWORD,
        role: UserRole.INSPECTION_MANAGER,
      });

    const data = getData<{ id: string }>(response, 201);
    ctx.imId = data.id;
  });

  await runner.step('Client A login', async () => {
    ctx.clientToken = await login(app, {
      email: `client-a-${runId}@test.com`,
      password: PASSWORD,
    });
  });

  await runner.step('Inspection manager login', async () => {
    ctx.imToken = await login(app, { mobile: ctx.imMobile!, password: PASSWORD });
  });

  await runner.expect(
    'Client cannot create users',
    async () => {
      const response = await request(app)
        .post('/api/v1/users')
        .set(authHeader(ctx.clientToken!))
        .send({
          name: 'Blocked User',
          email: `blocked-${runId}@test.com`,
          password: PASSWORD,
          role: UserRole.CLIENT,
        });
      return response as ApiResponse;
    },
    { status: 403, code: 'FORBIDDEN' },
  );

  await runner.step('PM A creates checklist template', async () => {
    const response = await request(app)
      .post('/api/v1/checklist-templates')
      .set(authHeader(ctx.pmToken!))
      .send({
        name: `Vehicle Inspection ${runId}`,
        clientId: ctx.clientId,
        isDefault: true,
        questions: [
          {
            label: 'Is equipment operational?',
            type: QuestionType.BOOLEAN,
            required: true,
            order: 1,
          },
          {
            label: 'Severity',
            type: QuestionType.SINGLE_SELECT,
            required: true,
            order: 2,
            options: ['Minor', 'Major'],
          },
          {
            label: 'Driver checks',
            type: QuestionType.MULTI_SELECT,
            required: false,
            order: 3,
            options: ['Licence present', 'Driver number active'],
          },
          {
            label: 'Overall summary',
            type: QuestionType.TEXT,
            required: true,
            order: 4,
          },
          {
            label: 'Vehicle image',
            type: QuestionType.FILE,
            required: true,
            order: 5,
          },
        ],
      });

    const data = getData<{ id: string; version: number }>(response, 201);
    ctx.checklistTemplateId = data.id;
    if (data.version !== 1) {
      throw new Error('Expected checklist template version 1');
    }
  });

  await runner.step('PM A lists checklist templates', async () => {
    const response = await request(app)
      .get(`/api/v1/checklist-templates?clientId=${ctx.clientId}`)
      .set(authHeader(ctx.pmToken!));

    const data = getData<{ items: Array<{ id: string }> }>(response);
    if (!data.items.some((item) => item.id === ctx.checklistTemplateId)) {
      throw new Error('Created checklist template not found in list response');
    }
  });

  await runner.step('PM A gets checklist template by id', async () => {
    const response = await request(app)
      .get(`/api/v1/checklist-templates/${ctx.checklistTemplateId}`)
      .set(authHeader(ctx.pmToken!));

    const data = getData<{ id: string }>(response);
    if (data.id !== ctx.checklistTemplateId) {
      throw new Error('Checklist template id mismatch');
    }
  });

  await runner.step('PM A creates order with inspection manager', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(ctx.pmToken!))
      .send({
        clientId: ctx.clientId,
        inspectionManagerId: ctx.imId,
      });

    const data = getData<{ orderId: string; status: string }>(response, 201);
    ctx.orderId = data.orderId;
    if (!/^ORD-\d{4,}$/.test(data.orderId)) {
      throw new Error(`Unexpected business order id: ${data.orderId}`);
    }
    if (data.status !== OrderStatus.CREATED) {
      throw new Error('Expected CREATED order status');
    }
  });

  await runner.step('PM A creates second order without checklist for validation checks', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(ctx.pmToken!))
      .send({
        clientId: ctx.clientId,
        inspectionManagerId: ctx.imId,
      });

    const data = getData<{ orderId: string }>(response, 201);
    ctx.noChecklistOrderId = data.orderId;
  });

  await runner.step('PM A creates third order for cancel scenario', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(ctx.pmToken!))
      .send({ clientId: ctx.clientId });

    const data = getData<{ orderId: string }>(response, 201);
    ctx.cancelOrderId = data.orderId;
  });

  await runner.step('PM A creates fourth order for inspection authorization checks', async () => {
    const response = await request(app)
      .post('/api/v1/orders')
      .set(authHeader(ctx.pmToken!))
      .send({
        clientId: ctx.clientId,
        inspectionManagerId: ctx.imId,
      });

    const data = getData<{ orderId: string }>(response, 201);

    await request(app)
      .post(`/api/v1/orders/${data.orderId}/checklist`)
      .set(authHeader(ctx.pmToken!))
      .send({ checklistTemplateId: ctx.checklistTemplateId });

    ctx.authCheckOrderId = data.orderId;
  });

  await runner.step('PM A lists own orders', async () => {
    const response = await request(app).get('/api/v1/orders').set(authHeader(ctx.pmToken!));
    const data = getData<{ items: Array<{ orderId: string }> }>(response);
    const orderIds = data.items.map((item) => item.orderId);
    if (!orderIds.includes(ctx.orderId!)) {
      throw new Error('Primary order missing from PM list response');
    }
  });

  await runner.expect(
    'PM B cannot read PM A order',
    async () => {
      const response = await request(app)
        .get(`/api/v1/orders/${ctx.orderId}`)
        .set(authHeader(ctx.pmBToken!));
      return response as ApiResponse;
    },
    { status: 404, code: 'ORDER_NOT_FOUND' },
  );

  await runner.step('PM A attaches checklist to order', async () => {
    const response = await request(app)
      .post(`/api/v1/orders/${ctx.orderId}/checklist`)
      .set(authHeader(ctx.pmToken!))
      .send({ checklistTemplateId: ctx.checklistTemplateId });

    const data = getData<{ orderId: string; questionsSnapshot: unknown[] }>(response, 201);
    if (data.orderId !== ctx.orderId) {
      throw new Error('Attached checklist order id mismatch');
    }
    if (data.questionsSnapshot.length !== 5) {
      throw new Error('Expected 5 snapshot questions');
    }
  });

  await runner.expect(
    'Attaching checklist twice returns conflict',
    async () => {
      const response = await request(app)
        .post(`/api/v1/orders/${ctx.orderId}/checklist`)
        .set(authHeader(ctx.pmToken!))
        .send({ checklistTemplateId: ctx.checklistTemplateId });
      return response as ApiResponse;
    },
    { status: 409, code: 'ORDER_CHECKLIST_ALREADY_ATTACHED' },
  );

  await runner.expect(
    'PM cannot start inspection on a created order',
    async () => {
      const response = await request(app)
        .patch(`/api/v1/orders/${ctx.authCheckOrderId}/status`)
        .set(authHeader(ctx.pmToken!))
        .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });
      return response as ApiResponse;
    },
    { status: 403, code: 'FORBIDDEN' },
  );

  await runner.expect(
    'Cannot start inspection before checklist exists',
    async () => {
      const response = await request(app)
        .patch(`/api/v1/orders/${ctx.noChecklistOrderId}/status`)
        .set(authHeader(ctx.imToken!))
        .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });
      return response as ApiResponse;
    },
    { status: 400, code: 'ORDER_HAS_NO_CHECKLIST' },
  );

  await runner.step('Assigned IM starts inspection', async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${ctx.orderId}/status`)
      .set(authHeader(ctx.imToken!))
      .send({ status: OrderStatus.INSPECTION_IN_PROGRESS });

    const data = getData<{ status: string }>(response);
    if (data.status !== OrderStatus.INSPECTION_IN_PROGRESS) {
      throw new Error('Order did not move to INSPECTION_IN_PROGRESS');
    }
  });

  await runner.step('Authorized users can read order checklist', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${ctx.orderId}/checklist`)
      .set(authHeader(ctx.clientToken!));

    const data = getData<{ orderId: string; questionsSnapshot: Array<{ id: string; type: string }> }>(
      response,
    );
    const fileQuestion = data.questionsSnapshot.find((question) => question.type === QuestionType.FILE);
    if (!fileQuestion) {
      throw new Error('FILE question missing from checklist snapshot');
    }
    ctx.fileQuestionId = fileQuestion.id;
  });

  await runner.step('IM saves checklist answers', async () => {
    const checklistResponse = await request(app)
      .get(`/api/v1/orders/${ctx.orderId}/checklist`)
      .set(authHeader(ctx.imToken!));
    const checklist = getData<{
      questionsSnapshot: Array<{ id: string; type: string }>;
    }>(checklistResponse);

    const byType = (type: string) =>
      checklist.questionsSnapshot.find((question) => question.type === type)?.id;

    const booleanQuestionId = byType(QuestionType.BOOLEAN);
    const selectQuestionId = byType(QuestionType.SINGLE_SELECT);
    const multiQuestionId = byType(QuestionType.MULTI_SELECT);
    const textQuestionId = byType(QuestionType.TEXT);
    const fileQuestionId = byType(QuestionType.FILE);

    if (!booleanQuestionId || !selectQuestionId || !textQuestionId || !fileQuestionId) {
      throw new Error('Could not resolve checklist question ids');
    }

    ctx.fileQuestionId = fileQuestionId;

    const answersResponse = await request(app)
      .patch(`/api/v1/orders/${ctx.orderId}/checklist/answers`)
      .set(authHeader(ctx.imToken!))
      .send({
        answers: [
          { questionId: booleanQuestionId, value: true },
          { questionId: selectQuestionId, value: 'Minor' },
          ...(multiQuestionId
            ? [{ questionId: multiQuestionId, value: ['Licence present'] }]
            : []),
          { questionId: textQuestionId, value: 'Vehicle passed initial checks' },
        ],
      });

    assertOk(answersResponse);
  });

  await runner.expect(
    'Submit fails when required FILE answer is missing',
    async () => {
      const response = await request(app)
        .post(`/api/v1/orders/${ctx.orderId}/checklist/submit`)
        .set(authHeader(ctx.imToken!));
      return response as ApiResponse;
    },
    { status: 400, code: 'INVALID_CHECKLIST_ANSWER' },
  );

  await runner.step('IM uploads checklist file', async () => {
    const response = await request(app)
      .post(`/api/v1/orders/${ctx.orderId}/checklist/questions/${ctx.fileQuestionId}/file`)
      .set(authHeader(ctx.imToken!))
      .attach('file', Buffer.from('fake-image-content'), {
        filename: 'vehicle.jpg',
        contentType: 'image/jpeg',
      });

    const data = getData<{ id: string; questionId: string }>(response, 201);
    ctx.fileId = data.id;
    if (data.questionId !== ctx.fileQuestionId) {
      throw new Error('Uploaded file question id mismatch');
    }
  });

  await runner.step('IM downloads uploaded file', async () => {
    const response = await request(app)
      .get(`/api/v1/files/${ctx.fileId}`)
      .set(authHeader(ctx.pmToken!));

    if (response.status !== 200) {
      throw new Error(`Expected file download status 200, got ${response.status}`);
    }
  });

  await runner.step('IM submits inspection', async () => {
    const response = await request(app)
      .post(`/api/v1/orders/${ctx.orderId}/checklist/submit`)
      .set(authHeader(ctx.imToken!));

    assertOk(response);
  });

  await runner.step('Order moves to INSPECTION_COMPLETED after submit', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${ctx.orderId}`)
      .set(authHeader(ctx.pmToken!));

    const data = getData<{ status: string }>(response);
    if (data.status !== OrderStatus.INSPECTION_COMPLETED) {
      throw new Error(`Expected INSPECTION_COMPLETED, got ${data.status}`);
    }
  });

  await runner.expect(
    'IM cannot patch answers after submission',
    async () => {
      const response = await request(app)
        .patch(`/api/v1/orders/${ctx.orderId}/checklist/answers`)
        .set(authHeader(ctx.imToken!))
        .send({ answers: [{ questionId: 'q1', value: false }] });
      return response as ApiResponse;
    },
    { status: 404, code: 'ORDER_NOT_FOUND' },
  );

  await runner.expect(
    'Public status endpoint cannot complete inspection directly',
    async () => {
      const response = await request(app)
        .patch(`/api/v1/orders/${ctx.orderId}/status`)
        .set(authHeader(ctx.imToken!))
        .send({ status: OrderStatus.INSPECTION_COMPLETED });
      return response as ApiResponse;
    },
    { status: 400, code: 'INVALID_ORDER_STATUS_TRANSITION' },
  );

  await runner.step('PM approves inspection', async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${ctx.orderId}/status`)
      .set(authHeader(ctx.pmToken!))
      .send({ status: OrderStatus.APPROVED });

    const data = getData<{ status: string }>(response);
    if (data.status !== OrderStatus.APPROVED) {
      throw new Error('Order did not move to APPROVED');
    }
  });

  await runner.step('PM completes order', async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${ctx.orderId}/status`)
      .set(authHeader(ctx.pmToken!))
      .send({ status: OrderStatus.COMPLETED });

    const data = getData<{ status: string }>(response);
    if (data.status !== OrderStatus.COMPLETED) {
      throw new Error('Order did not move to COMPLETED');
    }
  });

  await runner.step('Client can view completed order', async () => {
    const response = await request(app)
      .get(`/api/v1/orders/${ctx.orderId}`)
      .set(authHeader(ctx.clientToken!));

    const data = getData<{ orderId: string; status: string }>(response);
    if (data.orderId !== ctx.orderId || data.status !== OrderStatus.COMPLETED) {
      throw new Error('Client cannot see completed order as expected');
    }
  });

  await runner.step('PM cancels a created order', async () => {
    const response = await request(app)
      .patch(`/api/v1/orders/${ctx.cancelOrderId}/status`)
      .set(authHeader(ctx.pmToken!))
      .send({ status: OrderStatus.CANCELLED });

    const data = getData<{ status: string }>(response);
    if (data.status !== OrderStatus.CANCELLED) {
      throw new Error('Cancel order did not move to CANCELLED');
    }
  });

  await runner.expect(
    'Invalid business order id is rejected',
    async () => {
      const response = await request(app)
        .get('/api/v1/orders/invalid-order-id')
        .set(authHeader(ctx.adminToken!));
      return response as ApiResponse;
    },
    { status: 400, code: 'VALIDATION_ERROR' },
  );

  runner.summary();

  if (runner.hasFailures()) {
    throw new Error('E2E API flow completed with failures');
  }
};

void runFlow()
  .then(async () => {
    await disconnectDatabase();
    logger.info('E2E API flow completed successfully');
    process.exit(0);
  })
  .catch(async (error) => {
    logger.error('E2E API flow failed', {
      message: error instanceof Error ? error.message : String(error),
    });

    try {
      await disconnectDatabase();
    } catch {
      // ignore disconnect errors during failed run
    }

    process.exit(1);
  });
