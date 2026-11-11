/**
 * @vitest-environment jsdom
 *
 * InventoryMovementsClient — branch-aware DataView wiring (Zone 1 / Phase 3,
 * updated post main-integration to the canonical `scope`/`dataViewScope.branch`
 * contract — see docs/mvp/reviews/main-zone1-integration-resolution-2026-09-25/).
 *
 * Zone 1's original version of this component had a deliberate split: a
 * live `useAppStoreV2` read fed DataView's own cache identity, while a
 * separate, frozen SSR `activeBranchId` prop fed the detail panel unchanged.
 * Main's independent DataView refactor (which this integration adopts, see
 * the resolution matrix) consolidated this consumer onto a single
 * `activeBranchId` PROP, used consistently for both `scope` and the detail
 * panel. This is safe: (a) main's own parallel Balances/Products consumers
 * already use a single prop-based value successfully, with no live/frozen
 * split; (b) Zone 1 Phase 1's own branch-switch mechanism always navigates
 * away to /dashboard/start on switch, fully remounting this component (and
 * refreshing its props) on next visit — the same-mounted-instance staleness
 * scenario the original live read defended against does not occur in normal
 * navigation. Verified here: the SAME prop value now reaches both `scope`
 * and the detail panel.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const mockDataViewSpy = vi.fn();
const mockDetailPanelSpy = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
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
const ORG_ID = "org-1";

describe("InventoryMovementsClient — branch-aware wiring (scope contract)", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
    mockDetailPanelSpy.mockClear();
  });

  it("forwards its own organizationId/activeBranchId props into DataView's scope", () => {
    render(
      <InventoryMovementsClient
        organizationId={ORG_ID}
        initialData={initialData as never}
        activeBranchId="branch-a"
        locations={[]}
        canOperate={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-a" },
      })
    );
  });

  it("forwards a different scope when the activeBranchId prop changes", () => {
    render(
      <InventoryMovementsClient
        organizationId={ORG_ID}
        initialData={initialData as never}
        activeBranchId="branch-b"
        locations={[]}
        canOperate={false}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-b" },
      })
    );
  });

  it("forwards the SAME activeBranchId prop value to InventoryMovementDetailPanel", () => {
    render(
      <InventoryMovementsClient
        organizationId={ORG_ID}
        initialData={initialData as never}
        activeBranchId="branch-a"
        locations={[]}
        canOperate={false}
      />
    );

    // DataView is mocked out, so its own renderDetail prop is never invoked by
    // React — call it manually to get the JSX it would produce, then render
    // that, to prove the detail panel receives the exact same branch value
    // used for the DataView's own scope, not a stale/divergent one.
    const renderDetail = mockDataViewSpy.mock.calls[0][0].renderDetail as (
      detail: unknown
    ) => React.ReactElement;
    render(renderDetail({}));

    expect(mockDetailPanelSpy).toHaveBeenCalledWith(
      expect.objectContaining({ activeBranchId: "branch-a" })
    );
  });
});
