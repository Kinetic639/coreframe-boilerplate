/**
 * Tests: hooks/queries/warehouse/audits.ts
 *
 * Covers query key factory, query hooks (success/error/initialData), and
 * mutation hooks. Particular focus on useUpdateCountLineMutation's optimistic
 * update + rollback-on-error, per the implementation plan's build-sequence
 * gate: "optimistic-update behavior tested ... before building UI on top of it."
 */
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// ─── Mock server actions ───────────────────────────────────────────────────────

vi.mock("@/app/actions/warehouse/inventory/count-sessions", () => ({
  listInventoryCountSessionsAction: vi.fn(),
  getInventoryCountSessionAction: vi.fn(),
  createInventoryCountSessionAction: vi.fn(),
  updateInventoryCountLineAction: vi.fn(),
  addUnexpectedCountLineAction: vi.fn(),
  bulkApproveCountLinesAction: vi.fn(),
  approveInventoryCountSessionAction: vi.fn(),
  updateInventoryCountSessionStatusAction: vi.fn(),
  getReorderReportAction: vi.fn(),
  setReorderSuggestionActionAction: vi.fn(),
}));

vi.mock("react-toastify", () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

import {
  listInventoryCountSessionsAction,
  getInventoryCountSessionAction,
  createInventoryCountSessionAction,
  updateInventoryCountLineAction,
  approveInventoryCountSessionAction,
  updateInventoryCountSessionStatusAction,
  setReorderSuggestionActionAction,
  getReorderReportAction,
} from "@/app/actions/warehouse/inventory/count-sessions";
import { toast } from "react-toastify";

import {
  auditKeys,
  useCountSessionsQuery,
  useCountSessionDetailQuery,
  useCreateCountSessionMutation,
  useUpdateCountLineMutation,
  useApproveCountSessionMutation,
  useUpdateCountSessionStatusMutation,
  useSetReorderSuggestionActionMutation,
  useReorderReportQuery,
  type EnrichedCountSessionDetail,
  type EnrichedReorderReportRow,
} from "../audits";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return {
    queryClient,
    wrapper: ({ children }: { children: React.ReactNode }) =>
      React.createElement(QueryClientProvider, { client: queryClient }, children),
  };
}

const BRANCH_ID = "branch-1";
const SESSION_ID = "session-1";

const DETAIL: EnrichedCountSessionDetail = {
  session: { id: SESSION_ID, status: "counting" },
  lines: [
    {
      id: "line-1",
      count_session_id: SESSION_ID,
      sequence_no: 1,
      variant_id: "variant-1",
      location_id: "loc-1",
      lot_id: null,
      serial_id: null,
      expected_quantity: 10,
      counted_quantity: null,
      variance_quantity: null,
      unit_id: "unit-1",
      status: "pending",
      source: "generated",
      reason_code: null,
      note: null,
      counted_by: null,
      counted_at: null,
      sku: "SKU-1",
      productName: "Widget",
      unitCode: "pcs",
      locationCode: "A-01",
      locationName: "Aisle A",
    },
  ],
};

beforeEach(() => vi.clearAllMocks());

// ─── auditKeys ──────────────────────────────────────────────────────────────────

describe("auditKeys", () => {
  it("generates a stable list key scoped to branch and params", () => {
    expect(auditKeys.list("branch-1", { page: 1 })).toEqual([
      "warehouse",
      "audits",
      "list",
      "branch-1",
      { page: 1 },
    ]);
  });

  it("generates a stable detail key", () => {
    expect(auditKeys.detail("session-1")).toEqual(["warehouse", "audits", "detail", "session-1"]);
  });

  it("generates a stable reorder-report key", () => {
    expect(auditKeys.reorderReport("branch-1")).toEqual([
      "warehouse",
      "audits",
      "reorder-report",
      "branch-1",
      {},
    ]);
  });
});

// ─── useCountSessionsQuery ────────────────────────────────────────────────────

