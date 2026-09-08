// Shared pieces of the response contract.
//
// Vocabulary used across the codebase:
//   DTO       "data transfer object": the shape a resource has ON THE WIRE (`id`, ISO date
//             strings, no Mongo internals). Each feature folder owns a `toXDto` function that
//             converts a Mongoose document into one. Keeping storage and API shapes separate
//             means either can change without breaking the other.
//   envelope  the fixed outer shape of every response: `{ data }` or `{ data, meta }` on
//             success, `{ error: { code, message, details? } }` on failure.

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };

export function listMeta(page: number, limit: number, total: number): ListMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// Every datetime leaves the API as an ISO-8601 string in UTC ("...Z").
export function toIso(date: Date): string {
  return date.toISOString();
}
