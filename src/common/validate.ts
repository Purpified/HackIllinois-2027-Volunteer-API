import type { Request, RequestHandler, Response } from 'express';
import type * as z from 'zod';
import { AppError } from './errors.ts';

// A route can declare a Zod schema for each of the three places input arrives from.
type Location = 'params' | 'query' | 'body';
export type RequestSchemas = Partial<Record<Location, z.ZodType>>;

// The parsed, typed input a handler receives: each declared location becomes the schema's
// OUTPUT type (after coercion/transforms); undeclared locations are `undefined`.
export type ParsedInput<S extends RequestSchemas> = {
  [K in Location]: S[K] extends z.ZodType ? z.output<S[K]> : undefined;
};

export type ValidatedHandler<S extends RequestSchemas> = (
  input: ParsedInput<S>,
  req: Request,
  res: Response,
) => Promise<void> | void;

export type ValidationIssue = { location: Location; path: string; message: string };

const LOCATIONS: readonly Location[] = ['params', 'query', 'body'];

// Wraps a route handler with validation, modeled on the `specification()` middleware in the
// official HackIllinois API (adonix), minus the OpenAPI generation.
//
//   router.get('/:id', handle({ params: idParams }, async ({ params }, req, res) => { ... }));
//
// Why not write the parsed values back onto req.query / req.body? Express 5 made req.query a
// read-only getter, and req.body is only what express.json() produced. Passing the validated
// input as a separate argument keeps "raw" and "checked" data visibly apart.
export function handle<S extends RequestSchemas>(
  schemas: S,
  handler: ValidatedHandler<S>,
): RequestHandler {
  return async (req, res) => {
    const parsed: Partial<Record<Location, unknown>> = {};
    const issues: ValidationIssue[] = [];

    for (const location of LOCATIONS) {
      const schema = schemas[location];
      if (!schema) {
        continue;
      }
      const result = schema.safeParse(req[location]);
      if (result.success) {
        parsed[location] = result.data;
      } else {
        for (const issue of result.error.issues) {
          issues.push({ location, path: issue.path.map(String).join('.'), message: issue.message });
        }
      }
    }

    if (issues.length > 0) {
      throw new AppError(400, 'VALIDATION_ERROR', 'Request failed validation', { issues });
    }

    // Express 5 forwards a rejected promise from this async function to the error handler.
    await handler(parsed as ParsedInput<S>, req, res);
  };
}
