/**
 * @vitest-environment jsdom
 *
 * LocationsDataView — branch-aware DataView wiring (Zone 1 / Phase 3)
 *
 * Tests the CONSUMER WIRING only: does this component read the live active
 * branch from the store and forward it to <DataView branchId={...}>? The
 * DataView/query-key contract itself is already covered by Phase 2's own
 * tests — not re-tested here.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render } from "@testing-library/react";
import React from "react";

const { mockDataViewSpy, mockActiveBranchId } = vi.hoisted(() => ({
  mockDataViewSpy: vi.fn(),
  mockActiveBranchId: { current: "branch-a" as string | null },
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn(), refresh: vi.fn() }),
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

describe("LocationsDataView — branch-aware wiring", () => {
  beforeEach(() => {
    mockDataViewSpy.mockClear();
  });

  it("forwards the live active branch to DataView's branchId prop", () => {
    mockActiveBranchId.current = "branch-a";

    render(
      <LocationsDataView
        initialData={initialData as never}
        allLocations={[]}
        ambraLocations={[]}
        inventorySnapshot={{} as never}
        variantOptions={[]}
        qrCache={new Map()}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(
      expect.objectContaining({ queryKey: ["locations"], branchId: "branch-a" })
    );
  });

  it("forwards a different branchId when the active branch changes", () => {
    mockActiveBranchId.current = "branch-b";

    render(
      <LocationsDataView
        initialData={initialData as never}
        allLocations={[]}
        ambraLocations={[]}
        inventorySnapshot={{} as never}
        variantOptions={[]}
        qrCache={new Map()}
      />
    );

    expect(mockDataViewSpy).toHaveBeenCalledWith(expect.objectContaining({ branchId: "branch-b" }));
  });
});
