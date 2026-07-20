import { Request, Response, NextFunction } from 'express';
import { logger } from '../lib/logger';

export interface AppError extends Error {
  statusCode?: number;
  code?: string;
  details?: Record<string, unknown>;
}

export function errorHandler(
  err: AppError,
  _req: Request,
  res: Response,
  _next: NextFunction
): void {
  const statusCode = err.statusCode || 500;
  const code = err.code || 'INTERNAL_ERROR';

  logger.error(
    {
      err,
      statusCode,
      code,
      stack: err.stack,
    },
    `Error: ${err.message}`
  );

  res.status(statusCode).json({
    error: statusCode === 500 ? 'Internal server error' : err.message,
    code,
    ...(err.details && { details: err.details }),
  });
}

// Helper to create typed errors
export function createError(
  message: string,
  statusCode: number,
  code: string,
  details?: Record<string, unknown>
): AppError {
  const error = new Error(message) as AppError;
  error.statusCode = statusCode;
  error.code = code;
  error.details = details;
  return error;
}
