/**
 * Tests: hooks/queries/workshop/index.ts
 *
 * Phase 10A correction (2026-09-14, external review): dedicated coverage
 * for the branch-scoped reservation query key -- the bug this pass fixes
 * (branchId missing from the cache key) and the related invalidation
 * targeting can only be proven against a REAL QueryClient/cache (the
 * component test file mocks this whole module wholesale, so it cannot
 * exercise actual cache identity). Uses renderHook with a real
 * QueryClientProvider + mocked server actions, matching the established
 * convention in hooks/queries/organization/__tests__/index.test.tsx.
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/app/actions/workshop/repair-orders", () => ({
  createRepairOrderAction: vi.fn(),
  updateRepairOrderHeaderAction: vi.fn(),
  assignRepairOrderAdvisorAction: vi.fn(),
  changeRepairOrderStatusAction: vi.fn(),
  listAdvisorCandidatesAction: vi.fn(),
  reserveRepairOrderLineAction: vi.fn(),
  releaseRepairOrderLineReservationAction: vi.fn(),
  listRepairOrderLineReservationsAction: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn(), warning: vi.fn() },
}));

import {
  workshopKeys,
  useRepairOrderLineReservationsQuery,
  useReserveRepairOrderLineMutation,
  useReleaseRepairOrderLineReservationMutation,
} from "../index";
import {
  listRepairOrderLineReservationsAction,
  reserveRepairOrderLineAction,
  releaseRepairOrderLineReservationAction,
} from "@/app/actions/workshop/repair-orders";

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

const sampleReservation = {
  id: "res-1",
  reservationNumber: "RES-1",
  status: "active" as const,
  expiresAt: null,
  createdAt: "2026-09-14T00:00:00.000Z",
  lines: [],
  outstandingQuantity: 5,
};

describe("workshopKeys.lineReservations", () => {
  it("[correction item 6] produces distinct keys for the same line under different branches", () => {
    const keyA = workshopKeys.lineReservations("branch-a", "line-1");
    const keyB = workshopKeys.lineReservations("branch-b", "line-1");
    expect(keyA).not.toEqual(keyB);
    expect(keyA).toContain("branch-a");
    expect(keyB).toContain("branch-b");
  });

  it("produces distinct keys for a null branch vs. a real branch id (same line)", () => {
    const keyNull = workshopKeys.lineReservations(null, "line-1");
    const keyReal = workshopKeys.lineReservations("branch-a", "line-1");
    expect(keyNull).not.toEqual(keyReal);
  });

  it("produces the same key for the same branch+line pair (stable identity)", () => {
    expect(workshopKeys.lineReservations("branch-a", "line-1")).toEqual(
      workshopKeys.lineReservations("branch-a", "line-1")
    );
  });
});

describe("useRepairOrderLineReservationsQuery -- branch cache isolation", () => {
  beforeEach(() => vi.clearAllMocks());

  it("[correction item 6/regression] does not reuse or render branch A's cached result for the same line mounted under branch B", async () => {
    const { wrapper, queryClient } = makeWrapper();

    const branchAData = [{ ...sampleReservation, id: "res-branch-a-should-not-leak" }];
    const branchBData = [{ ...sampleReservation, id: "res-branch-b-real" }];

    // Prime the cache exactly as if a previous render, scoped to branch A,
    // had already fetched and cached its own result.
    queryClient.setQueryData(workshopKeys.lineReservations("branch-a", "line-1"), branchAData);

    vi.mocked(listRepairOrderLineReservationsAction).mockResolvedValue({
      success: true,
      data: branchBData,
    });

    // Same line, DIFFERENT branch context (e.g. the active branch changed
    // while this line's detail view stayed mounted).
    const { result } = renderHook(
      () => useRepairOrderLineReservationsQuery("line-1", true, "branch-b"),
      { wrapper }
    );

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(result.current.data).toEqual(branchBData);
    expect(result.current.data).not.toEqual(branchAData);
    // A real fetch under branch B's own key genuinely happened -- branch
    // A's cached entry was not silently reused.
    expect(listRepairOrderLineReservationsAction).toHaveBeenCalledWith("line-1");

    // Branch A's own cache entry is untouched by branch B's fetch.
    expect(queryClient.getQueryData(workshopKeys.lineReservations("branch-a", "line-1"))).toEqual(
      branchAData
    );
  });
});

describe("useReserveRepairOrderLineMutation -- invalidation targeting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("[correction item 7] invalidates exactly the branch+line reservation key on success", async () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(reserveRepairOrderLineAction).mockResolvedValue({
      success: true,
      data: { reservationId: "res-1", reservationNumber: "RES-1", status: "active" },
    });

    const { result } = renderHook(() => useReserveRepairOrderLineMutation("line-1", "branch-a"), {
      wrapper,
    });

    await act(async () => {
      result.current.mutate({ repairOrderLineId: "line-1", locationId: "loc-1", quantity: 2 });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: workshopKeys.lineReservations("branch-a", "line-1"),
    });
  });
});

describe("useReleaseRepairOrderLineReservationMutation -- invalidation targeting", () => {
  beforeEach(() => vi.clearAllMocks());

  it("[correction item 8] invalidates exactly the branch+line reservation key on success", async () => {
    const { wrapper, queryClient } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    vi.mocked(releaseRepairOrderLineReservationAction).mockResolvedValue({
      success: true,
      data: { reservationId: "res-1", status: "cancelled" },
    });

    const { result } = renderHook(
      () => useReleaseRepairOrderLineReservationMutation("line-1", "branch-a"),
      { wrapper }
    );

    await act(async () => {
      result.current.mutate({ repairOrderLineId: "line-1", reservationId: "res-1" });
    });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: workshopKeys.lineReservations("branch-a", "line-1"),
    });
  });
});
