import type { Request, RequestHandler, Response } from 'express';
import type * as z from 'zod';
import { AppError } from './errors.ts';

type Location = 'params' | 'query' | 'body';
export type RequestSchemas = Partial<Record<Location, z.ZodType>>;

// Each declared location becomes its schema's output type; undeclared ones are undefined.
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

// Validates params/query/body with Zod and passes the typed result to the handler.
// The parsed values are not written back to req: Express 5 makes req.query read-only, and
// keeping raw and validated input separate is clearer anyway.
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
      // express.json() only parses application/json; anything else leaves req.body undefined.
      if (location === 'body' && req.body === undefined) {
        issues.push({
          location,
          path: '',
          message: 'request body is missing or was not sent as Content-Type: application/json',
        });
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

    await handler(parsed as ParsedInput<S>, req, res);
  };
}
