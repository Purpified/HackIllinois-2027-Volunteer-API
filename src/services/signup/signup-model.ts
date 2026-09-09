import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

export const SIGNUP_STATUSES = ['active', 'cancelled'] as const;
export type SignupStatus = (typeof SIGNUP_STATUSES)[number];

// A Signup claims one seat on a shift for a volunteer. Cancelling flips status instead of
// deleting the row, keeping history; the shift's signupCount tracks ACTIVE signups only.
const signupSchema = new Schema(
  {
    shiftId: { type: Schema.Types.ObjectId, ref: 'Shift', required: true },
    volunteerId: { type: Schema.Types.ObjectId, ref: 'Volunteer', required: true },
    status: { type: String, required: true, enum: SIGNUP_STATUSES, default: 'active' },
  },
  { timestamps: true },
);

// At most one ACTIVE signup per volunteer per shift. Partial, so cancelled rows accumulate
// as history and a volunteer can sign up again after cancelling.
signupSchema.index(
  { shiftId: 1, volunteerId: 1 },
  { unique: true, partialFilterExpression: { status: 'active' } },
);
// Serve the roster and schedule listings in signup order.
signupSchema.index({ shiftId: 1, createdAt: 1 });
signupSchema.index({ volunteerId: 1, createdAt: 1 });

export type Signup = InferSchemaType<typeof signupSchema>;
export type SignupDoc = HydratedDocumentFromSchema<typeof signupSchema>;

export const SignupModel = model('Signup', signupSchema);
