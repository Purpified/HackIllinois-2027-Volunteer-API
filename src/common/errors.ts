// Every error the API can return has a stable, machine-readable code. Clients switch on the
// code; humans read the message. Keeping the list in one place means the README's error table
// and the tests can be checked against it.
export const ERROR_CODES = [
  // request shape
  'VALIDATION_ERROR',
  'INVALID_ID',
  'MALFORMED_JSON',
  'PAYLOAD_TOO_LARGE',
  'ROUTE_NOT_FOUND',
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

// Thrown by services for expected failures ("that shift is full"). The error handler turns it
// into `{ error: { code, message, details? } }` with the given HTTP status. Anything thrown that
// is NOT an AppError is treated as a bug and becomes a 500.
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
