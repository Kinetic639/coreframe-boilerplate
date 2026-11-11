/**
 * @vitest-environment jsdom
 *
 * Phase 10E — "Przenieś kontener": destination by location-sticker scan,
 * refusal of non-location / unavailable / current-location stickers, and the
 * confirm → action → refresh path.
 */
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => {
    const t = (key: string, values?: Record<string, unknown>) =>
      values ? `${key}:${JSON.stringify(values)}` : key;
    t.has = () => true;
    return t;
  },
}));

const h = vi.hoisted(() => ({
  relocate: vi.fn(),
  refresh: vi.fn(),
  toastError: vi.fn(),
  toastSuccess: vi.fn(),
  scanLookup: { current: null as unknown },
  scanResult: { current: undefined as string | null | undefined },
}));

vi.mock("react-toastify", () => ({ toast: { error: h.toastError, success: h.toastSuccess } }));
vi.mock("@/i18n/navigation", () => ({ useRouter: () => ({ refresh: h.refresh }) }));
vi.mock("@/app/actions/warehouse/relocate-container", () => ({
  relocateContainerAction: (...args: unknown[]) => h.relocate(...args),
}));
vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    isLoading: false,
    data: [
      { id: "loc-a", code: "ZLC-01", name: "Regał A", can_store_inventory: true },
      { id: "loc-b", code: "LAK-A", name: "Lakiernia A", can_store_inventory: true },
      { id: "loc-parent", code: "MC", name: "Magazyn", can_store_inventory: false },
    ],
  }),
}));
vi.mock("@/components/features/qr/qr-camera-scanner", () => ({
  QrCameraScanner: ({ onScanned }: { onScanned: (l: unknown) => Promise<string | null> }) => (
    <button
      data-testid="fake-scan"
      onClick={async () => {
        h.scanResult.current = await onScanned(h.scanLookup.current);
      }}
    >
      scan
    </button>
  ),
}));

import { ContainerRelocateDialog } from "../container-relocate-dialog";

function lookup(targetType: string, targetId: string) {
  return {
    id: "qr-1",
    token: "tok",
    label: null,
    status: "active",
    assignment: { target_type: targetType, target_id: targetId },
  };
}

function renderAndScan(scanned: unknown) {
  h.scanLookup.current = scanned;
  render(
    <ContainerRelocateDialog
      containerId="c-1"
      containerCode="K-184213-02"
      branchId="branch-1"
      currentLocationId="loc-a"
      currentLocationLabel="ZLC-01 · Regał A"
    />
  );
  fireEvent.click(screen.getByTestId("container-relocate-open"));
  fireEvent.click(screen.getByTestId("container-relocate-scan"));
  fireEvent.click(screen.getByTestId("fake-scan"));
}

beforeEach(() => {
  vi.clearAllMocks();
  h.scanResult.current = undefined;
});

describe("ContainerRelocateDialog", () => {
  it("a scanned location sticker becomes the destination, confirm moves and refreshes", async () => {
    h.relocate.mockResolvedValue({ success: true, data: { movementId: "mv-1" } });
    renderAndScan(lookup("warehouse.location", "loc-b"));

    await waitFor(() => expect(h.scanResult.current).toBeNull());
    expect(screen.getByTestId("container-relocate-summary")).toHaveTextContent(
      "LAK-A · Lakiernia A"
    );

    fireEvent.click(screen.getByTestId("container-relocate-confirm"));
    await waitFor(() =>
      expect(h.relocate).toHaveBeenCalledWith({
        containerId: "c-1",
        destinationLocationId: "loc-b",
      })
    );
    await waitFor(() => expect(h.refresh).toHaveBeenCalled());
    expect(h.toastSuccess).toHaveBeenCalledWith(
      'movedToast:{"code":"K-184213-02","location":"LAK-A · Lakiernia A"}'
    );
  });

  it("refuses a sticker that is not a location", async () => {
    renderAndScan(lookup("inventory.container", "c-9"));
    await waitFor(() => expect(h.scanResult.current).toBe("scanNotLocation"));
  });

  it("refuses the container's current location", async () => {
    renderAndScan(lookup("warehouse.location", "loc-a"));
    await waitFor(() => expect(h.scanResult.current).toBe("errors.same_location"));
  });

  it("refuses a location that is not offered (other branch or not stockable)", async () => {
    renderAndScan(lookup("warehouse.location", "loc-parent"));
    await waitFor(() => expect(h.scanResult.current).toBe("scanNotAvailable"));
  });

  it("shows the translated error and keeps the page when the move is rejected", async () => {
    h.relocate.mockResolvedValue({ success: false, error: "inconsistent" });
    renderAndScan(lookup("warehouse.location", "loc-b"));
    await waitFor(() => expect(h.scanResult.current).toBeNull());

    fireEvent.click(screen.getByTestId("container-relocate-confirm"));
    await waitFor(() => expect(h.toastError).toHaveBeenCalledWith("errors.inconsistent"));
    expect(h.refresh).not.toHaveBeenCalled();
  });

  it("confirm is disabled until a destination is chosen", () => {
    render(
      <ContainerRelocateDialog
        containerId="c-1"
        containerCode="K-184213-02"
        branchId="branch-1"
        currentLocationId="loc-a"
        currentLocationLabel="ZLC-01 · Regał A"
      />
    );
    fireEvent.click(screen.getByTestId("container-relocate-open"));
    expect(screen.getByTestId("container-relocate-confirm")).toBeDisabled();
  });
});
