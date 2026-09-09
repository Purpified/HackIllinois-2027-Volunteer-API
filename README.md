# Volunteer Shift API

Backend API for creating and managing volunteer shift signups, built for the HackIllinois 2027
Systems take-home. TypeScript, Express 5, MongoDB via Mongoose 9, validation with Zod 4.

## Run it

```bash
npm install        # first run also downloads a MongoDB binary (~100 MB) for local/test use
npm run dev        # http://localhost:3000, in-memory MongoDB unless MONGO_URI is set
npm test           # vitest against a fresh in-memory MongoDB per test file
npm run verify     # typecheck + lint + format check + tests (what CI runs)
npx vitest run src/services/...
```

Requires Node 24 or newer. See `.env.example` for configuration.

When the development database is empty, `npm run dev` seeds a demo weekend — volunteers,
events, shifts, and signups anchored on `EVENT_START` — and prints ids ready to paste into
`requests.http`.

## API

Every success is `{ "data": ... }` (lists add `"meta": { page, limit, total, totalPages }`);
every failure is `{ "error": { code, message, details? } }` with a stable machine-readable code.
List endpoints paginate with `?page` and `?limit` (max 100). Request datetimes must be ISO-8601
with a timezone offset or `Z`; responses always return UTC. `requests.http` is a runnable tour
of all of it, including the error cases.

| Method and path                        | Purpose                                                                                                   |
| -------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `GET /health`                          | 200 when the database is reachable, 503 otherwise                                                         |
| `POST /volunteers`                     | Register a volunteer; duplicate email is a 409 `DUPLICATE_EMAIL`                                          |
| `GET /volunteers`                      | List; `?email=` exact lookup (how a client finds its own id), `?isActive=`                                |
| `GET /volunteers/:id`                  | Fetch one volunteer                                                                                       |
| `POST /events`                         | Create a scheduled activity                                                                               |
| `GET /events`                          | List by start time; `?from=&to=` selects events that overlap the window                                   |
| `GET /events/:id`                      | Fetch one event                                                                                           |
| `PATCH /events/:id`                    | Partial update; times are re-validated on the merged result                                               |
| `POST /events/:eventId/shifts`         | Create a shift under an event                                                                             |
| `GET /events/:eventId/shifts`          | An event's shifts, by start time                                                                          |
| `GET /shifts/:id`                      | Fetch one shift, including `capacity` and `signupCount`                                                   |
| `PATCH /shifts/:id`                    | Partial update; capacity below active signups is a 409 `CAPACITY_BELOW_SIGNUPS`                           |
| `POST /shifts/:shiftId/signups`        | Sign a volunteer up (body: `volunteerId`); 409 on `SHIFT_FULL`, `ALREADY_SIGNED_UP`, `VOLUNTEER_INACTIVE` |
| `GET /shifts/:shiftId/signups`         | The roster; `?status=` filters to `active` or `cancelled`                                                 |
| `GET /volunteers/:volunteerId/signups` | A volunteer's schedule; `?status=` as above                                                               |
| `GET /signups/:id`                     | Fetch one signup                                                                                          |
| `POST /signups/:id/cancel`             | Cancel: releases the seat, keeps the row; repeating is a 409 `INVALID_TRANSITION`                         |

## Data model

Four collections. An Event is a scheduled activity; a Shift is a unit of volunteer work
belonging to one event; a Signup joins a volunteer to a shift.

```
Volunteer (unique email, isActive)     Event (endTime > startTime)
      \                                  |
       \                               Shift (role, times, capacity, signupCount)
        \                                |
         `----------------------- Signup (status: active | cancelled)
                                  unique (shiftId, volunteerId) where status = 'active'
