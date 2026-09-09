import request from 'supertest';
import { describe, expect, it } from 'vitest';
import { createApp } from '../../app.ts';
import {
  UNKNOWN_ID,
  insertShift,
  insertSignup,
  insertVolunteer,
} from '../../../tests/factories.ts';
import { ShiftModel } from '../shift/shift-model.ts';
import { SignupModel } from './signup-model.ts';

const app = createApp({ logging: false });

// Signs up through the API so the shift's signupCount stays consistent with the rows.
function signUp(shiftId: string, volunteerId: string) {
  return request(app).post(`/shifts/${shiftId}/signups`).send({ volunteerId });
}

async function seatCount(shiftId: unknown): Promise<number | undefined> {
  return (await ShiftModel.findById(shiftId))?.signupCount;
}

describe('POST /shifts/:shiftId/signups', () => {
  it('creates an active signup and claims a seat', async () => {
    const shift = await insertShift({ capacity: 2 });
    const volunteer = await insertVolunteer();

    const res = await signUp(shift._id.toString(), volunteer._id.toString()).expect(201);
    expect(res.body.data).toMatchObject({
      shiftId: shift._id.toString(),
      volunteerId: volunteer._id.toString(),
      status: 'active',
    });
    expect(res.headers.location).toBe(`/signups/${res.body.data.id}`);
    expect(await seatCount(shift._id)).toBe(1);
  });

  it('returns 404 for an unknown shift without creating anything', async () => {
    const volunteer = await insertVolunteer();
    const res = await signUp(UNKNOWN_ID, volunteer._id.toString()).expect(404);
    expect(res.body.error.code).toBe('SHIFT_NOT_FOUND');
    expect(await SignupModel.countDocuments()).toBe(0);
  });

  it('returns 404 for an unknown volunteer without claiming a seat', async () => {
    const shift = await insertShift();
    const res = await signUp(shift._id.toString(), UNKNOWN_ID).expect(404);
    expect(res.body.error.code).toBe('VOLUNTEER_NOT_FOUND');
    expect(await seatCount(shift._id)).toBe(0);
  });

  it('returns 409 for an inactive volunteer', async () => {
    const shift = await insertShift();
    const volunteer = await insertVolunteer({ isActive: false });
    const res = await signUp(shift._id.toString(), volunteer._id.toString()).expect(409);
    expect(res.body.error.code).toBe('VOLUNTEER_INACTIVE');
  });

  it('returns 409 SHIFT_FULL once capacity is reached', async () => {
    const shift = await insertShift({ capacity: 1 });
    const first = await insertVolunteer();
    const second = await insertVolunteer();

    await signUp(shift._id.toString(), first._id.toString()).expect(201);
    const res = await signUp(shift._id.toString(), second._id.toString()).expect(409);
    expect(res.body.error.code).toBe('SHIFT_FULL');
    expect(await seatCount(shift._id)).toBe(1);
    expect(await SignupModel.countDocuments()).toBe(1);
  });

  it('returns 409 ALREADY_SIGNED_UP and releases the claimed seat', async () => {
    const shift = await insertShift({ capacity: 2 });
    const volunteer = await insertVolunteer();

    await signUp(shift._id.toString(), volunteer._id.toString()).expect(201);
    const res = await signUp(shift._id.toString(), volunteer._id.toString()).expect(409);
    expect(res.body.error.code).toBe('ALREADY_SIGNED_UP');
    // The compensating decrement ran: one seat taken, not two.
    expect(await seatCount(shift._id)).toBe(1);
  });

  it('allows signing up again after cancelling (the unique index is partial)', async () => {
    const shift = await insertShift({ capacity: 1 });
    const volunteer = await insertVolunteer();

    const first = await signUp(shift._id.toString(), volunteer._id.toString()).expect(201);
    await request(app).post(`/signups/${first.body.data.id}/cancel`).expect(200);
    await signUp(shift._id.toString(), volunteer._id.toString()).expect(201);

    expect(await SignupModel.countDocuments({ status: 'cancelled' })).toBe(1);
    expect(await SignupModel.countDocuments({ status: 'active' })).toBe(1);
    expect(await seatCount(shift._id)).toBe(1);
  });

  it.each([
    ['a missing volunteerId', {}, 'volunteerId'],
    ['a malformed volunteerId', { volunteerId: 'nope' }, 'volunteerId'],
    ['an unknown field', { volunteerId: UNKNOWN_ID, status: 'active' }, ''],
  ])('rejects %s with 400 VALIDATION_ERROR', async (_label, body, path) => {
    const shift = await insertShift();
    const res = await request(app)
      .post(`/shifts/${shift._id.toString()}/signups`)
      .send(body)
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details.issues[0]).toMatchObject({ location: 'body', path });
  });

  it('never oversells the last seats under concurrent signups', async () => {
    const shift = await insertShift({ capacity: 3 });
    const volunteers = await Promise.all(Array.from({ length: 8 }, () => insertVolunteer()));

    const results = await Promise.all(
      volunteers.map((volunteer) => signUp(shift._id.toString(), volunteer._id.toString())),
    );

    const statuses = results.map((res) => res.status);
    expect(statuses.filter((status) => status === 201)).toHaveLength(3);
    expect(statuses.filter((status) => status === 409)).toHaveLength(5);
    expect(await seatCount(shift._id)).toBe(3);
    expect(await SignupModel.countDocuments({ status: 'active' })).toBe(3);
  });
});

