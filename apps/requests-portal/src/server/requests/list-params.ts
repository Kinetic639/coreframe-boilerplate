import { REQUEST_FILTERS, type RequestFilter } from "./types";
import type { ListRequestsInput } from "./requests.service";

export type ListSearchParams = Record<string, string | string[] | undefined>;

const one = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);

/** URL query <-> list input. Defaults: own requests, open, newest activity first. */
export function parseListParams(sp: ListSearchParams): ListRequestsInput {
  const filter = one(sp.f);
  const page = Number(one(sp.p));
  const type = one(sp.type);
  return {
    scope: one(sp.scope) === "branch" ? "branch" : "mine",
    filter: (REQUEST_FILTERS as readonly string[]).includes(filter ?? "")
      ? (filter as RequestFilter)
      : "open",
    typeId: type && /^[0-9a-f-]{36}$/i.test(type) ? type : null,
    search: one(sp.q)?.slice(0, 80) || null,
    sort: one(sp.sort) === "newest" ? "newest" : "activity",
    page: Number.isInteger(page) && page > 0 ? page : 1,
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
  if (v.typeId) q.type = v.typeId;
  if (v.search) q.q = v.search;
  if (v.sort === "newest") q.sort = "newest";
  if (v.page > 1) q.p = String(v.page);
  return q;
}
