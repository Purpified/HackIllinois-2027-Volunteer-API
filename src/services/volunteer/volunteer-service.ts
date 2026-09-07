import { isDuplicateKeyError } from '../../common/db.ts';
import { AppError } from '../../common/errors.ts';
import { VolunteerModel, type VolunteerDoc } from './volunteer-model.ts';
import type { CreateVolunteerBody, ListVolunteersQuery } from './volunteer-schemas.ts';

// FILE 3 OF 5: the service. Business rules live here, and this is the ONLY file that touches
// VolunteerModel. Routers call these functions; tests can call them directly too.
//
// Services take already-validated input (the Zod output types) and either return documents or
// throw AppError for expected failures. They never know about req/res.

export async function createVolunteer(input: CreateVolunteerBody): Promise<VolunteerDoc> {
  try {
    return await VolunteerModel.create(input);
  } catch (err) {
    // Two requests can both pass a "does this email exist?" check and both insert; only the
    // unique index catches that reliably. So we do not pre-check, we let the database decide
    // and translate its answer into a 409.
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
  // findById returns null (not an error) when nothing matches. The id is already known to be
  // well-formed (Zod checked it), so "well-formed but unknown" is a 404.
  if (!volunteer) {
    throw new AppError(404, 'VOLUNTEER_NOT_FOUND', `No volunteer with id ${id}`);
  }
  return volunteer;
}

export type VolunteerPage = { items: VolunteerDoc[]; total: number };

export async function listVolunteers(query: ListVolunteersQuery): Promise<VolunteerPage> {
  // Build the MongoDB filter from the validated query. Only add keys that were given, so an
  // absent filter matches everything.
  const filter: { email?: string; isActive?: boolean } = {};
  if (query.email !== undefined) {
    filter.email = query.email;
  }
  if (query.isActive !== undefined) {
    filter.isActive = query.isActive;
  }

  // Sort by name, then _id, so two volunteers with the same name have a stable order and
  // pagination never skips or repeats a row. The page query and the count run in parallel.
  const skip = (query.page - 1) * query.limit;
  const [items, total] = await Promise.all([
    VolunteerModel.find(filter).sort({ name: 1, _id: 1 }).skip(skip).limit(query.limit),
    VolunteerModel.countDocuments(filter),
  ]);
  return { items, total };
}
