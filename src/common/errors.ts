// Stable, machine-readable error codes. Clients switch on the code; humans read the message.
export const ERROR_CODES = [
  // request shape
  'VALIDATION_ERROR',
  'INVALID_ID',
  'BAD_REQUEST',
  'MALFORMED_JSON',
  'PAYLOAD_TOO_LARGE',
  'UNSUPPORTED_MEDIA_TYPE',
  'ROUTE_NOT_FOUND',
  // events
  'EVENT_NOT_FOUND',
  // volunteers
  'VOLUNTEER_NOT_FOUND',
  'VOLUNTEER_INACTIVE',
  'DUPLICATE_EMAIL',
  // shifts
  'SHIFT_NOT_FOUND',
  'SHIFT_FULL',
  'SHIFT_CANCELLED',
  'CAPACITY_BELOW_SIGNUPS',
  // signups
  'SIGNUP_NOT_FOUND',
  'ALREADY_SIGNED_UP',
  'INVALID_TRANSITION',
  // generic
  'DUPLICATE_KEY',
  'SERVICE_UNAVAILABLE',
  'INTERNAL',
] as const;

export type ErrorCode = (typeof ERROR_CODES)[number];

// Thrown by services for expected failures. The error handler maps it to
// `{ error: { code, message, details? } }` with the given status. Unrecognized errors are 500s.
export class AppError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'AppError';
    this.status = status;
    this.code = code;
    this.details = details;
  }
}
