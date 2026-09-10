import type { NextFunction, Request, Response } from 'express';
import multer from 'multer';

import { uploadConfig } from '../config/upload.js';
import { AppError } from '../common/errors/app-error.js';
import { ErrorCode } from '../common/errors/error-codes.js';
import { HttpStatus } from '../common/constants/http-status.js';

const memoryStorage = multer.memoryStorage();

const upload = multer({
  storage: memoryStorage,
  limits: {
    fileSize: uploadConfig.maxFileSizeBytes,
    files: 1,
  },
  fileFilter: (_req, file, callback) => {
    if (!uploadConfig.allowedMimeTypes.includes(file.mimetype as (typeof uploadConfig.allowedMimeTypes)[number])) {
      callback(
        new AppError('Unsupported file type', HttpStatus.BAD_REQUEST, ErrorCode.INVALID_FILE_TYPE),
      );
      return;
    }

    callback(null, true);
  },
});

export const uploadSingleChecklistFile = (
  req: Request,
  res: Response,
  next: NextFunction,
): void => {
  upload.single('file')(req, res, (error: unknown) => {
    if (!error) {
      next();
      return;
    }

    if (error instanceof multer.MulterError) {
      if (error.code === 'LIMIT_FILE_SIZE') {
        next(
          new AppError('File is too large', HttpStatus.BAD_REQUEST, ErrorCode.FILE_TOO_LARGE),
        );
        return;
      }

      next(new AppError(error.message, HttpStatus.BAD_REQUEST, ErrorCode.VALIDATION_ERROR));
      return;
    }

    next(error);
  });
};
