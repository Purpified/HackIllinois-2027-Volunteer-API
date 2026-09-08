import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import { isDuplicateKeyError } from './db.ts';
import { AppError, type ErrorCode } from './errors.ts';

export type ErrorBody = { error: { code: ErrorCode; message: string; details?: unknown } };

function send(res: Response, status: number, code: ErrorCode, message: string, details?: unknown) {
  const body: ErrorBody = { error: { code, message } };
  if (details !== undefined) {
    body.error.details = details;
  }
  res.status(status).json(body);
}

// Express's router and body-parser tag client-caused errors with `type` and/or a 4xx `status`.
function errorType(err: unknown): string | undefined {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string'
    ? err.type
    : undefined;
}

function clientStatus(err: unknown): number | undefined {
  const status =
    typeof err === 'object' && err !== null && 'status' in err ? err.status : undefined;
  return typeof status === 'number' && status >= 400 && status < 500 ? status : undefined;
}

// The single place that turns errors into responses. Express identifies an error handler by
// its four-parameter signature.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  if (res.headersSent) {
    next(err);
    return;
  }

  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  if (err instanceof mongoose.Error.CastError) {
    send(res, 400, 'INVALID_ID', `Invalid value for "${err.path}"`);
    return;
  }

  // Generic fallback; services rethrow the common cases with a specific code.
  if (isDuplicateKeyError(err)) {
    const keyValue = err.keyValue as Record<string, unknown> | undefined;
    send(res, 409, 'DUPLICATE_KEY', 'A record with these values already exists', { keyValue });
    return;
  }

  const type = errorType(err);
  if (type === 'entity.parse.failed') {
    send(res, 400, 'MALFORMED_JSON', 'Request body is not valid JSON');
    return;
  }
  if (type === 'entity.too.large') {
    send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
    return;
  }
  if (type === 'charset.unsupported' || type === 'encoding.unsupported') {
    send(res, 415, 'UNSUPPORTED_MEDIA_TYPE', 'Use UTF-8 JSON without a Content-Encoding');
    return;
  }

  const status = clientStatus(err);
  if (status !== undefined) {
    send(res, status, 'BAD_REQUEST', 'The request could not be processed');
    return;
  }

  // Anything else is a bug: log the details, return only a reference id.
  const reference = randomUUID();
  console.error(`[${reference}] Unhandled error on ${req.method} ${req.originalUrl}`, err);
  send(res, 500, 'INTERNAL', `Something went wrong. Reference: ${reference}`);
}
