/**
 * @vitest-environment jsdom
 *
 * InventoryClient (Inventory Balances) — branch-aware DataView wiring
 * (Zone 1 / Phase 3)
 *
 * Tests the CONSUMER WIRING only: does this component read the live active
 * branch from the store and forward it to <DataView branchId={...}>?
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";

const { mockDataViewSpy, mockActiveBranchId } = vi.hoisted(() => ({
  mockDataViewSpy: vi.fn(),
  mockActiveBranchId: { current: "branch-a" as string | null },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: (selector: (state: { activeBranchId: string | null }) => unknown) =>
    selector({ activeBranchId: mockActiveBranchId.current }),
}));

vi.mock("@/components/data-view/data-view", () => ({
  DataView: (props: Record<string, unknown>) => {
    mockDataViewSpy(props);
    return null;
  },
}));

vi.mock("@/app/actions/warehouse/inventory", () => ({
  adjustStockAction: vi.fn(),
  getInventoryBalanceAction: vi.fn(),
  issueStockAction: vi.fn(),
  listInventoryBalancesAction: vi.fn(),
  receiveStockAction: vi.fn(),
  transferStockAction: vi.fn(),
}));

import { InventoryClient } from "../inventory-client";

const initialData = { rows: [], totalCount: 0, page: 1, pageSize: 20 };

describe("InventoryClient (Inventory Balances) — branch-aware wiring", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards the live active branch to DataView's branchId prop", () => {
    mockActiveBranchId.current = "branch-a";

    render(
      <InventoryClient
        initialData={initialData as never}
        variants={[]}
        locations={[]}
        canOperate={false}
        canAdjust={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["inventory-balances"], branchId: "branch-a" })
    );
  });

  it("forwards a different branchId when the active branch changes", () => {
    mockActiveBranchId.current = "branch-b";

    render(
      <InventoryClient
        initialData={initialData as never}
        variants={[]}
        locations={[]}
        canOperate={false}
        canAdjust={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-b" }));
  });
});
