/**
 * @vitest-environment jsdom
 *
 * LocationsDataView — branch-aware DataView wiring (Zone 1 / Phase 3,
 * updated post main-integration to the canonical `scope`/`dataViewScope.branch`
 * contract — see docs/mvp/reviews/main-zone1-integration-resolution-2026-09-25/).
 *
 * Tests the CONSUMER WIRING only: does this component forward its own
 * `organizationId`/`branchId` props into <DataView scope={dataViewScope.branch(...)}>?
 * The DataView/query-key contract itself (does a different scope produce a
 * different cache identity) is covered by main's own
 * data-view-foundation.test.ts — not re-tested here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const mockDataViewSpy = vi.fn();

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
  Link: ({ children }: { children: React.ReactNode }) => <>{children}</>,
}));

vi.mock("@/components/data-view/data-view", () => ({
  DataView: (props: Record<string, unknown>) => {
    mockDataViewSpy(props);
    return null;
  },
}));

vi.mock("../print-location-labels-dialog", () => ({
  PrintLocationLabelsDialog: () => null,
}));

vi.mock("@/app/actions/warehouse/locations", () => ({
  listLocationsPaginatedAction: vi.fn(),
  getLocationDetailAction: vi.fn(),
}));

vi.mock("@/app/actions/qr/assign-location", () => ({
  getQrAssignmentForLocationAction: vi.fn(),
}));

import { LocationsDataView } from "../locations-data-view";

const initialData = { rows: [], totalCount: 0, page: 1, pageSize: 20 };
const ORG_ID = "org-1";

describe("LocationsDataView — branch-aware wiring (scope contract)", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards its own organizationId/branchId props into DataView's scope", () => {
    render(
      <LocationsDataView
        organizationId={ORG_ID}
        branchId="branch-a"
        initialData={initialData as never}
        allLocations={[]}
        ambraLocations={[]}
        inventorySnapshot={{} as never}
        variantOptions={[]}
        qrCache={new Map()}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-a" },
      })
    );
  });

  it("forwards a different scope when the branchId prop changes", () => {
    render(
      <LocationsDataView
        organizationId={ORG_ID}
        branchId="branch-b"
        initialData={initialData as never}
        allLocations={[]}
        ambraLocations={[]}
        inventorySnapshot={{} as never}
        variantOptions={[]}
        qrCache={new Map()}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        scope: { kind: "branch", organizationId: ORG_ID, branchId: "branch-b" },
      })
    );
  });
});
