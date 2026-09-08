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

// Express's router and the body parser mark client-caused errors with a `type` string and/or
// a 4xx `status`. Both are plain properties on an Error, so we read them defensively.
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

// The ONE place that turns errors into HTTP responses. Express recognizes an error handler by
// its arity: it must declare exactly four parameters. Anything a route or middleware throws (or
// passes to next()) ends up here, in the order the branches are listed.
export function errorHandler(err: unknown, req: Request, res: Response, next: NextFunction): void {
  // Headers already went out (a handler failed mid-response): nothing sensible can be sent.
  // Hand back to Express, which closes the connection.
  if (res.headersSent) {
    next(err);
    return;
  }

  // Expected failures thrown by services and by the handle() wrapper.
  if (err instanceof AppError) {
    send(res, err.status, err.code, err.message, err.details);
    return;
  }

  // A value Mongoose could not cast, typically a malformed ObjectId that slipped past Zod.
  if (err instanceof mongoose.Error.CastError) {
    send(res, 400, 'INVALID_ID', `Invalid value for "${err.path}"`);
    return;
  }

  // A unique index rejected a write. Services catch the common cases and rethrow with a
  // specific code (DUPLICATE_EMAIL, ALREADY_SIGNED_UP); this is the generic fallback.
  // keyValue is the offending { field: value } pair; the driver types it as `any`.
  if (isDuplicateKeyError(err)) {
    const keyValue = err.keyValue as Record<string, unknown> | undefined;
    send(res, 409, 'DUPLICATE_KEY', 'A record with these values already exists', { keyValue });
    return;
  }

  // Errors from express.json(): it does not throw, it calls next(err) with a typed error.
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

  // Anything else Express or the body parser flagged as the client's fault (for example a
  // path segment with broken percent-encoding, which the router rejects with status 400).
  const status = clientStatus(err);
  if (status !== undefined) {
    send(res, status, 'BAD_REQUEST', 'The request could not be processed');
    return;
  }

  // Everything else is a bug. Log everything server-side, send nothing revealing to the client.
  // (A ZodError landing here means some code called .parse() on unvalidated data instead of
  // going through handle(); that is a bug too, so it is deliberately not special-cased.)
  const reference = randomUUID();
  console.error(`[${reference}] Unhandled error on ${req.method} ${req.originalUrl}`, err);
  send(res, 500, 'INTERNAL', `Something went wrong. Reference: ${reference}`);
}
