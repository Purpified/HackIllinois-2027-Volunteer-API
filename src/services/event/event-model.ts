import { Schema, model, type HydratedDocumentFromSchema, type InferSchemaType } from 'mongoose';

// FILE 1 OF 5: the Mongoose model. An Event is a scheduled activity at the hackathon: Opening
// Ceremony, Friday Dinner, Overnight Hacking, Project Expo. Shifts belong to events (a shift's
// `eventId` points here) and volunteers sign up for shifts, so "the volunteers at an event" is
// the union of its shift rosters. There is deliberately no second way to attach a volunteer to
// an event: one signup path means one set of rules to keep consistent.
const eventSchema = new Schema(
  {
    name: { type: String, required: true, trim: true, maxlength: 120 },
    description: { type: String, trim: true, maxlength: 2000 },
    location: { type: String, trim: true, maxlength: 120 },
    // Stored as BSON dates, which are always UTC. Input must carry a timezone offset
    // (event-schemas.ts rejects "2027-02-26T17:00:00" with no offset).
    startTime: { type: Date, required: true },
    endTime: { type: Date, required: true },
  },
  { timestamps: true },
);

// The list endpoint sorts and windows by start time.
eventSchema.index({ startTime: 1 });

// Defence in depth for writers that never go through HTTP (the seed script): a document with
// endTime <= startTime fails to save even without Zod. `invalidate` records a validation error
// on that path; Mongoose then rejects the save with a ValidationError.
// Runs on create()/save() only. It does NOT run on findOneAndUpdate, which is why the service
// re-checks the merged times on PATCH.
eventSchema.pre('validate', function () {
  if (this.endTime <= this.startTime) {
    this.invalidate('endTime', 'endTime must be after startTime');
  }
});

// Types derived from the schema, exactly as in volunteer-model.ts.
export type Event = InferSchemaType<typeof eventSchema>;
export type EventDoc = HydratedDocumentFromSchema<typeof eventSchema>;

// Collection: "events".
export const EventModel = model('Event', eventSchema);
