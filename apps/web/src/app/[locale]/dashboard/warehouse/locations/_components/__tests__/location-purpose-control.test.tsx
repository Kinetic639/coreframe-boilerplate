import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

/**
 * Zone 5 -- tests for the minimal receiving-location designation control
 * (external review correction #5). Covers: current purpose visible, a
 * stockable location can be set to Receiving, a non-stockable location
 * cannot select Receiving, and the DB's own duplicate/invalid error is
 * surfaced safely (never a raw error).
 */

vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const getLocationPurposeAction = vi.fn();
const updateLocationAction = vi.fn();
vi.mock("@/app/actions/warehouse/locations", () => ({
  getLocationPurposeAction: (...args: unknown[]) => getLocationPurposeAction(...args),
  updateLocationAction: (...args: unknown[]) => updateLocationAction(...args),
}));

import { LocationPurposeControl } from "../location-purpose-control";
import { toast } from "react-toastify";

describe("LocationPurposeControl", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("shows the current purpose once loaded", async () => {
    getLocationPurposeAction.mockResolvedValue({
      success: true,
      data: { purpose: "receiving", canStoreInventory: true },
    });
    render(<LocationPurposeControl locationId="loc-1" />);

    const control = await screen.findByTestId("location-purpose-control");
    expect(within(control).getByText("Receiving")).toHaveAttribute("aria-pressed", "true");
  });

  it("a stockable, standard location can be set to Receiving", async () => {
    getLocationPurposeAction.mockResolvedValue({
      success: true,
      data: { purpose: "standard", canStoreInventory: true },
    });
    updateLocationAction.mockResolvedValue({ success: true, data: {} });

    render(<LocationPurposeControl locationId="loc-1" />);
    await screen.findByTestId("location-purpose-control");

    fireEvent.click(screen.getByText("Receiving"));

    await waitFor(() =>
      expect(updateLocationAction).toHaveBeenCalledWith({ id: "loc-1", purpose: "receiving" })
    );
    await waitFor(() => expect(toast.success).toHaveBeenCalledWith("Location set as receiving."));
  });

  it("a non-stockable location cannot select Receiving (disabled, client-side first line of defense)", async () => {
    getLocationPurposeAction.mockResolvedValue({
      success: true,
      data: { purpose: "standard", canStoreInventory: false },
    });
    render(<LocationPurposeControl locationId="loc-1" />);
    await screen.findByTestId("location-purpose-control");

    const receivingButton = screen.getByText("Receiving");
    expect(receivingButton).toBeDisabled();
    fireEvent.click(receivingButton);
    expect(updateLocationAction).not.toHaveBeenCalled();
  });

  it("surfaces the DB's own safe, normalized error (e.g. duplicate active receiving location) without leaking anything raw", async () => {
    getLocationPurposeAction.mockResolvedValue({
      success: true,
      data: { purpose: "standard", canStoreInventory: true },
    });
    updateLocationAction.mockResolvedValue({
      success: false,
      error: "This branch already has an active receiving location. Remove or reassign it first.",
    });

    render(<LocationPurposeControl locationId="loc-1" />);
    await screen.findByTestId("location-purpose-control");
    fireEvent.click(screen.getByText("Receiving"));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith(
        "This branch already has an active receiving location. Remove or reassign it first."
      )
    );
  });

  it("surfaces a load error without crashing", async () => {
    getLocationPurposeAction.mockResolvedValue({ success: false, error: "Unauthorized" });
    render(<LocationPurposeControl locationId="loc-1" />);
    expect(await screen.findByText("Unauthorized")).toBeInTheDocument();
  });
});
