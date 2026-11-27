import { PAGE_SIZES, REQUEST_FILTERS, type PageSize, type RequestFilter } from "./types";
import type { ListRequestsInput } from "./requests.service";

/** Request header carrying the URL query to the persistent requests layout (set in proxy.ts). */
export const LIST_QUERY_HEADER = "x-portal-list-query";

export type ListSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/**
 * URL query <-> list input. Defaults: own requests, open, newest activity first. The page,
 * its size and the type use the ERP list's keys (`strona`, `wierszy`, `typ`); the old
 * `p`, `size` and `type` are still read.
 */
export function parseListParams(sp: ListSearchParams): ListRequestsInput {
  const filter = one(sp.f);
  const page = Number(one(sp.strona) ?? one(sp.p));
  const type = one(sp.typ) ?? one(sp.type);
  const size = Number(one(sp.wierszy) ?? one(sp.size));
  return {
    scope: one(sp.scope) === "branch" ? "branch" : "mine",
    filter: (REQUEST_FILTERS as readonly string[]).includes(filter ?? "")
      ? (filter as RequestFilter)
      : "open",
    typeId: type && /^[0-9a-f-]{36}$/i.test(type) ? type : null,
    search: one(sp.q)?.slice(0, 80) || null,
    sort: one(sp.sort) === "newest" ? "newest" : "activity",
    page: Number.isInteger(page) && page > 0 ? page : 1,
    size: (PAGE_SIZES as readonly number[]).includes(size) ? (size as PageSize) : PAGE_SIZES[0],
  };
}

/** Query object for links, omitting defaults so URLs stay short. */
export function toQuery(
  input: ListRequestsInput,
  patch: Partial<ListRequestsInput> = {}
): Record<string, string> {
  const v = { ...input, ...patch };
  const q: Record<string, string> = {};
  if (v.scope === "branch") q.scope = "branch";
  if (v.filter !== "open") q.f = v.filter;
  if (v.typeId) q.typ = v.typeId;
  if (v.search) q.q = v.search;
  if (v.sort === "newest") q.sort = "newest";
  if (v.page > 1) q.strona = String(v.page);
  if (v.size !== PAGE_SIZES[0]) q.wierszy = String(v.size);
  return q;
}

/** Stable identity of a list query (server layout and client list compare it). */
export function listKey(query: Record<string, string>): string {
  return new URLSearchParams(
    Object.entries(query).sort(([a], [b]) => a.localeCompare(b))
  ).toString();
}
