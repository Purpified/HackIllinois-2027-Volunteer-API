import type { QueryFilter } from 'mongoose';
import { AppError } from '../../common/errors.ts';
import { EventModel, type Event, type EventDoc } from './event-model.ts';
import type { CreateEventBody, ListEventsQuery, UpdateEventBody } from './event-schemas.ts';

// FILE 3 OF 5: the service. The only file that touches EventModel.

export async function createEvent(input: CreateEventBody): Promise<EventDoc> {
  return EventModel.create(input);
}

export async function getEventById(id: string): Promise<EventDoc> {
  const event = await EventModel.findById(id);
  if (!event) {
    throw new AppError(404, 'EVENT_NOT_FOUND', `No event with id ${id}`);
  }
  return event;
}

// Cheap "does it exist?" check for other services (a shift must belong to a real event).
export async function assertEventExists(id: string): Promise<void> {
  const exists = await EventModel.exists({ _id: id });
  if (!exists) {
    throw new AppError(404, 'EVENT_NOT_FOUND', `No event with id ${id}`);
  }
}

export type EventPage = { items: EventDoc[]; total: number };

export async function listEvents(query: ListEventsQuery): Promise<EventPage> {
  // QueryFilter<Event> is Mongoose's type for "a filter over Event documents"; it allows the
  // operators ($lt, $gt, ...) that a plain { field: value } object type would not.
  const filter: QueryFilter<Event> = {};
  // Overlap with [from, to): the event starts before the window ends AND ends after it starts.
  if (query.to) {
    filter.startTime = { $lt: query.to };
  }
  if (query.from) {
    filter.endTime = { $gt: query.from };
  }

  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    EventModel.find(filter).sort({ startTime: 1, _id: 1 }).skip(skip).limit(query.limit),
    EventModel.countDocuments(filter),
  ]);
  return { items, total };
}

export async function updateEvent(id: string, patch: UpdateEventBody): Promise<EventDoc> {
  const event = await getEventById(id);

  // Zod could not check end > start for a partial body, so check it on the MERGED values:
  // whatever the patch provides, falling back to what is stored.
  const startTime = patch.startTime ?? event.startTime;
  const endTime = patch.endTime ?? event.endTime;
  if (endTime <= startTime) {
    // Same shape as every other validation failure, so clients handle it the same way.
    throw new AppError(400, 'VALIDATION_ERROR', 'Request failed validation', {
      issues: [{ location: 'body', path: 'endTime', message: 'endTime must be after startTime' }],
    });
  }

  // runValidators applies the schema's per-field rules (maxlength, required) to the updated
  // paths. Note that the pre('validate') hook in the model does NOT run for updates.
  const updated = await EventModel.findByIdAndUpdate(
    id,
    { $set: patch },
    { returnDocument: 'after', runValidators: true },
  );
  if (!updated) {
    throw new AppError(404, 'EVENT_NOT_FOUND', `No event with id ${id}`);
  }
  return updated;
}
