import { config } from './common/config.ts';
import { createEvent } from './services/event/event-service.ts';
import { createShift } from './services/shift/shift-service.ts';
import { cancelSignup, createSignup } from './services/signup/signup-service.ts';
import { VolunteerModel } from './services/volunteer/volunteer-model.ts';
import { createVolunteer } from './services/volunteer/volunteer-service.ts';

// Demo data for development: a plausible hackathon weekend anchored on EVENT_START. Everything
// goes through the service layer so the invariants (capacity, signupCount, the partial unique
// index) hold exactly as they would over HTTP. Ada Lovelace is deliberately absent: the
// requests.http create-volunteer block expects her email to be free.

const anchor = new Date(config.EVENT_START);

function at(hoursFromAnchor: number): Date {
  return new Date(anchor.getTime() + hoursFromAnchor * 60 * 60 * 1000);
}

export async function seedIfEmpty(): Promise<void> {
  if ((await VolunteerModel.countDocuments()) > 0) {
    return;
  }

  const [grace, alan, margaret, donald, barbara] = await Promise.all([
    createVolunteer({ name: 'Grace Hopper', email: 'grace@illinois.edu', phone: '217-555-0102' }),
    createVolunteer({ name: 'Alan Turing', email: 'alan@illinois.edu' }),
    createVolunteer({ name: 'Margaret Hamilton', email: 'margaret@illinois.edu' }),
    createVolunteer({ name: 'Donald Knuth', email: 'donald@illinois.edu' }),
    createVolunteer({
      name: 'Barbara Liskov',
      email: 'barbara@illinois.edu',
      phone: '217-555-0107',
    }),
    createVolunteer({ name: 'Katherine Johnson', email: 'katherine@illinois.edu' }),
    createVolunteer({ name: 'Edsger Dijkstra', email: 'edsger@illinois.edu' }),
  ]);

  const charles = await createVolunteer({ name: 'Charles Babbage', email: 'charles@illinois.edu' });
  // No service or endpoint deactivates volunteers yet (a documented non-goal), so the seed
  // flips the flag directly, the way tests/factories.ts does.
  await VolunteerModel.updateOne({ _id: charles._id }, { isActive: false });

  const opening = await createEvent({
    name: 'Check-in and Opening Ceremony',
    description: 'Badge pickup, swag, welcome talk',
    location: 'Siebel Center atrium',
    startTime: at(0),
    endTime: at(3),
  });
  const dinner = await createEvent({
    name: 'Friday Late-Night Dinner',
    location: 'Siebel Center basement',
    startTime: at(5),
    endTime: at(7),
  });
  const lunch = await createEvent({
    name: 'Saturday Hacking Lunch',
    location: 'CIF second floor',
    startTime: at(19),
    endTime: at(21),
  });
  const expo = await createEvent({
    name: 'Project Expo and Closing Ceremony',
    description: 'Demos, judging, awards',
    location: 'CIF atrium',
    startTime: at(45),
    endTime: at(48),
  });

  // Setup starts before its event and teardown ends after: shifts may extend outside the window.
  const setup = await createShift(opening._id.toString(), {
    role: 'Setup crew',
    startTime: at(-2),
    endTime: at(0),
    capacity: 6,
  });
  const checkIn = await createShift(opening._id.toString(), {
    role: 'Check-in desk',
    startTime: at(0),
    endTime: at(3),
    capacity: 4,
  });
  const fridayFood = await createShift(dinner._id.toString(), {
    role: 'Food line',
    startTime: at(5),
    endTime: at(6.5),
    capacity: 3,
  });
  const fridayCleanup = await createShift(dinner._id.toString(), {
    role: 'Cleanup',
    startTime: at(6.5),
    endTime: at(7.5),
    capacity: 2,
  });
  await createShift(lunch._id.toString(), {
    role: 'Food line',
    startTime: at(19),
    endTime: at(21),
    capacity: 3,
  });
  const wrangler = await createShift(expo._id.toString(), {
    role: 'Judging wrangler',
    startTime: at(45),
    endTime: at(47),
    capacity: 1,
  });
  await createShift(expo._id.toString(), {
    role: 'Teardown crew',
    startTime: at(47),
    endTime: at(49),
    capacity: 6,
  });

  const graceCheckIn = await createSignup(checkIn._id.toString(), {
    volunteerId: grace._id.toString(),
  });
  await createSignup(checkIn._id.toString(), { volunteerId: alan._id.toString() });
  await createSignup(setup._id.toString(), { volunteerId: margaret._id.toString() });
  // Fills the capacity-1 shift so a live signup attempt demos 409 SHIFT_FULL.
  await createSignup(wrangler._id.toString(), { volunteerId: donald._id.toString() });
  await createSignup(fridayFood._id.toString(), { volunteerId: barbara._id.toString() });
  const graceCleanup = await createSignup(fridayCleanup._id.toString(), {
    volunteerId: grace._id.toString(),
  });
  const cancelled = await cancelSignup(graceCleanup._id.toString());

  console.log(
    [
      'Seeded demo data: 8 volunteers (1 inactive), 4 events, 7 shifts, 6 signups (1 cancelled).',
      'Paste into requests.http:',
      `  @volunteerId = ${grace._id.toString()}`,
      `  @eventId = ${opening._id.toString()}`,
      `  @shiftId = ${checkIn._id.toString()}`,
      `  @signupId = ${graceCheckIn._id.toString()}`,
      `Also seeded: full shift ${wrangler._id.toString()} (SHIFT_FULL), inactive volunteer`,
      `${charles._id.toString()} (VOLUNTEER_INACTIVE), cancelled signup ${cancelled._id.toString()} (INVALID_TRANSITION).`,
    ].join('\n'),
  );
}