describe('GET /shifts/:shiftId/signups', () => {
  it("lists only that shift's signups and filters by status", async () => {
    const shift = await insertShift();
    const other = await insertShift();
    const active = await insertSignup({ shiftId: shift._id });
    await insertSignup({ shiftId: shift._id, status: 'cancelled' });
    await insertSignup({ shiftId: other._id });

    const all = await request(app).get(`/shifts/${shift._id.toString()}/signups`).expect(200);
    expect(all.body.meta.total).toBe(2);

    const res = await request(app)
      .get(`/shifts/${shift._id.toString()}/signups?status=active`)
      .expect(200);
    expect(res.body.data).toHaveLength(1);
    expect(res.body.data[0].id).toBe(active._id.toString());
  });

  it('returns 404 for an unknown shift, distinguishing it from an empty roster', async () => {
    const res = await request(app).get(`/shifts/${UNKNOWN_ID}/signups`).expect(404);
    expect(res.body.error.code).toBe('SHIFT_NOT_FOUND');
  });
});

describe('GET /volunteers/:volunteerId/signups', () => {
  it("lists one volunteer's signups across shifts", async () => {
    const volunteer = await insertVolunteer();
    await insertSignup({ volunteerId: volunteer._id });
    await insertSignup({ volunteerId: volunteer._id });
    await insertSignup(); // someone else's

    const res = await request(app)
      .get(`/volunteers/${volunteer._id.toString()}/signups`)
      .expect(200);
    expect(res.body.meta.total).toBe(2);
    expect(
      res.body.data.every(
        (s: { volunteerId: string }) => s.volunteerId === volunteer._id.toString(),
      ),
    ).toBe(true);
  });

  it('returns 404 for an unknown volunteer', async () => {
    const res = await request(app).get(`/volunteers/${UNKNOWN_ID}/signups`).expect(404);
    expect(res.body.error.code).toBe('VOLUNTEER_NOT_FOUND');
  });
});

describe('GET /signups/:id', () => {
  it('returns the signup', async () => {
    const signup = await insertSignup();
    const res = await request(app).get(`/signups/${signup._id.toString()}`).expect(200);
    expect(res.body.data).toMatchObject({ id: signup._id.toString(), status: 'active' });
  });

  it('returns 400 for a malformed id and 404 for an unknown one', async () => {
    await request(app).get('/signups/nope').expect(400);
    const res = await request(app).get(`/signups/${UNKNOWN_ID}`).expect(404);
    expect(res.body.error.code).toBe('SIGNUP_NOT_FOUND');
  });
});

describe('POST /signups/:id/cancel', () => {
  it('cancels the signup and releases the seat', async () => {
    const shift = await insertShift({ capacity: 1 });
    const volunteer = await insertVolunteer();
    const created = await signUp(shift._id.toString(), volunteer._id.toString()).expect(201);
    expect(await seatCount(shift._id)).toBe(1);

    const res = await request(app).post(`/signups/${created.body.data.id}/cancel`).expect(200);
    expect(res.body.data.status).toBe('cancelled');
    expect(await seatCount(shift._id)).toBe(0);

    const stored = await SignupModel.findById(created.body.data.id);
    expect(stored?.status).toBe('cancelled');
  });

  it('returns 409 INVALID_TRANSITION for a signup that is already cancelled', async () => {
    const signup = await insertSignup({ status: 'cancelled' });
    const res = await request(app).post(`/signups/${signup._id.toString()}/cancel`).expect(409);
    expect(res.body.error.code).toBe('INVALID_TRANSITION');
  });

  it('returns 404 for an unknown signup', async () => {
    const res = await request(app).post(`/signups/${UNKNOWN_ID}/cancel`).expect(404);
    expect(res.body.error.code).toBe('SIGNUP_NOT_FOUND');
  });
});
