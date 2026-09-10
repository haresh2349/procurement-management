import type { ChecklistTemplateDocument } from './checklist-template.model.js';
import { ChecklistTemplate } from './checklist-template.model.js';
import type { ChecklistTemplateResponse } from './checklist-template.types.js';

export const toChecklistTemplateResponse = (
  template: ChecklistTemplateDocument,
): ChecklistTemplateResponse => ({
  id: template._id.toString(),
  name: template.name,
  clientId: template.clientId.toString(),
  createdBy: template.createdBy.toString(),
  version: template.version,
  isDefault: template.isDefault,
  questions: template.questions.map((question) => ({
    id: question.id,
    label: question.label,
    type: question.type as ChecklistTemplateResponse['questions'][number]['type'],
    required: question.required,
    order: question.order,
    ...(question.options ? { options: [...question.options] } : {}),
  })),
  createdAt: template.createdAt,
  updatedAt: template.updatedAt,
});

export const findById = async (id: string): Promise<ChecklistTemplateDocument | null> => {
  return ChecklistTemplate.findById(id);
};

export const findByIdAndClientId = async (
  id: string,
  clientId: string,
): Promise<ChecklistTemplateDocument | null> => {
  return ChecklistTemplate.findOne({ _id: id, clientId });
};

export const findDefaultByClientId = async (
  clientId: string,
): Promise<ChecklistTemplateDocument | null> => {
  return ChecklistTemplate.findOne({ clientId, isDefault: true });
};

export const create = async (input: {
  name: string;
  clientId: string;
  createdBy: string;
  isDefault: boolean;
  questions: ChecklistTemplateDocument['questions'];
}): Promise<ChecklistTemplateDocument> => {
  return ChecklistTemplate.create({
    name: input.name,
    clientId: input.clientId,
    createdBy: input.createdBy,
    version: 1,
    isDefault: input.isDefault,
    questions: input.questions,
  });
};

export const findPaginated = async (
  filter: Record<string, unknown>,
  page: number,
  limit: number,
): Promise<{ templates: ChecklistTemplateDocument[]; total: number }> => {
  const skip = (page - 1) * limit;

  const [templates, total] = await Promise.all([
    ChecklistTemplate.find(filter).sort({ createdAt: -1 }).skip(skip).limit(limit),
    ChecklistTemplate.countDocuments(filter),
  ]);

  return { templates, total };
};

export const updateById = async (
  id: string,
  update: Partial<{
    name: string;
    isDefault: boolean;
    version: number;
    questions: ChecklistTemplateDocument['questions'];
  }>,
): Promise<ChecklistTemplateDocument | null> => {
  return ChecklistTemplate.findByIdAndUpdate(id, update, {
    returnDocument: 'after',
    runValidators: true,
  });
};

export const unsetDefaultForClient = async (
  clientId: string,
  excludeTemplateId: string,
): Promise<void> => {
  await ChecklistTemplate.updateMany(
    { clientId, _id: { $ne: excludeTemplateId } },
    { isDefault: false },
  );
};
