// Small helpers that put realistic documents in the database for tests. Each call makes a
// distinct record unless you override a field.
//
// Named insertX (not createX) on purpose: these bypass the service layer and Zod, writing
// straight to MongoDB, so they must never be mistaken for the real createVolunteer().
import { EventModel, type EventDoc } from '../src/services/event/event-model.ts';
import { VolunteerModel, type VolunteerDoc } from '../src/services/volunteer/volunteer-model.ts';

// A well-formed ObjectId that no document has. Useful for "exists but not found" tests.
export const UNKNOWN_ID = '000000000000000000000000';

// Friday 26 Feb 2027, 5pm Chicago time, as the UTC instant the database would store. Tests use
// fixed instants rather than Date.now() so a failure is reproducible.
export const EVENT_START = new Date('2027-02-26T23:00:00.000Z');

export function hoursFrom(date: Date, hours: number): Date {
  return new Date(date.getTime() + hours * 60 * 60 * 1000);
}

let volunteerCounter = 0;

export type VolunteerOverrides = Partial<{
  name: string;
  email: string;
  phone: string;
  isActive: boolean;
}>;

export async function insertVolunteer(overrides: VolunteerOverrides = {}): Promise<VolunteerDoc> {
  volunteerCounter += 1;
  return VolunteerModel.create({
    name: `Volunteer ${volunteerCounter}`,
    email: `volunteer${volunteerCounter}@illinois.edu`,
    ...overrides,
  });
}

let eventCounter = 0;

export type EventOverrides = Partial<{
  name: string;
  description: string;
  location: string;
  startTime: Date;
  endTime: Date;
}>;

// Each event defaults to a three-hour block, four hours after the previous one.
export async function insertEvent(overrides: EventOverrides = {}): Promise<EventDoc> {
  eventCounter += 1;
  const startTime = overrides.startTime ?? hoursFrom(EVENT_START, (eventCounter - 1) * 4);
  const endTime = overrides.endTime ?? hoursFrom(startTime, 3);
  return EventModel.create({ name: `Event ${eventCounter}`, ...overrides, startTime, endTime });
}
