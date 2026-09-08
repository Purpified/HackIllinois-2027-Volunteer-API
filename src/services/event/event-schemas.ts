import * as z from 'zod';
import { isoDateTime, paginationQuery } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import type { EventDoc } from './event-model.ts';

const eventFields = {
  name: z.string().trim().min(1, { error: 'name is required' }).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
  startTime: isoDateTime,
  endTime: isoDateTime,
};

export const createEventBody = z
  .strictObject(eventFields)
  .refine((event) => event.endTime > event.startTime, {
    error: 'endTime must be after startTime',
    path: ['endTime'],
  });
export type CreateEventBody = z.infer<typeof createEventBody>;

// The end-after-start rule cannot be checked on a partial body; the service checks the merged
// result. (Zod also refuses .partial() on a schema that already has a .refine().)
export const updateEventBody = z
  .strictObject(eventFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { error: 'at least one field is required' });
export type UpdateEventBody = z.infer<typeof updateEventBody>;

// from/to select events that OVERLAP the window, not only those starting inside it.
export const listEventsQuery = paginationQuery
  .extend({
    from: isoDateTime.optional(),
    to: isoDateTime.optional(),
  })
  .refine((query) => !query.from || !query.to || query.from <= query.to, {
    error: 'from must not be after to',
    path: ['from'],
  });
export type ListEventsQuery = z.infer<typeof listEventsQuery>;

export type EventDto = {
  id: string;
  name: string;
  description?: string;
  location?: string;
  startTime: string;
  endTime: string;
  createdAt: string;
  updatedAt: string;
};

export function toEventDto(doc: EventDoc): EventDto {
  return {
    id: doc._id.toString(),
    name: doc.name,
    description: doc.description ?? undefined,
    location: doc.location ?? undefined,
    startTime: toIso(doc.startTime),
    endTime: toIso(doc.endTime),
    createdAt: toIso(doc.createdAt),
    updatedAt: toIso(doc.updatedAt),
  };
}
