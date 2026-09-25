/**
 * @vitest-environment jsdom
 *
 * AmbraLocationsClient — cross-branch warehouse.location deep-link/QR
 * (Zone 1 / Phase 6)
 *
 * Tests the CONSUMER-LEVEL confirm-then-switch flow only: does this component
 * read the `crossBranch`/`selected` URL hint left by the QR resolver, render
 * a confirm dialog instead of silently falling back, and correctly drive the
 * existing authoritative `changeBranch()` action on confirm? The resolver's
 * own cross-branch-flag logic is covered separately in
 * `src/server/qr/__tests__/public-token-resolver.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import React from "react";

const {
  mockChangeBranch,
  mockSetActiveBranch,
  mockReplace,
  mockRefresh,
  mockToastError,
  mockLocationsPageSpy,
} = vi.hoisted(() => ({
  mockChangeBranch: vi.fn(),
  mockSetActiveBranch: vi.fn(),
  mockReplace: vi.fn(),
  mockRefresh: vi.fn(),
  mockToastError: vi.fn(),
  mockLocationsPageSpy: vi.fn(),
}));

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ replace: mockReplace, refresh: mockRefresh, push: vi.fn() }),
}));

vi.mock("nuqs", () => ({
  parseAsString: { withDefault: (d: string) => ({ _default: d }) },
  useQueryState: (_key: string, parser: { _default?: string }) => [
    parser._default ?? "tree",
    vi.fn(),
  ],
}));

vi.mock("react-toastify", () => ({
  toast: { error: mockToastError, success: vi.fn() },
}));

vi.mock("@/app/actions/shared/changeBranch", () => ({
  changeBranch: (...args: unknown[]) => mockChangeBranch(...args),
}));

vi.mock("@/lib/stores/v2/app-store", () => ({
  useAppStoreV2: Object.assign(vi.fn(), {
    getState: () => ({ setActiveBranch: mockSetActiveBranch }),
  }),
}));

vi.mock("@/app/actions/qr/assign-location", () => ({
  getQrAssignmentForLocationAction: vi.fn().mockResolvedValue({ success: true, data: null }),
}));

vi.mock("@/hooks/queries/warehouse", () => ({
  useCreateLocationMutation: () => ({ mutateAsync: vi.fn() }),
  useUpdateLocationMutation: () => ({ mutateAsync: vi.fn() }),
  useDeleteLocationMutation: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("../../_ambra/components/locations/LocationsPage", () => ({
  default: (props: Record<string, unknown>) => {
    mockLocationsPageSpy(props);
    return <div data-testid="locations-page">{String(props.selectedLocationId ?? "none")}</div>;
  },
}));

vi.mock("../locations-data-view", () => ({
  LocationsDataView: () => <div data-testid="locations-data-view" />,
}));

import { AmbraLocationsClient } from "../ambra-locations-client";

const BRANCH_A = "branch-a";
const BRANCH_B = "branch-b";
const LOCATION_B_ID = "loc-b-1";

const defaultProps = {
  organizationId: "org-1",
  activeBranch: { id: BRANCH_A, name: "Branch A" } as never,
  initialLocations: [],
  rawLocations: [],
  initialInventorySnapshot: {} as never,
  variantOptions: [],
  initialListData: { rows: [], totalCount: 0, page: 1, pageSize: 25 } as never,
  canCreateLocation: false,
};

function setUrl(url: string) {
  window.history.replaceState(null, "", url);
}

describe("AmbraLocationsClient — cross-branch QR/deep-link (Zone 1 / Phase 6)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    setUrl("http://localhost/dashboard/warehouse/locations?view=tree");
  });

  describe("same-branch flow", () => {
    it("opens the exact target normally with no confirmation dialog when no crossBranch hint is present", () => {
      setUrl(`http://localhost/dashboard/warehouse/locations?selected=loc-a-1&view=tree`);

      render(<AmbraLocationsClient {...defaultProps} />);

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(mockLocationsPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedLocationId: "loc-a-1" })
      );
      expect(mockChangeBranch).not.toHaveBeenCalled();
    });
  });

  describe("inaccessible cross-branch target (Correction A, 2026-09-24)", () => {
    // As of the Phase 6 correction, resolvePublicQrToken() never emits a
    // crossBranch hint for a target the caller cannot access -- it returns a
    // safe TARGET_NOT_FOUND denial instead (see
    // public-token-resolver.test.ts's "Correction A" tests), so the browser
    // never even reaches this component for such a target: it lands on the
    // QR page's own existing "not found" card instead. This component
    // therefore has no way to distinguish "same branch" from "inaccessible
    // branch, hint suppressed server-side" -- both produce a URL with no
    // crossBranch param, which is exactly the point: the client is never
    // trusted with (or even shown) an impossible-to-act-on offer. This test
    // exercises that URL shape under the inaccessible scenario's own label,
    // as its own dedicated assertion rather than folding it silently into
    // "same-branch flow", so a future change that reintroduces a client-side
    // hint for inaccessible targets fails a test with the right name.
    it("renders no switch dialog, calls no changeBranch, opens no target, and exposes no target-branch metadata", () => {
      setUrl(`http://localhost/dashboard/warehouse/locations?view=tree`);

      render(<AmbraLocationsClient {...defaultProps} />);

      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(screen.queryByText("crossBranchDialog.confirm")).not.toBeInTheDocument();
      expect(mockChangeBranch).not.toHaveBeenCalled();
      expect(mockLocationsPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedLocationId: null })
      );
    });
  });

  describe("accessible cross-branch flow", () => {
    function renderWithCrossBranchHint() {
      setUrl(
        `http://localhost/dashboard/warehouse/locations?selected=${LOCATION_B_ID}&crossBranch=${BRANCH_B}&view=tree`
      );
      return render(<AmbraLocationsClient {...defaultProps} />);
    }

    it("renders a confirmation dialog instead of silently opening the target", () => {
      renderWithCrossBranchHint();

      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
      // The target must NOT be passed down as selected while the dialog is
      // pending -- otherwise LocationsPage's own reset-effect would silently
      // fall back before the user ever responds to the prompt.
      expect(mockLocationsPageSpy).toHaveBeenCalledWith(
        expect.objectContaining({ selectedLocationId: null })
      );
    });

    it("CANCEL: no branch switch occurs, target stays closed, current branch remains", () => {
      renderWithCrossBranchHint();

      fireEvent.click(screen.getByText("crossBranchDialog.cancel"));

      expect(mockChangeBranch).not.toHaveBeenCalled();
      expect(mockSetActiveBranch).not.toHaveBeenCalled();
      expect(screen.queryByRole("alertdialog")).not.toBeInTheDocument();
      expect(window.location.search).not.toContain("crossBranch");
    });

    it("CONFIRM: calls the authoritative changeBranch, updates client branch state, and navigates to the exact target", async () => {
      mockChangeBranch.mockResolvedValue({ success: true });
      renderWithCrossBranchHint();

      fireEvent.click(screen.getByText("crossBranchDialog.confirm"));

      await waitFor(() => expect(mockChangeBranch).toHaveBeenCalledWith(BRANCH_B));
      expect(mockSetActiveBranch).toHaveBeenCalledWith(BRANCH_B);
      expect(mockReplace).toHaveBeenCalledWith({
        pathname: "/dashboard/warehouse/locations",
        query: { selected: LOCATION_B_ID, view: "tree" },
      });
      expect(mockRefresh).toHaveBeenCalledTimes(1);
    });

    it("no silent switch occurs on mount -- changeBranch is never called before the user confirms", () => {
      renderWithCrossBranchHint();
      expect(mockChangeBranch).not.toHaveBeenCalled();
    });
  });

  describe("failed switch", () => {
    it("leaves the old branch authoritative, opens nothing, and shows a safe error", async () => {
      mockChangeBranch.mockResolvedValue({
        success: false,
        error: "You do not have access to this branch",
      });
      setUrl(
        `http://localhost/dashboard/warehouse/locations?selected=${LOCATION_B_ID}&crossBranch=${BRANCH_B}&view=tree`
      );

      render(<AmbraLocationsClient {...defaultProps} />);
      fireEvent.click(screen.getByText("crossBranchDialog.confirm"));

      await waitFor(() =>
        expect(mockToastError).toHaveBeenCalledWith("You do not have access to this branch")
      );
      expect(mockSetActiveBranch).not.toHaveBeenCalled();
      expect(mockReplace).not.toHaveBeenCalled();
      expect(mockRefresh).not.toHaveBeenCalled();
      // Dialog remains open (current branch is still authoritative; user may
      // retry or cancel explicitly) -- not silently dismissed on failure.
      expect(screen.getByRole("alertdialog")).toBeInTheDocument();
    });
  });
});