describe("useCountSessionsQuery", () => {
  it("returns list data on success", async () => {
    vi.mocked(listInventoryCountSessionsAction).mockResolvedValue({
      success: true,
      data: { rows: [], totalCount: 0, page: 1, pageSize: 20 },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCountSessionsQuery(BRANCH_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.totalCount).toBe(0);
  });

  it("does not fire the query when branchId is not yet available", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCountSessionsQuery(null), { wrapper });
    expect(result.current.fetchStatus).toBe("idle");
    expect(listInventoryCountSessionsAction).not.toHaveBeenCalled();
  });

  it("surfaces an action failure as a query error", async () => {
    vi.mocked(listInventoryCountSessionsAction).mockResolvedValue({
      success: false,
      error: "Unauthorized",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCountSessionsQuery(BRANCH_ID), { wrapper });
    await waitFor(() => expect(result.current.isError).toBe(true));
    expect(result.current.error?.message).toBe("Unauthorized");
  });
});

// ─── useCountSessionDetailQuery ───────────────────────────────────────────────

describe("useCountSessionDetailQuery", () => {
  it("uses initialData when provided, without calling the action", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCountSessionDetailQuery(SESSION_ID, DETAIL), {
      wrapper,
    });
    expect(result.current.data).toEqual(DETAIL);
  });

  it("fetches when no initialData is provided", async () => {
    vi.mocked(getInventoryCountSessionAction).mockResolvedValue({
      success: true,
      data: DETAIL,
    } as never);
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCountSessionDetailQuery(SESSION_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(DETAIL);
  });
});

// ─── useCreateCountSessionMutation ────────────────────────────────────────────

describe("useCreateCountSessionMutation", () => {
  it("shows a success toast and invalidates the list on success", async () => {
    vi.mocked(createInventoryCountSessionAction).mockResolvedValue({
      success: true,
      data: { count_session_id: SESSION_ID },
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCountSessionMutation(BRANCH_ID), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ scope: { count_type: "location", location_ids: ["l1"] } });
    });

    expect(toast.success).toHaveBeenCalled();
  });

  it("shows an error toast with the action's own message on failure", async () => {
    vi.mocked(createInventoryCountSessionAction).mockResolvedValue({
      success: false,
      error: "scope.location_ids must not be empty",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useCreateCountSessionMutation(BRANCH_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ scope: { count_type: "location" } });
      } catch {
        // expected — mutateAsync rejects on failure
      }
    });

    expect(toast.error).toHaveBeenCalledWith("scope.location_ids must not be empty");
  });
});

// ─── useUpdateCountLineMutation — optimistic update + rollback ───────────────

describe("useUpdateCountLineMutation", () => {
  it("optimistically patches the cached detail before the server responds", async () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(auditKeys.detail(SESSION_ID), DETAIL);

    // Never-resolving promise so we can inspect the optimistic state
    // synchronously before settlement.
    let resolveAction!: (v: unknown) => void;
    vi.mocked(updateInventoryCountLineAction).mockReturnValue(
      new Promise((resolve) => {
        resolveAction = resolve;
      }) as never
    );

    const { result } = renderHook(() => useUpdateCountLineMutation(SESSION_ID), { wrapper });

    act(() => {
      result.current.mutate({ id: "line-1", counted_quantity: 10, status: "counted" });
    });

    await waitFor(() => {
      const cached = queryClient.getQueryData<EnrichedCountSessionDetail>(
        auditKeys.detail(SESSION_ID)
      );
      expect(cached?.lines[0].counted_quantity).toBe(10);
      expect(cached?.lines[0].status).toBe("counted");
    });

    resolveAction({ success: true, data: { id: "line-1" } });
  });

  it("rolls back the optimistic patch when the server call fails", async () => {
    const { queryClient, wrapper } = makeWrapper();
    queryClient.setQueryData(auditKeys.detail(SESSION_ID), DETAIL);

    vi.mocked(updateInventoryCountLineAction).mockResolvedValue({
      success: false,
      error: "A reason is required to approve a line with a quantity variance",
    });

    const { result } = renderHook(() => useUpdateCountLineMutation(SESSION_ID), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          id: "line-1",
          status: "approved",
          variance_quantity: -2,
        });
      } catch {
        // expected
      }
    });

    const cached = queryClient.getQueryData<EnrichedCountSessionDetail>(
      auditKeys.detail(SESSION_ID)
    );
    // Rolled back to the original pending/unset state, not left as "approved".
    expect(cached?.lines[0].status).toBe("pending");
    expect(toast.error).toHaveBeenCalledWith(
      "A reason is required to approve a line with a quantity variance"
    );
  });
});

// ─── useApproveCountSessionMutation ───────────────────────────────────────────

