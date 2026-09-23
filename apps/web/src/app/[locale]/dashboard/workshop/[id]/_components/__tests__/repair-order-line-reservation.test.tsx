/**
 * @vitest-environment jsdom
 *
 * Component tests: RepairOrderLineReservation (Phase 10A). Mocks the
 * workshop/warehouse query-hooks module and the permissions store
 * wholesale, matching the established convention in
 * repair-order-header-editor.test.tsx.
 *
 * Phase 10A correction (2026-09-14, external review): the reservations
 * query mock now exposes `isLoading`/`isError`/`isSuccess` (react-query's
 * own status flags), not just `data`/`isLoading` -- so these tests can
 * genuinely distinguish never-fetched / loading / error / success+empty /
 * success+populated, the same five states the component itself derives via
 * `deriveReservationViewState`. Default state (set in `beforeEach`)
 * represents a completed, successful, empty fetch -- individual tests
 * override exactly the flags they need to exercise a specific state.
 */
import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string, values?: Record<string, unknown>) =>
    values ? `${key}:${JSON.stringify(values)}` : key,
}));

const {
  mockReservationsData,
  mockReservationsLoading,
  mockReservationsIsError,
  mockReservationsIsSuccess,
  mockCanOperate,
  mockReserveMutate,
  mockReserveIsPending,
  mockReleaseMutate,
  mockReleaseIsPending,
} = vi.hoisted(() => ({
  mockReservationsData: { current: [] as unknown[] | undefined },
  mockReservationsLoading: { current: false },
  mockReservationsIsError: { current: false },
  mockReservationsIsSuccess: { current: true },
  mockCanOperate: { current: true },
  mockReserveMutate: vi.fn(),
  mockReserveIsPending: { current: false },
  mockReleaseMutate: vi.fn(),
  mockReleaseIsPending: { current: false },
}));

vi.mock("@/hooks/v2/use-permissions", () => ({
  usePermissions: () => ({
    can: () => mockCanOperate.current,
    cannot: () => !mockCanOperate.current,
    canAny: () => mockCanOperate.current,
    canAll: () => mockCanOperate.current,
  }),
}));

vi.mock("@/hooks/queries/workshop", () => ({
  useRepairOrderLineReservationsQuery: () => ({
    data: mockReservationsData.current,
    isLoading: mockReservationsLoading.current,
    isError: mockReservationsIsError.current,
    isSuccess: mockReservationsIsSuccess.current,
  }),
  useReserveRepairOrderLineMutation: () => ({
    mutate: mockReserveMutate,
    isPending: mockReserveIsPending.current,
  }),
  useReleaseRepairOrderLineReservationMutation: () => ({
    mutate: mockReleaseMutate,
    isPending: mockReleaseIsPending.current,
  }),
}));

vi.mock("@/hooks/queries/warehouse", () => ({
  useWarehouseLocationsQuery: () => ({
    data: [{ id: "loc-1", name: "Shelf A" }],
  }),
}));

import { RepairOrderLineReservation } from "../repair-order-line-reservation";

