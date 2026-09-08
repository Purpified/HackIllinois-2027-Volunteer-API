import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

// Storage-level rules. Zod (volunteer-schemas.ts) guards the HTTP boundary; this guards every
// writer, including scripts that never touch HTTP.
const volunteerSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 100 },
    // `lowercase`/`trim` are setters: applied on assignment and when query filters are cast.
    // `unique` is an index, not a validator: duplicates fail with E11000 from MongoDB.
    email: {
      type: String,
      required: true,
      trim: true,
      lowercase: true,
      unique: true,
      maxlength: 254,
      match: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
    },
    phone: { type: String, trim: true, minlength: 7, maxlength: 20 },
    // Soft-delete flag: signups reference volunteers, so rows are never physically deleted.
    isActive: { type: Boolean, required: true, default: true },
  },
  { timestamps: true },
);

export type Volunteer = InferSchemaType<typeof volunteerSchema>;
export type VolunteerDoc = HydratedDocumentFromSchema<typeof volunteerSchema>;

export const VolunteerModel = model('Volunteer', volunteerSchema);
