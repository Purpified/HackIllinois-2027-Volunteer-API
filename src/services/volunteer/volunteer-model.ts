import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

// FILE 1 OF 5: the Mongoose model. What a volunteer looks like IN THE DATABASE.
//
// Two layers validate on purpose. Zod (volunteer-schemas.ts) checks what CLIENTS may send over
// HTTP. This schema checks what may be STORED, which also covers writers that never touch HTTP:
// the seed script, a future admin CLI, a migration.
const volunteerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // `lowercase` and `trim` normalize on save, so "  Ada@Illinois.EDU " is stored as
    // "ada@illinois.edu". `unique` is NOT a validator: it tells MongoDB to build a unique index,
    // and a duplicate insert fails with error code 11000 (handled in volunteer-service.ts).
    email: { type: String, required: true, trim: true, lowercase: true, unique: true },
    phone: { type: String, trim: true },
    // Soft-delete flag. Signups reference volunteers by id, so physically deleting a volunteer
    // would orphan their signup history. Nothing sets this to false yet; the field costs nothing
    // and means a future "deactivate volunteer" endpoint needs no migration.
    isActive: { type: Boolean, required: true, default: true },
  },
  // Adds createdAt and updatedAt, maintained by Mongoose.
  { timestamps: true },
);

// The TypeScript types are DERIVED from the schema above, so they can never drift from it.
//   Volunteer     the plain data shape (what you get from .lean() or .toObject())
//   VolunteerDoc  a full Mongoose document (has _id, .save(), and the timestamps)
export type Volunteer = InferSchemaType<typeof volunteerSchema>;
export type VolunteerDoc = HydratedDocumentFromSchema<typeof volunteerSchema>;

// The model is what services call: VolunteerModel.create(...), .findById(...), .find(...).
// Mongoose stores documents in the "volunteers" collection (lowercased, pluralized name).
export const VolunteerModel = model('Volunteer', volunteerSchema);
