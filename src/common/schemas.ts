import * as z from 'zod';

// MongoDB ObjectIds are 24 hex characters. We deliberately do NOT use mongoose.isValidObjectId,
// which also accepts any 12-character string ("twelvechars!" would pass).
export const objectIdSchema = z
  .string()
  .regex(/^[0-9a-fA-F]{24}$/, { error: 'must be a 24-character hex ObjectId' });

// Reused by every `/:id` route.
export const idParams = z.object({ id: objectIdSchema });

// Datetimes must carry a timezone ("2027-02-26T17:00:00-06:00" or "...T23:00:00Z"). A bare
// "2027-02-26T17:00:00" means different instants on different machines, so it is rejected.
// The transform turns the validated string into a real Date for Mongoose.
export const isoDateTime = z.iso
  .datetime({ offset: true, error: 'must be an ISO-8601 datetime with a timezone offset or Z' })
  .transform((value) => new Date(value));

// Query strings arrive as text ("?page=2"), so these coerce. Bounded so a client cannot ask
// for a million rows.
export const paginationQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;
