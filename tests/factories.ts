// Small helpers that put realistic documents in the database for tests. Each call makes a
// distinct record unless you override a field.
import { VolunteerModel, type VolunteerDoc } from '../src/services/volunteer/volunteer-model.ts';

// Named insertX (not createX) on purpose: these bypass the service layer and Zod, writing
// straight to MongoDB, so they must never be mistaken for the real createVolunteer().
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

// A well-formed ObjectId that no document has. Useful for "exists but not found" tests.
export const UNKNOWN_ID = '000000000000000000000000';
