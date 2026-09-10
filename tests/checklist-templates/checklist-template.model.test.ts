import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { afterAll, afterEach, beforeAll, describe, expect, it, jest } from '@jest/globals';

import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import { ChecklistTemplate } from '../../src/modules/checklist-templates/checklist-template.model.js';

describe('ChecklistTemplate model', () => {
  jest.setTimeout(30000);

  let mongoServer: MongoMemoryServer;
  const clientId = new mongoose.Types.ObjectId();
  const createdBy = new mongoose.Types.ObjectId();

  beforeAll(async () => {
    mongoServer = await MongoMemoryServer.create();
    await mongoose.connect(mongoServer.getUri());
  });

  afterAll(async () => {
    await mongoose.disconnect();
    await mongoServer.stop();
  });

  afterEach(async () => {
    await ChecklistTemplate.deleteMany({});
  });

  it('persists a valid checklist template with dynamic questions', async () => {
    const template = await ChecklistTemplate.create({
      name: 'Vehicle Inspection Checklist',
      clientId,
      createdBy,
      version: 1,
      isDefault: true,
      questions: [
        {
          id: 'q1',
          label: 'Is the vehicle roadworthy?',
          type: QuestionType.BOOLEAN,
          required: true,
          order: 1,
        },
        {
          id: 'q2',
          label: 'Select damage severity',
          type: QuestionType.SINGLE_SELECT,
          required: true,
          order: 2,
          options: ['Minor', 'Major'],
        },
      ],
    });

    expect(template.name).toBe('Vehicle Inspection Checklist');
    expect(template.version).toBe(1);
    expect(template.questions).toHaveLength(2);
  });

  it('rejects SINGLE_SELECT without at least two options', async () => {
    await expect(
      ChecklistTemplate.create({
        name: 'Invalid Checklist',
        clientId,
        createdBy,
        questions: [
          {
            id: 'q1',
            label: 'Pick one',
            type: QuestionType.SINGLE_SELECT,
            required: true,
            order: 1,
            options: ['Only one'],
          },
        ],
      }),
    ).rejects.toThrow(/at least 2 options/i);
  });

  it('rejects BOOLEAN questions with options', async () => {
    await expect(
      ChecklistTemplate.create({
        name: 'Invalid Checklist',
        clientId,
        createdBy,
        questions: [
          {
            id: 'q1',
            label: 'Yes or no',
            type: QuestionType.BOOLEAN,
            required: true,
            order: 1,
            options: ['Yes', 'No'],
          },
        ],
      }),
    ).rejects.toThrow(/must not include options/i);
  });

  it('rejects duplicate question ids within the same checklist', async () => {
    await expect(
      ChecklistTemplate.create({
        name: 'Invalid Checklist',
        clientId,
        createdBy,
        questions: [
          {
            id: 'q1',
            label: 'First',
            type: QuestionType.TEXT,
            required: true,
            order: 1,
          },
          {
            id: 'q1',
            label: 'Duplicate',
            type: QuestionType.TEXT,
            required: false,
            order: 2,
          },
        ],
      }),
    ).rejects.toThrow(/Duplicate question id/i);
  });
});
