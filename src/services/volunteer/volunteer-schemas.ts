import * as z from 'zod';
import { paginationQuery, queryBoolean } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import type { VolunteerDoc } from './volunteer-model.ts';

// strictObject: unknown keys are a 400, so clients cannot set server-owned fields (isActive).
export const createVolunteerBody = z.strictObject({
  name: z.string().trim().min(1, { error: 'name is required' }).max(100),
  // Normalize, then validate.
  email: z.string().trim().toLowerCase().max(254).pipe(z.email()),
  phone: z.string().trim().min(7).max(20).optional(),
});
export type CreateVolunteerBody = z.infer<typeof createVolunteerBody>;

export const listVolunteersQuery = paginationQuery.extend({
  // Exact-match lookup: with no auth, this is how a client finds its own id.
  email: z.string().trim().toLowerCase().min(1).optional(),
  isActive: queryBoolean.optional(),
});
export type ListVolunteersQuery = z.infer<typeof listVolunteersQuery>;

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
    phone: doc.phone ?? undefined,
    isActive: doc.isActive,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
