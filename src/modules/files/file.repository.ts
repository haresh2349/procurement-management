import type { FileDocument } from './file.model.js';
import { File } from './file.model.js';
import type { CreateFileRecordInput, FileResponse } from './file.types.js';

export const toFileResponse = (file: FileDocument): FileResponse => ({
  id: file._id.toString(),
  orderId: file.orderId,
  orderChecklistId: file.orderChecklistId.toString(),
  questionId: file.questionId,
  originalName: file.originalName,
  mimeType: file.mimeType,
  size: file.size,
  createdAt: file.createdAt,
});

export const findById = async (fileId: string): Promise<FileDocument | null> => {
  return File.findById(fileId);
};

export const create = async (input: CreateFileRecordInput): Promise<FileDocument> => {
  return File.create({
    orderId: input.orderId,
    orderChecklistId: input.orderChecklistId,
    questionId: input.questionId,
    originalName: input.originalName,
    storagePath: input.storagePath,
    mimeType: input.mimeType,
    size: input.size,
    uploadedBy: input.uploadedBy,
  });
};
