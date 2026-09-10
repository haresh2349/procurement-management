import { describe, expect, it } from '@jest/globals';

import { QuestionType } from '../../src/modules/checklist-templates/checklist-template.constants.js';
import {
  mergeChecklistAnswers,
  validateAnswerValueForQuestion,
  validateSubmittedAnswers,
} from '../../src/modules/inspections/inspection.answer-validation.js';
import type { OrderChecklistAnswer } from '../../src/modules/orders/order-checklist.answer-types.js';

describe('inspection.answer-validation', () => {
  const booleanQuestion = {
    id: 'q1',
    label: 'Operational?',
    type: QuestionType.BOOLEAN,
    required: true,
    order: 1,
  };

  const selectQuestion = {
    id: 'q2',
    label: 'Category',
    type: QuestionType.SINGLE_SELECT,
    required: true,
    order: 2,
    options: ['Minor', 'Major'],
  };

  it('validates boolean answers', () => {
    expect(validateAnswerValueForQuestion(booleanQuestion, true)).toBeNull();
    expect(validateAnswerValueForQuestion(booleanQuestion, 'yes')).toContain('boolean');
  });

  it('validates single select answers', () => {
    expect(validateAnswerValueForQuestion(selectQuestion, 'Minor')).toBeNull();
    expect(validateAnswerValueForQuestion(selectQuestion, 'Invalid')).toContain('invalid option');
  });

  it('requires all required questions on submit', () => {
    const answers: OrderChecklistAnswer[] = [{ questionId: 'q2', value: 'Minor' }];

    expect(validateSubmittedAnswers([booleanQuestion, selectQuestion], answers)).toContain(
      'required',
    );
  });

  it('merges answers by question id', () => {
    const merged = mergeChecklistAnswers(
      [{ questionId: 'q1', value: false }],
      [{ questionId: 'q2', value: 'Major' }],
    );

    expect(merged).toEqual([
      { questionId: 'q1', value: false },
      { questionId: 'q2', value: 'Major' },
    ]);
  });
});
