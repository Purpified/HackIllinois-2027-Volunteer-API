import * as z from 'zod';

// 24 hex characters. Explicit regex rather than a library check so the rule is visible.
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { error: 'must be a 24-character hex ObjectId' });

export const idParams = z.object({ id: objectIdSchema });

// Datetimes must carry a timezone; a bare "2027-02-26T17:00:00" is ambiguous across machines.
export const isoDateTime = z.iso
  .datetime({ offset: true, error: 'must be an ISO-8601 datetime with a timezone offset or Z' })
  .transform((value) => new Date(value));

export const queryBoolean = z.stringbool({ truthy: ['true'], falsy: ['false'] });

// Strict so a misspelled filter is a 400 rather than a silently unfiltered list.
export const paginationQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;
