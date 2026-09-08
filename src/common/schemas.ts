import * as z from 'zod';

// MongoDB ObjectIds are 24 hex characters. The rule is written out as a regex so it is explicit
// and does not depend on library behaviour (older Mongoose/bson versions accepted any
// 12-character string in isValidObjectId; the current ones do not, but a regex needs no caveat).
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

// Query-string booleans. Zod's stringbool() would also accept yes/no, on/off, 1/0; pinning it
// to the two obvious spellings keeps the contract easy to state.
export const queryBoolean = z.stringbool({ truthy: ['true'], falsy: ['false'] });

// Query strings arrive as text ("?page=2"), so these coerce. Bounded so a client cannot ask
// for a million rows. strictObject for the same reason as request bodies: a misspelled filter
// (?emial=...) should be a 400, not a silently unfiltered list. Zod's .extend() keeps strictness.
export const paginationQuery = z.strictObject({
  page: z.coerce.number().int().min(1).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});

export type Pagination = z.infer<typeof paginationQuery>;
