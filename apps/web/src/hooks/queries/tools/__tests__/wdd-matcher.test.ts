/**
 * Tests: hooks/queries/tools/wdd-matcher.ts -- branch-aware session-list
 * query key (Zone 1 / Phase 4).
 *
 * Proves: wddMatcherKeys.sessions(branchId) is genuine cache identity
 * (differs across branches, stable within one), useSessionsQuery actually
 * uses it (and stays disabled with no branch), branchId never leaks into
 * the server request payload, and every mutation that invalidates the
 * session list targets the correctly branch-scoped key.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import type { WddMatcherSession } from "@/server/services/wdd-matcher.service";

vi.mock("@/app/actions/tools/wdd-matcher", () => ({
  listSessionsAction: vi.fn(),
  getSessionResultsAction: vi.fn(),
  getSessionExtractedDataAction: vi.fn(),
  createAutoSessionAction: vi.fn(),
  uploadAndParseFileAction: vi.fn(),
  runMatchingAction: vi.fn(),
  exportCsvAction: vi.fn(),
  getEnhancedPdfDataAction: vi.fn(),
  approveAndMaterializeSessionAction: vi.fn(),
  retryMaterializationAction: vi.fn(),
  getMaterializationStatusAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

import {
  listSessionsAction,
  createAutoSessionAction,
  runMatchingAction,
  approveAndMaterializeSessionAction,
} from "@/app/actions/tools/wdd-matcher";
import {
  wddMatcherKeys,
  useSessionsQuery,
  useCreateAutoSessionMutation,
  useRunMatchingMutation,
  useApproveAndMaterializeSessionMutation,
} from "../wdd-matcher";

function makeWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const session = (id: string): WddMatcherSession =>
  ({ id, name: `Session ${id}`, status: "pending" }) as WddMatcherSession;

beforeEach(() => {
  vi.clearAllMocks();
});

describe("wddMatcherKeys.sessions -- branch-aware cache identity", () => {
  it("produces different keys for different branches", () => {
    expect(wddMatcherKeys.sessions("branch-a")).not.toEqual(wddMatcherKeys.sessions("branch-b"));
  });

  it("produces the same key for the same branch (stable identity)", () => {
    expect(wddMatcherKeys.sessions("branch-a")).toEqual(wddMatcherKeys.sessions("branch-a"));
  });

  it("produces a deterministic key when branch is null, distinct from any real branch", () => {
    expect(wddMatcherKeys.sessions(null)).toEqual(wddMatcherKeys.sessions(null));
    expect(wddMatcherKeys.sessions(null)).not.toEqual(wddMatcherKeys.sessions("branch-a"));
  });

  it("matches the required shape: [...all, 'sessions', branchId]", () => {
    expect(wddMatcherKeys.sessions("branch-a")).toEqual([
      "svwms-wdd-matcher",
      "sessions",
      "branch-a",
    ]);
  });
});

describe("useSessionsQuery -- branch-aware query behavior", () => {
  it("different branchId values produce different cache entries for the same query", async () => {
    const { queryClient, wrapper } = makeWrapper();
    vi.mocked(listSessionsAction).mockResolvedValue({ success: true, data: [session("s1")] });

    const { result: resultA } = renderHook(() => useSessionsQuery("branch-a"), { wrapper });
    const { result: resultB } = renderHook(() => useSessionsQuery("branch-b"), { wrapper });

    await waitFor(() => expect(resultA.current.isFetched).toBe(true));
    await waitFor(() => expect(resultB.current.isFetched).toBe(true));

    expect(queryClient.getQueryData(wddMatcherKeys.sessions("branch-a"))).toBeDefined();
    expect(queryClient.getQueryData(wddMatcherKeys.sessions("branch-b"))).toBeDefined();
  });

  it("does not run (stays disabled) when branchId is null -- no request fired", async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(listSessionsAction).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useSessionsQuery(null), { wrapper });

    // Give any accidental fetch a chance to happen before asserting it didn't.
    await new Promise((resolve) => setTimeout(resolve, 20));

    expect(result.current.fetchStatus).toBe("idle");
    expect(listSessionsAction).not.toHaveBeenCalled();
  });

  it("branchId is never forwarded to listSessionsAction -- cache identity only", async () => {
    const { wrapper } = makeWrapper();
    vi.mocked(listSessionsAction).mockResolvedValue({ success: true, data: [] });

    const { result } = renderHook(() => useSessionsQuery("branch-a"), { wrapper });

    await waitFor(() => expect(result.current.isFetched).toBe(true));

    expect(listSessionsAction).toHaveBeenCalledWith();
    expect(listSessionsAction).toHaveBeenCalledTimes(1);
  });

  it("switching the branchId argument (branch switch) causes the query to observe a new cache identity", async () => {
    const { queryClient, wrapper } = makeWrapper();
    vi.mocked(listSessionsAction).mockResolvedValue({ success: true, data: [session("s1")] });

    const { result, rerender } = renderHook(({ branchId }) => useSessionsQuery(branchId), {
      wrapper,
      initialProps: { branchId: "branch-a" as string | null },
    });

    await waitFor(() => expect(result.current.isFetched).toBe(true));
    expect(listSessionsAction).toHaveBeenCalledTimes(1);

    rerender({ branchId: "branch-b" });

    await waitFor(() => expect(listSessionsAction).toHaveBeenCalledTimes(2));

    expect(queryClient.getQueryData(wddMatcherKeys.sessions("branch-a"))).toBeDefined();
    expect(queryClient.getQueryData(wddMatcherKeys.sessions("branch-b"))).toBeDefined();
  });
});

describe("Mutation invalidation -- targets the correctly branch-scoped sessions key", () => {
  it("useCreateAutoSessionMutation invalidates only the current branch's sessions key", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(createAutoSessionAction).mockResolvedValue({ success: true, data: session("new") });

    const onCreated = vi.fn();
    const { result } = renderHook(() => useCreateAutoSessionMutation(onCreated, "branch-a"), {
      wrapper,
    });

    result.current.mutate();

    await waitFor(() => expect(onCreated).toHaveBeenCalled());

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wddMatcherKeys.sessions("branch-a") });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: wddMatcherKeys.sessions("branch-b"),
    });
  });

  it("useRunMatchingMutation invalidates only the current branch's sessions key", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(runMatchingAction).mockResolvedValue({ success: true, data: {} as never });

    const { result } = renderHook(() => useRunMatchingMutation("branch-a"), { wrapper });

    result.current.mutate("session-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wddMatcherKeys.sessions("branch-a") });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: wddMatcherKeys.sessions("branch-b"),
    });
  });

  it("useApproveAndMaterializeSessionMutation invalidates only the current branch's sessions key", async () => {
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(approveAndMaterializeSessionAction).mockResolvedValue({
      success: true,
      data: { session: session("s1"), materialization: null, materializationError: null } as never,
    });

    const { result } = renderHook(() => useApproveAndMaterializeSessionMutation("branch-a"), {
      wrapper,
    });

    result.current.mutate("session-1");

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: wddMatcherKeys.sessions("branch-a") });
    expect(invalidateSpy).not.toHaveBeenCalledWith({
      queryKey: wddMatcherKeys.sessions("branch-b"),
    });
  });

  it("a mutation for one branch does not invalidate another branch's cached session list", async () => {
    const { queryClient, wrapper } = makeWrapper();
    vi.mocked(listSessionsAction).mockResolvedValue({ success: true, data: [session("s1")] });
    vi.mocked(runMatchingAction).mockResolvedValue({ success: true, data: {} as never });

    // Seed both branches' caches.
    const { result: sessionsB } = renderHook(() => useSessionsQuery("branch-b"), { wrapper });
    await waitFor(() => expect(sessionsB.current.isFetched).toBe(true));

    const branchBQueryBefore = queryClient.getQueryState(wddMatcherKeys.sessions("branch-b"));
    expect(branchBQueryBefore?.isInvalidated).toBe(false);

    const { result: runMatching } = renderHook(() => useRunMatchingMutation("branch-a"), {
      wrapper,
    });
    runMatching.current.mutate("session-1");
    await waitFor(() => expect(runMatching.current.isSuccess).toBe(true));

    const branchBQueryAfter = queryClient.getQueryState(wddMatcherKeys.sessions("branch-b"));
    expect(branchBQueryAfter?.isInvalidated).toBe(false);
  });
});
