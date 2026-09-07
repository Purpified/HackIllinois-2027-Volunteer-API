import { randomUUID } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import mongoose from 'mongoose';
import * as z from 'zod';
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

// Errors raised by express.json() (via the body-parser package) carry a `type` string.
function isBodyParserError(err: unknown): err is { type: string } {
  return typeof err === 'object' && err !== null && 'type' in err && typeof err.type === 'string';
}

// The ONE place that turns errors into HTTP responses. Express recognizes an error handler by
// its arity: it must declare exactly four parameters, even if `next` goes unused.
export function errorHandler(err: unknown, req: Request, res: Response, _next: NextFunction): void {
  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }
  if (err instanceof z.ZodError) {
    // Services normally validate through the `handle()` wrapper, which produces an AppError.
    // This branch catches a stray `.parse()` call so it still answers 400 rather than 500.
    send(res, 400, 'VALIDATION_ERROR', 'Request failed validation', z.flattenError(err));
    return;
  }
  if (err instanceof mongoose.Error.CastError) {
    // A value that Mongoose could not cast, typically a malformed ObjectId that slipped past Zod.
    send(res, 400, 'INVALID_ID', `Invalid value for "${err.path}"`);
    return;
  }
  if (isDuplicateKeyError(err)) {
    // A unique index rejected a write. Services catch the common cases and rethrow with a
    // specific code (DUPLICATE_EMAIL, ALREADY_SIGNED_UP); this is the generic fallback.
    // keyValue is the offending { field: value } pair; the driver types it as `any`.
    const keyValue = err.keyValue as Record<string, unknown> | undefined;
    send(res, 409, 'DUPLICATE_KEY', 'A record with these values already exists', { keyValue });
    return;
  }
  if (isBodyParserError(err)) {
    if (err.type === 'entity.parse.failed') {
      send(res, 400, 'MALFORMED_JSON', 'Request body is not valid JSON');
      return;
    }
    if (err.type === 'entity.too.large') {
      send(res, 413, 'PAYLOAD_TOO_LARGE', 'Request body is too large');
      return;
    }
  }

  // Anything else is a bug. Log everything server-side, send nothing revealing to the client.
  const reference = randomUUID();
  console.error(`[${reference}] Unhandled error on ${req.method} ${req.originalUrl}`, err);
  send(res, 500, 'INTERNAL', `Something went wrong. Reference: ${reference}`);
}
