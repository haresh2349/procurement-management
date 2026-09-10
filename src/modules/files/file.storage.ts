import { createReadStream, promises as fs } from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

import { uploadConfig } from '../../config/upload.js';

export interface StoredFile {
  storagePath: string;
  absolutePath: string;
}

const sanitizeFileName = (originalName: string): string => {
  const baseName = path.basename(originalName).replace(/[^\w.\-() ]+/g, '_');

  return baseName.length > 0 ? baseName : 'upload.bin';
};

export const ensureUploadRootExists = async (): Promise<void> => {
  await fs.mkdir(uploadConfig.uploadDir, { recursive: true });
};

export const saveUploadedFile = async (input: {
  orderId: string;
  questionId: string;
  originalName: string;
  buffer: Buffer;
}): Promise<StoredFile> => {
  await ensureUploadRootExists();

  const directory = path.join(uploadConfig.uploadDir, input.orderId, input.questionId);
  await fs.mkdir(directory, { recursive: true });

  const fileName = `${randomUUID()}-${sanitizeFileName(input.originalName)}`;
  const absolutePath = path.join(directory, fileName);

  await fs.writeFile(absolutePath, input.buffer);

  const storagePath = path.relative(uploadConfig.uploadDir, absolutePath).replace(/\\/g, '/');

  return {
    storagePath,
    absolutePath,
  };
};

export const getAbsolutePath = (storagePath: string): string => {
  return path.join(uploadConfig.uploadDir, storagePath);
};

export const openFileReadStream = (storagePath: string) => {
  return createReadStream(getAbsolutePath(storagePath));
};

export const deleteStoredFile = async (storagePath: string): Promise<void> => {
  try {
    await fs.unlink(getAbsolutePath(storagePath));
  } catch {
    // Ignore missing files during cleanup.
  }
};
