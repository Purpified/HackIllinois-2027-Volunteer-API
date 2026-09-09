import { isDuplicateKeyError } from '../../common/db.ts';
import { AppError } from '../../common/errors.ts';
import { VolunteerModel, type VolunteerDoc } from './volunteer-model.ts';
import type { CreateVolunteerBody, ListVolunteersQuery } from './volunteer-schemas.ts';

// Business rules live here; this is the only file that touches VolunteerModel.

export async function createVolunteer(input: CreateVolunteerBody): Promise<VolunteerDoc> {
  try {
    return await VolunteerModel.create(input);
  } catch (err) {
    // No "does this email exist?" pre-check: two concurrent requests would both pass it.
    // The unique index is the only reliable guard, so let the database decide.
    if (isDuplicateKeyError(err)) {
      throw new AppError(
        409,
        'DUPLICATE_EMAIL',
        `A volunteer with email ${input.email} already exists`,
      );
    }
    throw err;
  }
}

export async function getVolunteerById(id: string): Promise<VolunteerDoc> {
  const volunteer = await VolunteerModel.findById(id);
  if (!volunteer) {
    throw new AppError(404, 'VOLUNTEER_NOT_FOUND', `No volunteer with id ${id}`);
  }
  return volunteer;
}

// The signup feature calls this before claiming a seat: signups are only created for
// existing, active volunteers.
export async function assertVolunteerActive(id: string): Promise<void> {
  const volunteer = await VolunteerModel.findById(id);
  if (!volunteer) {
    throw new AppError(404, 'VOLUNTEER_NOT_FOUND', `No volunteer with id ${id}`);
  }
  if (!volunteer.isActive) {
    throw new AppError(409, 'VOLUNTEER_INACTIVE', `Volunteer ${id} is inactive`);
  }
}

export type VolunteerPage = { items: VolunteerDoc[]; total: number };

export async function listVolunteers(query: ListVolunteersQuery): Promise<VolunteerPage> {
  const filter: { email?: string; isActive?: boolean } = {};
  if (query.email !== undefined) {
    filter.email = query.email;
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  // _id as a tiebreaker keeps pages stable when names repeat.
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    VolunteerModel.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(query.limit),
    VolunteerModel.countDocuments(filter),
  ]);
  return { items, total };
}