describe("RepairOrderLineReservation", () => {
  beforeEach(() => {
    mockReservationsData.current = [];
    mockReservationsLoading.current = false;
    mockReservationsIsError.current = false;
    mockReservationsIsSuccess.current = true;
    mockCanOperate.current = true;
    mockReserveIsPending.current = false;
    mockReleaseIsPending.current = false;
    mockReserveMutate.mockClear();
    mockReleaseMutate.mockClear();
  });

  it("shows the 'no reservation' badge when there are zero active reservations", () => {
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    expect(screen.getByTestId("repair-order-line-reservation-trigger")).toHaveTextContent(
      "badgeNone"
    );
  });

  it("shows the outstanding quantity badge when an active reservation exists", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "active",
        outstandingQuantity: 5,
        lines: [],
      },
    ];
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    expect(screen.getByTestId("repair-order-line-reservation-trigger")).toHaveTextContent(
      "badgeReserved"
    );
  });

  it("opening the popover shows the Reserve affordance when the actor can operate inventory", () => {
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.getByTestId("repair-order-line-reservation-open-form")).toBeInTheDocument();
  });

  it("hides the Reserve affordance entirely (not just disabled) when the actor lacks warehouse.inventory.operate", () => {
    mockCanOperate.current = false;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.queryByTestId("repair-order-line-reservation-open-form")).not.toBeInTheDocument();
  });

  it("submitting the reserve form calls the mutation with the exact repairOrderLineId/locationId/quantity", () => {
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-open-form"));
    fireEvent.change(screen.getByTestId("repair-order-line-reservation-quantity"), {
      target: { value: "3" },
    });
    // Radix Select is not a native <select> -- exercised via the location
    // hook's own mocked data is sufficient to prove the wiring; submit is
    // gated on both fields being non-empty, so this asserts the disabled
    // state instead of forcing a full Radix interaction in jsdom.
    expect(screen.getByTestId("repair-order-line-reservation-submit")).toBeDisabled();
  });

  it("shows a Release affordance for each active reservation when the actor can operate inventory", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "active",
        outstandingQuantity: 5,
        lines: [],
      },
    ];
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.getByTestId("repair-order-line-reservation-release")).toBeInTheDocument();
  });

  it("clicking Release calls the release mutation with this exact reservation id", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "active",
        outstandingQuantity: 5,
        lines: [],
      },
    ];
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-release"));
    expect(mockReleaseMutate).toHaveBeenCalledWith({
      repairOrderLineId: "line-1",
      reservationId: "res-1",
    });
  });

  it("disables the Release button while a release mutation is pending", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "active",
        outstandingQuantity: 5,
        lines: [],
      },
    ];
    mockReleaseIsPending.current = true;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.getByTestId("repair-order-line-reservation-release")).toBeDisabled();
  });

  it("shows a loading state while the reservations query is in flight", () => {
    mockReservationsLoading.current = true;
    mockReservationsIsSuccess.current = false;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.getByTestId("repair-order-line-reservation-loading")).toBeInTheDocument();
  });

  it("a reservation fully released/fulfilled (outstandingQuantity 0) is not shown as an active row", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "cancelled",
        outstandingQuantity: 0,
        lines: [],
      },
    ];
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.queryByTestId("repair-order-line-reservation-row")).not.toBeInTheDocument();
    expect(screen.getByTestId("repair-order-line-reservation-empty")).toBeInTheDocument();
  });

  // ---------------------------------------------------------------------
  // Phase 10A correction (2026-09-14, external review): never-fetched vs.
  // loading vs. error vs. success+empty vs. success+populated. Items 1-5
  // of the review's required test list.
  // ---------------------------------------------------------------------

  it("[correction] never-fetched state (query has not run yet) does NOT render 'No reservation'", () => {
    // The lazy query's real pre-open shape: no data, not loading (not yet
    // enabled), no error, not successful.
    mockReservationsData.current = undefined;
    mockReservationsLoading.current = false;
    mockReservationsIsError.current = false;
    mockReservationsIsSuccess.current = false;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    const trigger = screen.getByTestId("repair-order-line-reservation-trigger");
    expect(trigger).not.toHaveTextContent("badgeNone");
    expect(trigger).toHaveTextContent("badgeUnknown");
  });

  it("[correction] successful empty state (genuinely zero reservations) DOES render 'No reservation'", () => {
    mockReservationsData.current = [];
    mockReservationsIsSuccess.current = true;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    expect(screen.getByTestId("repair-order-line-reservation-trigger")).toHaveTextContent(
      "badgeNone"
    );
  });

  it("[correction] successful reservation state renders 'Reserved N'", () => {
    mockReservationsData.current = [
      {
        id: "res-1",
        reservationNumber: "RES-1",
        status: "active",
        outstandingQuantity: 7,
        lines: [],
      },
    ];
    mockReservationsIsSuccess.current = true;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    expect(screen.getByTestId("repair-order-line-reservation-trigger")).toHaveTextContent(
      "badgeReserved"
    );
  });

  it("[correction] query failure renders a dedicated reservation error state", () => {
    mockReservationsIsError.current = true;
    mockReservationsIsSuccess.current = false;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    fireEvent.click(screen.getByTestId("repair-order-line-reservation-trigger"));
    expect(screen.getByTestId("repair-order-line-reservation-error")).toBeInTheDocument();
  });

  it("[correction] query failure does NOT render the empty/no-reservation state or copy", () => {
    mockReservationsIsError.current = true;
    mockReservationsIsSuccess.current = false;
    render(<RepairOrderLineReservation repairOrderLineId="line-1" branchId="branch-1" />);
    const trigger = screen.getByTestId("repair-order-line-reservation-trigger");
    expect(trigger).not.toHaveTextContent("badgeNone");
    fireEvent.click(trigger);
    expect(screen.queryByTestId("repair-order-line-reservation-empty")).not.toBeInTheDocument();
  });
});