describe("useApproveCountSessionMutation", () => {
  it("invalidates both the detail and list caches on success", async () => {
    vi.mocked(approveInventoryCountSessionAction).mockResolvedValue({
      success: true,
      data: { count_session_id: SESSION_ID, status: "approved" },
    });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useApproveCountSessionMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: SESSION_ID });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.detail(SESSION_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });

  it("surfaces the RPC's own rejection reason unchanged (e.g. missing inventory.adjust)", async () => {
    vi.mocked(approveInventoryCountSessionAction).mockResolvedValue({
      success: false,
      error: "Missing warehouse.inventory.adjust permission",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useApproveCountSessionMutation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: SESSION_ID });
      } catch {
        // expected
      }
    });

    expect(toast.error).toHaveBeenCalledWith("Missing warehouse.inventory.adjust permission");
  });
});

// ─── useUpdateCountSessionStatusMutation ──────────────────────────────────────

describe("useUpdateCountSessionStatusMutation", () => {
  it("invalidates both the detail and list caches on success", async () => {
    vi.mocked(updateInventoryCountSessionStatusAction).mockResolvedValue({
      success: true,
      data: { id: SESSION_ID, status: "counting" },
    });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useUpdateCountSessionStatusMutation(), { wrapper });

    await act(async () => {
      await result.current.mutateAsync({ id: SESSION_ID, status: "counting" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.detail(SESSION_ID) });
    expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: auditKeys.lists() });
  });

  it("shows an error toast on failure", async () => {
    vi.mocked(updateInventoryCountSessionStatusAction).mockResolvedValue({
      success: false,
      error: "not found",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useUpdateCountSessionStatusMutation(), { wrapper });

    await act(async () => {
      try {
        await result.current.mutateAsync({ id: SESSION_ID, status: "submitted" });
      } catch {
        // expected
      }
    });

    expect(toast.error).toHaveBeenCalledWith("not found");
  });
});

// ─── useReorderReportQuery ─────────────────────────────────────────────────────

const REORDER_ROW: EnrichedReorderReportRow = {
  variant_id: "v1",
  location_id: null,
  on_hand_quantity: 2,
  reorder_point: 5,
  min_quantity: 1,
  suggested_order_quantity: 10,
  preferred_supplier_id: null,
  sku: "SKU-1",
  productName: "Widget",
  unitCode: "pcs",
  locationCode: null,
  locationName: null,
  supplierName: null,
  actionStatus: null,
};

describe("useReorderReportQuery", () => {
  it("uses initialData when provided, without calling the action", () => {
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useReorderReportQuery(BRANCH_ID, {}, [REORDER_ROW]), {
      wrapper,
    });
    expect(result.current.data).toEqual([REORDER_ROW]);
    expect(getReorderReportAction).not.toHaveBeenCalled();
  });

  it("fetches when no initialData is provided", async () => {
    vi.mocked(getReorderReportAction).mockResolvedValue({ success: true, data: [REORDER_ROW] });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useReorderReportQuery(BRANCH_ID), { wrapper });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual([REORDER_ROW]);
  });
});

// ─── useSetReorderSuggestionActionMutation ────────────────────────────────────

describe("useSetReorderSuggestionActionMutation", () => {
  it("invalidates the reorder-report cache for the branch on success", async () => {
    vi.mocked(setReorderSuggestionActionAction).mockResolvedValue({
      success: true,
      data: { id: "action-1" },
    });
    const { queryClient, wrapper } = makeWrapper();
    const invalidateSpy = vi.spyOn(queryClient, "invalidateQueries");
    const { result } = renderHook(() => useSetReorderSuggestionActionMutation(BRANCH_ID), {
      wrapper,
    });

    await act(async () => {
      await result.current.mutateAsync({ variant_id: "v1", location_id: null, status: "accepted" });
    });

    expect(invalidateSpy).toHaveBeenCalledWith({
      queryKey: ["warehouse", "audits", "reorder-report", BRANCH_ID],
    });
  });

  it("shows an error toast on failure", async () => {
    vi.mocked(setReorderSuggestionActionAction).mockResolvedValue({
      success: false,
      error: "boom",
    });
    const { wrapper } = makeWrapper();
    const { result } = renderHook(() => useSetReorderSuggestionActionMutation(BRANCH_ID), {
      wrapper,
    });

    await act(async () => {
      try {
        await result.current.mutateAsync({
          variant_id: "v1",
          location_id: null,
          status: "ignored",
        });
      } catch {
        // expected
      }
    });

    expect(toast.error).toHaveBeenCalledWith("boom");
  });
});
