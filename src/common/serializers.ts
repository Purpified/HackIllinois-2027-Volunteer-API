// Response contract: `{ data }` / `{ data, meta }` on success, `{ error }` on failure.
// Each feature converts documents to DTOs (`id` not `_id`, ISO dates, no Mongo internals).

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };

export function listMeta(page: number, limit: number, total: number): ListMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

export function toIso(date: Date): string {
  return date.toISOString();
}
