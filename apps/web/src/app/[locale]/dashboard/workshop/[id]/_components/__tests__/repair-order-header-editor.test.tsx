/**
 * @vitest-environment jsdom
 *
 * Component tests: RepairOrderHeaderEditor (Phase 7) -- header edit toggle,
 * advisor section visibility by permission, and lifecycle action visibility
 * by current status + permission. Mocks the workshop query-hooks module
 * wholesale, matching the established convention in
 * extraction-review-approval.test.tsx.
 */
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import type { ReactElement } from "react";

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockPush = vi.fn();
const mockRefresh = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush, refresh: mockRefresh }),
}));

const { mockUpdateHeaderMutate, mockAssignAdvisorMutate, mockChangeStatusMutate } = vi.hoisted(
  () => ({
    mockUpdateHeaderMutate: vi.fn((_input: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.()
    ),
    mockAssignAdvisorMutate: vi.fn((_input: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.()
    ),
    mockChangeStatusMutate: vi.fn((_input: unknown, opts?: { onSuccess?: () => void }) =>
      opts?.onSuccess?.()
    ),
  })
);

vi.mock("@/hooks/queries/workshop", () => ({
  useUpdateRepairOrderHeaderMutation: () => ({
    mutate: mockUpdateHeaderMutate,
    isPending: false,
  }),
  useAssignRepairOrderAdvisorMutation: () => ({
    mutate: mockAssignAdvisorMutate,
    isPending: false,
  }),
  useChangeRepairOrderStatusMutation: () => ({
    mutate: mockChangeStatusMutate,
    isPending: false,
  }),
}));

import { RepairOrderHeaderEditor } from "../repair-order-header-editor";
import type { RepairOrderHeader } from "@/server/services/repair-orders.service";

function render(ui: ReactElement) {
  return rtlRender(ui);
}

const BASE_ORDER: RepairOrderHeader = {
  id: "ro-1",
  zlNumber: "ZL/1",
  orderNumber: "BLWK/1",
  vin: "VIN1",
  status: "open",
  identityStatus: "resolved",
  advisorContactId: "contact-self",
  advisorDisplayName: "Jane Advisor",
  createdAt: "2026-09-11T00:00:00.000Z",
  updatedAt: "2026-09-11T00:00:00.000Z",
  vehicleBrand: "Toyota",
  clientName: "Client",
  dealerName: "Dealer",
  createdBy: "user-1",
};

beforeEach(() => vi.clearAllMocks());

describe("RepairOrderHeaderEditor -- header edit visibility/behavior", () => {
  it("shows the Edit control and lifecycle actions for the owning manage_own advisor", () => {
    render(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[]}
        canManageOwn={true}
        canManageAll={false}
        ownAdvisorContactId="contact-self"
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.getByTestId("edit-header-button")).toBeInTheDocument();
    expect(screen.getByTestId("lifecycle-actions")).toBeInTheDocument();
    expect(screen.getByTestId("close-order-button")).toBeInTheDocument();
    // manage_own (not manage_all) must never see the Archive control.
    expect(screen.queryByTestId("archive-order-button")).not.toBeInTheDocument();
  });

  it("hides the Edit control and lifecycle actions for a manage_own caller who is NOT the assigned advisor", () => {
    render(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[]}
        canManageOwn={true}
        canManageAll={false}
        ownAdvisorContactId="someone-else"
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.queryByTestId("edit-header-button")).not.toBeInTheDocument();
    expect(screen.queryByTestId("lifecycle-actions")).not.toBeInTheDocument();
    expect(screen.getByText("detail.readOnlyNote")).toBeInTheDocument();
  });

  it("toggling edit mode reveals input fields and Save persists the patch", () => {
    render(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    fireEvent.click(screen.getByTestId("edit-header-button"));
    const vinInput = screen.getByDisplayValue("VIN1");
    fireEvent.change(vinInput, { target: { value: "VIN-NEW" } });
    fireEvent.click(screen.getByTestId("save-header-button"));

    expect(mockUpdateHeaderMutate).toHaveBeenCalledWith(
      expect.objectContaining({ id: "ro-1", vin: "VIN-NEW" }),
      expect.anything()
    );
    expect(mockRefresh).toHaveBeenCalled();
  });

  it("shows the advisor reassignment picker only for manage_all, not manage_own", () => {
    const { rerender } = render(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[{ id: "contact-2", displayName: "Other Advisor" }]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );
    expect(screen.getByTestId("advisor-select")).toBeInTheDocument();

    rerender(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[]}
        canManageOwn={true}
        canManageAll={false}
        ownAdvisorContactId="contact-self"
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );
    expect(screen.queryByTestId("advisor-select")).not.toBeInTheDocument();
    expect(screen.getByText("Jane Advisor")).toBeInTheDocument();
  });

  it("shows Reopen (and Archive, for manage_all) but not Close when the order is already closed", () => {
    render(
      <RepairOrderHeaderEditor
        order={{ ...BASE_ORDER, status: "closed" }}
        advisorCandidates={[]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.getByTestId("reopen-order-button")).toBeInTheDocument();
    expect(screen.getByTestId("archive-order-button")).toBeInTheDocument();
    expect(screen.queryByTestId("close-order-button")).not.toBeInTheDocument();
  });

  it("hides the Edit control for a manage_own owner once the order is archived (matches repair_orders_update's RLS: manage_own can never write to an archived row, not even unrelated header fields)", () => {
    render(
      <RepairOrderHeaderEditor
        order={{ ...BASE_ORDER, status: "archived" }}
        advisorCandidates={[]}
        canManageOwn={true}
        canManageAll={false}
        ownAdvisorContactId="contact-self"
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.queryByTestId("edit-header-button")).not.toBeInTheDocument();
  });

  it("correction pass Finding B: hides the Edit control for manage_all too once the order is archived (repair_orders_update's RLS now makes archived DB-terminal for everyone, not just manage_own)", () => {
    render(
      <RepairOrderHeaderEditor
        order={{ ...BASE_ORDER, status: "archived" }}
        advisorCandidates={[]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.queryByTestId("edit-header-button")).not.toBeInTheDocument();
  });

  it("shows no lifecycle actions at all once the order is archived (terminal state)", () => {
    render(
      <RepairOrderHeaderEditor
        order={{ ...BASE_ORDER, status: "archived" }}
        advisorCandidates={[]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    expect(screen.queryByTestId("lifecycle-actions")).not.toBeInTheDocument();
  });

  it("clicking Close calls the status-change mutation with the correct from/to status", () => {
    render(
      <RepairOrderHeaderEditor
        order={BASE_ORDER}
        advisorCandidates={[]}
        canManageOwn={false}
        canManageAll={true}
        ownAdvisorContactId={null}
        createdAtLabel="x"
        updatedAtLabel="y"
      />
    );

    fireEvent.click(screen.getByTestId("close-order-button"));

    expect(mockChangeStatusMutate).toHaveBeenCalledWith(
      { id: "ro-1", fromStatus: "open", toStatus: "closed" },
      expect.anything()
    );
  });
});
