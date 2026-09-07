import * as z from 'zod';
import { paginationQuery } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import type { VolunteerDoc } from './volunteer-model.ts';

// FILE 2 OF 5: Zod schemas. What CLIENTS may send, and what we send back.

// ---- Requests --------------------------------------------------------------------------------

// strictObject: unknown keys are a 400. Without it, `{ "nmae": "Ada" }` would be silently
// accepted as a volunteer with no name, and `{ "isActive": false }` could be set by any client.
export const createVolunteerBody = z.strictObject({
  name: z.string().trim().min(1, { error: 'name is required' }).max(100),
  // Normalize first (trim, lowercase), THEN validate the format. Zod 4 spells the email
  // validator as z.email(); .pipe() hands the cleaned string to it.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phone: z.string().trim().min(7).max(20).optional(),
});
// The TypeScript type is derived from the schema: one source of truth for shape and rules.
export type CreateVolunteerBody = z.infer<typeof createVolunteerBody>;

export const listVolunteersQuery = paginationQuery.extend({
  // Exact-match lookup. With no authentication, this is how a client finds its own id.
  email: z.string().trim().toLowerCase().optional(),
  // Query strings are text; z.stringbool() understands "true" / "false".
  isActive: z.stringbool().optional(),
});
export type ListVolunteersQuery = z.infer<typeof listVolunteersQuery>;

// ---- Responses -------------------------------------------------------------------------------

// The public shape. `id` instead of Mongo's `_id`, no `__v`, dates as ISO strings. Keeping this
// separate from the model means we can change storage without changing the API.
export type VolunteerDto = {
  id: string;
  name: string;
  email: string;
  phone?: string;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export function toVolunteerDto(doc: VolunteerDoc): VolunteerDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    email: doc.email,
    // Optional fields come back from Mongoose as null or undefined; JSON drops undefined keys.
    phone: doc.phone ?? undefined,
    isActive: doc.isActive,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
