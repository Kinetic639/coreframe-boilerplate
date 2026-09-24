/**
 * @vitest-environment jsdom
 *
 * InventoryMovementsClient — branch-aware DataView wiring (Zone 1 / Phase 3)
 *
 * Tests the CONSUMER WIRING only: does this component read the live active
 * branch from the store and forward it to <DataView branchId={...}>?
 *
 * This consumer also has a pre-existing `activeBranchId` PROP (a frozen SSR
 * value forwarded to InventoryMovementDetailPanel) which Phase 3 deliberately
 * leaves unchanged — only the DataView's own cache-identity source was
 * switched to a live store read. Both are asserted here so a future change
 * can't accidentally conflate or regress either one.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const { mockDataViewSpy, mockDetailPanelSpy, mockActiveBranchId } = vi.hoisted(() => ({
  mockDataViewSpy: vi.fn(),
  mockDetailPanelSpy: vi.fn(),
  mockActiveBranchId: { current: "branch-a" as string | null },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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

vi.mock("../inventory-movement-detail-panel", () => ({
  InventoryMovementDetailPanel: (props: Record<string, unknown>) => {
    mockDetailPanelSpy(props);
    return null;
  },
}));

vi.mock("@/app/actions/warehouse/inventory", () => ({
  getInventoryMovementAction: vi.fn(),
  listInventoryMovementsAction: vi.fn(),
}));

import { InventoryMovementsClient } from "../inventory-movements-client";

const initialData = { rows: [], totalCount: 0, page: 1, pageSize: 20 };

describe("InventoryMovementsClient — branch-aware wiring", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
    mockDetailPanelSpy.mockClear();
  });

  it("forwards the LIVE active branch to DataView's branchId prop, independent of the frozen SSR prop", () => {
    mockActiveBranchId.current = "branch-live";

    render(
      <InventoryMovementsClient
        initialData={initialData as never}
        activeBranchId="branch-frozen-ssr"
        locations={[]}
        canOperate={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["inventory-movements"], branchId: "branch-live" })
    );
  });

  it("forwards a different live branchId when the active branch changes", () => {
    mockActiveBranchId.current = "branch-b";

    render(
      <InventoryMovementsClient
        initialData={initialData as never}
        activeBranchId="branch-frozen-ssr"
        locations={[]}
        canOperate={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-b" }));
  });

  it("still forwards the original frozen SSR activeBranchId prop to InventoryMovementDetailPanel, unchanged", () => {
    mockActiveBranchId.current = "branch-live";

    render(
      <InventoryMovementsClient
        initialData={initialData as never}
        activeBranchId="branch-frozen-ssr"
        locations={[]}
        canOperate={false}
      />
    );

    // DataView is mocked out, so its own renderDetail prop is never invoked by
    // React — call it manually to get the JSX it would produce, then render
    // that, to prove the detail panel still receives the untouched,
    // pre-existing prop value, not the new live store value.
    const renderDetail = mockDataViewSpy.mock.calls[0][0].renderDetail as (
      detail: unknown
    ) => React.ReactElement;
    render(renderDetail({}));

    expect(mockDetailPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeBranchId: "branch-frozen-ssr" })
    );
  });
});
