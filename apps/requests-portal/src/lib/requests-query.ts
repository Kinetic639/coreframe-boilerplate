"use client";

import { createContext, useContext } from "react";
import type { QueryClient } from "@tanstack/react-query";
import type { RequestView } from "@/server/requests/view.service";
import type { RequestListItem, RequestListPage } from "@/server/requests/types";

// The portal's cache, in one place for the list, the request card and the realtime
// listener: one entry per list page the address asks for and one per request card,
// per organization and branch scope (the header switcher). Reads are plain GETs
// (src/app/api/requests), so they never wait behind a save.

export type ListData = RequestListPage;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;
const READ_TIMEOUT_MS = 30_000;

export const requestKeys = {
  all: (scope: string) => ["requests", scope] as const,
  lists: (scope: string) => ["requests", scope, "list"] as const,
  list: (scope: string, key: string) => ["requests", scope, "list", key] as const,
  details: (scope: string) => ["requests", scope, "detail"] as const,
  detail: (scope: string, id: string) => ["requests", scope, "detail", id] as const,
};

/** "<org>:<branch or all>", given by the requests layout. */
export const RequestsScopeContext = createContext<string>("");
export const useRequestsScope = () => useContext(RequestsScopeContext);

async function getJson<T>(url: string): Promise<T> {
  const res = await fetch(url, {
    cache: "no-store",
    credentials: "same-origin",
    signal: AbortSignal.timeout(READ_TIMEOUT_MS),
  });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  return (await res.json()) as T;
}

export const listQuery = (scope: string, key: string, query: Record<string, string>) => ({
  queryKey: requestKeys.list(scope, key),
  queryFn: () => getJson<ListData>(`/api/requests/list?${new URLSearchParams(query)}`),
  staleTime: LIST_STALE_TIME,
  // Coming back to the tab refetches an old page, so changes missed while away (a dropped
  // realtime connection) show without a reload. A background tab makes no requests.
  refetchOnWindowFocus: true,
});

export const detailQuery = (scope: string, id: string) => ({
  queryKey: requestKeys.detail(scope, id),
  queryFn: () => getJson<RequestView>(`/api/requests/${id}`),
  staleTime: DETAIL_STALE_TIME,
  refetchOnWindowFocus: true,
});

// ---------------------------------------------------------------------------
// Writing into the cache (saves, optimistic changes)
// ---------------------------------------------------------------------------

/** What a patch replaced, to put back if the save fails. */
export type Snapshot = Array<[readonly unknown[], unknown]>;

/**
 * Writes changed fields of a request into every cached list page and its card, without
 * fetching. Returns what was there before.
 */
export function patchRequest(
  qc: QueryClient,
  scope: string,
  id: string,
  patch: Partial<RequestListItem> & Partial<Pick<RequestView["request"], "status" | "canClose">>
): Snapshot {
  const snapshot: Snapshot = [];
  for (const [key, data] of qc.getQueriesData<ListData>({ queryKey: requestKeys.lists(scope) })) {
    if (!data?.items.some((i) => i.id === id)) continue;
    snapshot.push([key, data]);
    qc.setQueryData<ListData>(key, {
      ...data,
      items: data.items.map((i) => (i.id === id ? { ...i, ...patch } : i)),
    });
  }
  const detailKey = requestKeys.detail(scope, id);
  const view = qc.getQueryData<RequestView>(detailKey);
  if (view) {
    snapshot.push([detailKey, view]);
    qc.setQueryData<RequestView>(detailKey, { ...view, request: { ...view.request, ...patch } });
  }
  return snapshot;
}

export function restore(qc: QueryClient, snapshot: Snapshot) {
  for (const [key, data] of snapshot) qc.setQueryData(key, data);
}

// ---------------------------------------------------------------------------
// Replies in flight: a realtime refetch waits for them, so a reply is never shown twice
// (once as "sending", once from the server).
// ---------------------------------------------------------------------------

const sending = new Map<string, number>();
export const replyStarted = (id: string) => sending.set(id, (sending.get(id) ?? 0) + 1);
export const replyFinished = (id: string) => {
  const n = (sending.get(id) ?? 1) - 1;
  if (n > 0) sending.set(id, n);
  else sending.delete(id);
};
export const isReplying = (id: string) => sending.has(id);
