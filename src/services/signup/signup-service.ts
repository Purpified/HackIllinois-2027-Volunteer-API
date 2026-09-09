import type { QueryFilter } from 'mongoose';
import { isDuplicateKeyError } from '../../common/db.ts';
import { AppError } from '../../common/errors.ts';
import { assertShiftExists, claimSeat, releaseSeat } from '../shift/shift-service.ts';
import { assertVolunteerActive, getVolunteerById } from '../volunteer/volunteer-service.ts';
import { SignupModel, type Signup, type SignupDoc } from './signup-model.ts';
import type { CreateSignupBody, ListSignupsQuery } from './signup-schemas.ts';

export async function createSignup(shiftId: string, input: CreateSignupBody): Promise<SignupDoc> {
  await assertVolunteerActive(input.volunteerId);

  // Claim the seat before inserting the signup: the two writes are not atomic together, and
  // this order makes the crash-between-them failure mode a leaked seat (shift looks fuller
  // than it is), never an overbooked one.
  if (!(await claimSeat(shiftId))) {
    await assertShiftExists(shiftId);
    throw new AppError(409, 'SHIFT_FULL', `Shift ${shiftId} is at capacity`);
  }

  try {
    return await SignupModel.create({ shiftId, volunteerId: input.volunteerId });
  } catch (err) {
    await releaseSeat(shiftId);
    // No pre-check for an existing signup: the partial unique index is the only reliable
    // guard under concurrency, so let the database decide (as volunteer emails do).
    if (isDuplicateKeyError(err)) {
      throw new AppError(
        409,
        'ALREADY_SIGNED_UP',
        `Volunteer ${input.volunteerId} already has an active signup for shift ${shiftId}`,
      );
    }
    throw err;
  }
}

export async function getSignupById(id: string): Promise<SignupDoc> {
  const signup = await SignupModel.findById(id);
  if (!signup) {
    throw new AppError(404, 'SIGNUP_NOT_FOUND', `No signup with id ${id}`);
  }
  return signup;
}

export async function cancelSignup(id: string): Promise<SignupDoc> {
  // Atomic transition: of two concurrent cancels only one matches status 'active', so the
  // seat below is released exactly once.
  const cancelled = await SignupModel.findOneAndUpdate(
    { _id: id, status: 'active' },
    { $set: { status: 'cancelled' } },
    { returnDocument: 'after' },
  );
  if (!cancelled) {
    const signup = await getSignupById(id); // 404 when the signup does not exist at all
    throw new AppError(409, 'INVALID_TRANSITION', `Signup ${id} is already ${signup.status}`);
  }

  await releaseSeat(cancelled.shiftId.toString());
  return cancelled;
}

export type SignupPage = { items: SignupDoc[]; total: number };

async function listSignups(
  filter: QueryFilter<Signup>,
  query: ListSignupsQuery,
): Promise<SignupPage> {
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    SignupModel.find(filter).sort({ createdAt: 1, _id: 1 }).skip(skip).limit(query.limit),
    SignupModel.countDocuments(filter),
  ]);
  return { items, total };
}

// Both listings assert the parent first so an empty page never masks a bad id.
export async function listSignupsForShift(
  shiftId: string,
  query: ListSignupsQuery,
): Promise<SignupPage> {
  await assertShiftExists(shiftId);
  const filter: QueryFilter<Signup> = { shiftId };
  if (query.status) {
    filter.status = query.status;
  }
  return listSignups(filter, query);
}

export async function listSignupsForVolunteer(
  volunteerId: string,
  query: ListSignupsQuery,
): Promise<SignupPage> {
  // Existence only, not isActive: an inactive volunteer's history stays readable.
  await getVolunteerById(volunteerId);
  const filter: QueryFilter<Signup> = { volunteerId };
  if (query.status) {
    filter.status = query.status;
  }
  return listSignups(filter, query);
}
