import path from 'node:path';

import {
  ALLOWED_UPLOAD_MIME_TYPES,
  DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  DEFAULT_UPLOAD_DIR,
} from '../modules/files/file.constants.js';

const parsePositiveInt = (value: string | undefined, fallback: number): number => {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed <= 0) {
    return fallback;
  }

  return Math.floor(parsed);
};

const maxUploadSizeMb = parsePositiveInt(process.env.MAX_UPLOAD_SIZE_MB, 5);

export const uploadConfig = {
  uploadDir: path.resolve(process.env.UPLOAD_DIR ?? DEFAULT_UPLOAD_DIR),
  maxFileSizeBytes: maxUploadSizeMb * 1024 * 1024 || DEFAULT_MAX_UPLOAD_SIZE_BYTES,
  allowedMimeTypes: ALLOWED_UPLOAD_MIME_TYPES,
};
