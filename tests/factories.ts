// Test data helpers. Named insertX because they write straight to MongoDB, bypassing Zod.
import { EventModel, type EventDoc } from '../src/services/event/event-model.ts';
import { VolunteerModel, type VolunteerDoc } from '../src/services/volunteer/volunteer-model.ts';

// A well-formed ObjectId that no document has.
export const UNKNOWN_ID = '000000000000000000000000';

// Fri 26 Feb 2027, 5pm Chicago, as the stored UTC instant. Fixed so failures are reproducible.
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

// Defaults to a three-hour block, four hours after the previous event.
export async function insertEvent(overrides: EventOverrides = {}): Promise<EventDoc> {
  eventCounter += 1;
  const startTime = overrides.startTime ?? hoursFrom(EVENT_START, (eventCounter - 1) * 4);
  const endTime = overrides.endTime ?? hoursFrom(startTime, 3);
  return EventModel.create({ name: `Event ${eventCounter}`, ...overrides, startTime, endTime });
}