```

Ids are ObjectIds exposed as 24-character hex strings. Documents leave the API only through
per-feature DTO mappers (`id` not `_id`, ISO dates, no Mongo internals), so nothing added to a
schema becomes public by accident. Validation runs at both boundaries: Zod on every request
(strict objects, so unknown or misspelled fields are a 400, and server-owned fields like
`signupCount` simply are not accepted) and Mongoose rules on every write, so a script that
skips HTTP hits the same guards.

## Design notes

### Capacity under concurrency

The naive implementation — count the roster, compare to capacity, insert — races: two requests
for the last seat both pass the check and the shift oversells. MongoDB's strong guarantee is
single-document atomicity, so each shift carries a denormalized `signupCount` and a signup
claims its seat with one conditional update:

```js
ShiftModel.findOneAndUpdate(
  { _id: shiftId, $expr: { $lt: ['$signupCount', '$capacity'] } },
  { $inc: { signupCount: 1 } },
);
```

Match and increment are indivisible, so concurrent racers serialize inside the database and the
loser matches nothing (409 `SHIFT_FULL`). The signup row is inserted after the claim; the two
writes are not atomic together (multi-document transactions need a replica set, more machinery
than this project warrants), so the order is chosen for its failure mode: a crash between them
leaks a seat — the shift looks slightly fuller than it is — but can never overbook. A failed
insert compensates by releasing the seat. The test suite proves the property by firing eight
concurrent signups at a capacity-3 shift and asserting exactly three succeed.

Lowering a shift's capacity uses the same trick in reverse: the `signupCount <= newCapacity`
condition rides on the update itself, so a concurrent signup cannot slip between a pre-check
and the write.

### Duplicate signups

There is no "already signed up?" pre-check — two concurrent requests would both pass it. A
unique index on `(shiftId, volunteerId)` is the only reliable guard, and the database's E11000
is translated to a 409 `ALREADY_SIGNED_UP` (the same pattern as volunteer emails). The index is
partial — it applies only to rows with `status: 'active'` — so cancelled signups accumulate as
history and a volunteer can sign up again after cancelling. One visible consequence of the
claim-before-insert order: a duplicate attempt against a full shift reports `SHIFT_FULL`
rather than `ALREADY_SIGNED_UP`; both are honest 409s.

### Cancel is a transition, not a delete

`POST /signups/:id/cancel` rather than `DELETE`: the row survives (with `status: 'cancelled'`),
so DELETE's promise of removal would be false, and cancelling is not idempotent — the second
attempt is a deliberate 409 `INVALID_TRANSITION`, because cancel has a side effect (releasing
the seat) that must apply exactly once. That exactly-once is enforced the same way as capacity:
the status flip is a conditional update matching `status: 'active'`, so only one of two
concurrent cancels wins and decrements. The verb-endpoint pattern also leaves room for future
transitions (check-in, no-show) without reshaping the API.

### Referential integrity without foreign keys

MongoDB does not enforce references, so parents are asserted before children are written:
shifts check their event, signups check their shift and that the volunteer exists and is
active. Assert-then-insert is not transactional, which is safe here because nothing is ever
deleted — volunteers deactivate via `isActive` instead of disappearing, and events, shifts,
and signups have no delete at all. Nested listings assert the parent too, so an empty roster
(`200 []`) is never confused with a mistyped id (`404`).

### Smaller decisions

- Shift times are not constrained to the event's window: setup and teardown crews legitimately
  start early or end late, and the constraint would force cross-collection validation on every
  event update. Only `endTime > startTime` is enforced, at both boundaries.
- A shift's `eventId` is immutable: moving a shift would silently drag its signups to another
  event. Strict body schemas reject the field with no special code.
- PATCH validity is checked on merged values (a partial body may carry only one of the two
  times, so the schema alone cannot rule).
- Unrecognized server errors log full details under a random reference id and return only the
  reference — internals never leak, but a reported id greps straight to the cause.
- Datetimes without a timezone are rejected outright: they mean a different instant on every
  machine that parses them.

### Non-goals

No auth (clients find their own id via `GET /volunteers?email=`); no prevention of overlapping
signups for one volunteer; rosters return ids rather than embedded profiles (the schema `ref`s
make `populate` the natural extension); no hard deletes. There is also no endpoint yet to
deactivate a volunteer — `isActive` and its 409 guard exist so the data model supports it, and
tests exercise it by writing the flag directly.

### Testing

Vitest + supertest against a real MongoDB (`mongodb-memory-server`), not mocks: each test file
gets its own database process, each test wipes collections while keeping indexes, and indexes
are synced up front so unique-index tests cannot pass vacuously. That realism is what lets the
suite prove the interesting properties — E11000 translation, the partial index, and the
concurrent-signup race — against the actual storage engine.
