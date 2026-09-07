// Shared pieces of the response contract. Feature folders own their own `toXDto` functions.

export type ListMeta = { page: number; limit: number; total: number; totalPages: number };

export function listMeta(page: number, limit: number, total: number): ListMeta {
  return { page, limit, total, totalPages: Math.ceil(total / limit) };
}

// Every datetime leaves the API as an ISO-8601 string in UTC ("...Z").
export function toIso(date: Date): string {
  return date.toISOString();
}
