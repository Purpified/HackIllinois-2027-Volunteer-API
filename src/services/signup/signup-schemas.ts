import * as z from 'zod';
import { objectIdSchema, paginationQuery } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import { SIGNUP_STATUSES, type SignupDoc, type SignupStatus } from './signup-model.ts';

// The shift comes from the route path (/shifts/:shiftId/signups); status starts as 'active'
// and only changes through the cancel transition, so the body carries just the volunteer.
export const createSignupBody = z.strictObject({ volunteerId: objectIdSchema });
export type CreateSignupBody = z.infer<typeof createSignupBody>;

// Path params for the routes nested under a shift or a volunteer.
export const shiftIdParams = z.object({ shiftId: objectIdSchema });
export const volunteerIdParams = z.object({ volunteerId: objectIdSchema });

export const listSignupsQuery = paginationQuery.extend({
  status: z.enum(SIGNUP_STATUSES).optional(),
});
export type ListSignupsQuery = z.infer<typeof listSignupsQuery>;

export type SignupDto = {
  id: string;
  shiftId: string;
  volunteerId: string;
  status: SignupStatus;
  createdAt: string;
  updatedAt: string;
};

export function toSignupDto(doc: SignupDoc): SignupDto {
  return {
    id: doc._id.toString(),
    shiftId: doc.shiftId.toString(),
    volunteerId: doc.volunteerId.toString(),
    status: doc.status,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
