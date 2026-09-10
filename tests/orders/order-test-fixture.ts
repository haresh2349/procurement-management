import type { Express } from 'express';
import request from 'supertest';
import { expect } from '@jest/globals';

import mongoose from 'mongoose';

import { UserRole } from '../../src/common/constants/roles.js';
import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import { ChecklistTemplate } from '../../src/modules/checklist-templates/checklist-template.model.js';
import { OrderStatus } from '../../src/modules/orders/order.constants.js';
import { OrderChecklist } from '../../src/modules/orders/order-checklist.model.js';
import { Order } from '../../src/modules/orders/order.model.js';
import { hashPassword } from '../../src/common/utils/password.js';
import { User } from '../../src/modules/users/user.model.js';

export interface OrderTestFixture {
  adminToken: string;
  pmAToken: string;
  pmBToken: string;
  clientAToken: string;
  clientBToken: string;
  imAToken: string;
  imBToken: string;
  pmAId: string;
  pmBId: string;
  clientAId: string;
  clientBId: string;
  imAId: string;
  imBId: string;
  orderPmAId: string;
  orderPmBId: string;
}

const authHeader = (token: string) => ({ Authorization: `Bearer ${token}` });

const loginAndGetToken = async (
  app: Express,
  credentials: { email?: string; mobile?: string; password: string },
) => {
  const response = await request(app).post('/api/v1/auth/login').send(credentials);

  expect(response.status).toBe(200);

  return response.body.data.accessToken as string;
};

export const seedOrderTestFixture = async (app: Express): Promise<OrderTestFixture> => {
  const passwordHash = await hashPassword('Admin@12345');

  const admin = await User.create({
    name: 'Admin',
    email: 'admin@test.com',
    password: passwordHash,
    role: UserRole.ADMIN,
    isActive: true,
  });

  const pmA = await User.create({
    name: 'PM A',
    email: 'pma@test.com',
    password: await hashPassword('Password1!'),
    role: UserRole.PROCUREMENT_MANAGER,
    createdBy: admin._id,
    isActive: true,
  });

  const pmB = await User.create({
    name: 'PM B',
    email: 'pmb@test.com',
    password: await hashPassword('Password1!'),
    role: UserRole.PROCUREMENT_MANAGER,
    createdBy: admin._id,
    isActive: true,
  });

  const clientA = await User.create({
    name: 'Client A',
    email: 'clienta@test.com',
    password: await hashPassword('Password1!'),
    role: UserRole.CLIENT,
    createdBy: pmA._id,
    isActive: true,
  });

  const clientB = await User.create({
    name: 'Client B',
    email: 'clientb@test.com',
    password: await hashPassword('Password1!'),
    role: UserRole.CLIENT,
    createdBy: pmB._id,
    isActive: true,
  });

  const imA = await User.create({
    name: 'IM A',
    mobile: '9111111111',
    password: await hashPassword('Password1!'),
    role: UserRole.INSPECTION_MANAGER,
    managerId: pmA._id,
    createdBy: pmA._id,
    isActive: true,
  });

  const imB = await User.create({
    name: 'IM B',
    mobile: '9222222222',
    password: await hashPassword('Password1!'),
    role: UserRole.INSPECTION_MANAGER,
    managerId: pmB._id,
    createdBy: pmB._id,
    isActive: true,
  });

  const adminToken = await loginAndGetToken(app, {
    email: 'admin@test.com',
    password: 'Admin@12345',
  });

  const pmAToken = await loginAndGetToken(app, { email: 'pma@test.com', password: 'Password1!' });
  const pmBToken = await loginAndGetToken(app, { email: 'pmb@test.com', password: 'Password1!' });
  const clientAToken = await loginAndGetToken(app, {
    email: 'clienta@test.com',
    password: 'Password1!',
  });
  const clientBToken = await loginAndGetToken(app, {
    email: 'clientb@test.com',
    password: 'Password1!',
  });
  const imAToken = await loginAndGetToken(app, { mobile: '9111111111', password: 'Password1!' });
  const imBToken = await loginAndGetToken(app, { mobile: '9222222222', password: 'Password1!' });

  const orderPmAResponse = await request(app)
    .post('/api/v1/orders')
    .set(authHeader(pmAToken))
    .send({
      clientId: clientA._id.toString(),
      inspectionManagerId: imA._id.toString(),
    });

  expect(orderPmAResponse.status).toBe(201);

  const orderPmBResponse = await request(app)
    .post('/api/v1/orders')
    .set(authHeader(pmBToken))
    .send({ clientId: clientB._id.toString() });

  expect(orderPmBResponse.status).toBe(201);

  await Order.findOneAndUpdate(
    { orderId: orderPmBResponse.body.data.orderId as string },
    { status: OrderStatus.INSPECTION_IN_PROGRESS },
  );

  return {
    adminToken,
    pmAToken,
    pmBToken,
    clientAToken,
    clientBToken,
    imAToken,
    imBToken,
    pmAId: pmA._id.toString(),
    pmBId: pmB._id.toString(),
    clientAId: clientA._id.toString(),
    clientBId: clientB._id.toString(),
    imAId: imA._id.toString(),
    imBId: imB._id.toString(),
    orderPmAId: orderPmAResponse.body.data.orderId as string,
    orderPmBId: orderPmBResponse.body.data.orderId as string,
  };
};

export const seedChecklistTemplateForClient = async (input: {
  clientId: string;
  createdBy: string;
  name?: string;
  version?: number;
  questions?: Array<{
    id: string;
    label: string;
    type: (typeof QuestionType)[keyof typeof QuestionType];
    required: boolean;
    order: number;
    options?: string[];
  }>;
}) => {
  const template = await ChecklistTemplate.create({
    name: input.name ?? 'Vehicle Inspection Checklist',
    clientId: input.clientId,
    createdBy: input.createdBy,
    version: input.version ?? 1,
    isDefault: false,
    questions:
      input.questions ?? [
        {
          id: 'q1',
          label: 'Is equipment operational?',
          type: QuestionType.BOOLEAN,
          required: true,
          order: 1,
        },
        {
          id: 'q2',
          label: 'Select severity',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          order: 2,
          options: ['Minor', 'Major'],
        },
      ],
  });

  return template._id.toString();
};

export const seedOrderChecklistForOrder = async (orderId: string) => {
  return OrderChecklist.create({
    orderId,
    checklistTemplateId: new mongoose.Types.ObjectId(),
    templateVersion: 1,
    checklistName: 'Test Checklist',
    questionsSnapshot: [
      {
        id: 'q1',
        label: 'Is equipment operational?',
        type: QuestionType.BOOLEAN,
        required: true,
        order: 1,
      },
    ],
    answers: [],
  });
};
