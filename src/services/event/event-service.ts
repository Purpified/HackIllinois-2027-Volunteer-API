import type { QueryFilter } from 'mongoose';
import { AppError } from '../../common/errors.ts';
import { EventModel, type Event, type EventDoc } from './event-model.ts';
import type { CreateEventBody, ListEventsQuery, UpdateEventBody } from './event-schemas.ts';

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

// MongoDB has no foreign keys; the shift feature calls this before creating a shift.
export async function assertEventExists(id: string): Promise<void> {
  const exists = await EventModel.exists({ _id: id });
  if (!exists) {
    throw new AppError(404, 'EVENT_NOT_FOUND', `No event with id ${id}`);
  }
}

export type EventPage = { items: EventDoc[]; total: number };

export async function listEvents(query: ListEventsQuery): Promise<EventPage> {
  const filter: QueryFilter<Event> = {};
  // Overlap with [from, to): starts before the window ends and ends after it starts.
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

  // Check end > start on the merged values, since a PATCH may send only one of the two.
  const startTime = patch.startTime ?? event.startTime;
  const endTime = patch.endTime ?? event.endTime;
  if (endTime <= startTime) {
    throw new AppError(400, 'VALIDATION_ERROR', 'Request failed validation', {
      issues: [{ location: 'body', path: 'endTime', message: 'endTime must be after startTime' }],
    });
  }

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
