import * as z from 'zod';
import { isoDateTime, objectIdSchema, paginationQuery } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import type { ShiftDoc } from './shift-model.ts';

// No eventId field: the route path (/events/:eventId/shifts) supplies it on create, and a shift
// cannot move between events, so no body schema accepts one.
const shiftFields = {
  role: z.string().trim().min(1, { error: 'role is required' }).max(120),
  startTime: isoDateTime,
  endTime: isoDateTime,
  capacity: z.number().int().min(1).max(500),
};

export const createShiftBody = z
  .strictObject(shiftFields)
  .refine((shift) => shift.endTime > shift.startTime, {
    error: 'endTime must be after startTime',
    path: ['endTime'],
  });
export type CreateShiftBody = z.infer<typeof createShiftBody>;

// The end-after-start rule cannot be checked on a partial body; the service checks the merged
// result. (Zod also refuses .partial() on a schema that already has a .refine().)
export const updateShiftBody = z
  .strictObject(shiftFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { error: 'at least one field is required' });
export type UpdateShiftBody = z.infer<typeof updateShiftBody>;

// Path params for the routes nested under an event.
export const eventIdParams = z.object({ eventId: objectIdSchema });

export const listShiftsQuery = paginationQuery;
export type ListShiftsQuery = z.infer<typeof listShiftsQuery>;

export type ShiftDto = {
  id: string;
  eventId: string;
  role: string;
  startTime: string;
  endTime: string;
  capacity: number;
  createdAt: string;
  updatedAt: string;
};

export function toShiftDto(doc: ShiftDoc): ShiftDto {
  return {
    id: doc._id.toString(),
    eventId: doc.eventId.toString(),
    role: doc.role,
    startTime: toIso(doc.startTime),
    endTime: toIso(doc.endTime),
    capacity: doc.capacity,
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
