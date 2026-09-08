import * as z from 'zod';
import { isoDateTime, paginationQuery } from '../../common/schemas.ts';
import { toIso } from '../../common/serializers.ts';
import type { EventDoc } from './event-model.ts';

// FILE 2 OF 5: Zod schemas. What CLIENTS may send, and what we send back.

// ---- Requests --------------------------------------------------------------------------------

// The field rules are written once and shared by the create and update schemas below.
const eventFields = {
  name: z.string().trim().min(1, { error: 'name is required' }).max(120),
  description: z.string().trim().max(2000).optional(),
  location: z.string().trim().max(120).optional(),
  // isoDateTime rejects datetimes without a timezone and converts the string to a Date.
  startTime: isoDateTime,
  endTime: isoDateTime,
};

// A rule that spans two fields lives in .refine(). `path` tells the client which field to fix.
export const createEventBody = z
  .strictObject(eventFields)
  .refine((event) => event.endTime > event.startTime, {
    error: 'endTime must be after startTime',
    path: ['endTime'],
  });
export type CreateEventBody = z.infer<typeof createEventBody>;

// PATCH: every field optional, but an empty body is a 400. The end-after-start rule cannot be
// checked here because a PATCH may send only one of the two times; the service merges the patch
// with the stored event and checks the result. (Zod 4 also refuses .partial() on a schema that
// already has a .refine(), which is the practical reason the two schemas are built separately.)
export const updateEventBody = z
  .strictObject(eventFields)
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, { error: 'at least one field is required' });
export type UpdateEventBody = z.infer<typeof updateEventBody>;

// ?from=...&to=... selects events that OVERLAP the window, so an event that started before
// `from` but is still running inside the window is included. Both bounds are optional.
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

// ---- Responses -------------------------------------------------------------------------------

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
