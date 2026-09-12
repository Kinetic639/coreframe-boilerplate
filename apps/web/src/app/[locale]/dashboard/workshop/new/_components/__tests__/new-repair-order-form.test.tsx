/**
 * @vitest-environment jsdom
 *
 * Component tests: NewRepairOrderForm (Phase 7 manual creation form).
 */
import { render as rtlRender, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

// jsdom does not implement ResizeObserver, which Radix's Checkbox (used by
// the "assign to me" control) reads on mount -- this repo's shared vitest
// setup has no global polyfill for it (no prior component test exercised a
// Radix Checkbox), so it is stubbed locally here rather than widened
// globally for every other test file.
class ResizeObserverStub {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: unknown }).ResizeObserver = ResizeObserverStub;

vi.mock("next-intl", () => ({
  useTranslations: () => (key: string) => key,
}));

const mockPush = vi.fn();
vi.mock("@/i18n/navigation", () => ({
  useRouter: () => ({ push: mockPush }),
}));

const { mockCreateMutate, capturedOnCreated } = vi.hoisted(() => ({
  mockCreateMutate: vi.fn(),
  capturedOnCreated: { current: undefined as ((order: { id: string }) => void) | undefined },
}));
vi.mock("@/hooks/queries/workshop", () => ({
  useCreateRepairOrderMutation: (onCreated?: (order: { id: string }) => void) => {
    capturedOnCreated.current = onCreated;
    return { mutate: mockCreateMutate, isPending: false };
  },
}));

import { NewRepairOrderForm } from "../new-repair-order-form";

beforeEach(() => vi.clearAllMocks());

describe("NewRepairOrderForm", () => {
  it("submits with null for every empty optional field and the caller's advisor_contact_id null by default (not auto-assigned)", () => {
    rtlRender(
      <NewRepairOrderForm advisorCandidates={[]} canManageAll={false} ownAdvisorContactId={null} />
    );

    fireEvent.click(screen.getByTestId("create-order-submit"));

    expect(mockCreateMutate).toHaveBeenCalledWith({
      zl_number: null,
      order_number: null,
      vin: null,
      vehicle_brand: null,
      client_name: null,
      dealer_name: null,
      advisor_contact_id: null,
    });
  });

  it("submits the typed ZL number and VIN", () => {
    rtlRender(
      <NewRepairOrderForm advisorCandidates={[]} canManageAll={false} ownAdvisorContactId={null} />
    );

    fireEvent.change(screen.getByLabelText("columns.zlNumber"), {
      target: { value: "ZL/12345" },
    });
    fireEvent.change(screen.getByLabelText("columns.vin"), { target: { value: "VIN123" } });
    fireEvent.click(screen.getByTestId("create-order-submit"));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ zl_number: "ZL/12345", vin: "VIN123" })
    );
  });

  it("a manage_own-only caller with a linked advisor contact can opt in via 'assign to me', which sets advisor_contact_id to their own contact id", () => {
    rtlRender(
      <NewRepairOrderForm
        advisorCandidates={[]}
        canManageAll={false}
        ownAdvisorContactId="contact-self"
      />
    );

    fireEvent.click(screen.getByRole("checkbox"));
    fireEvent.click(screen.getByTestId("create-order-submit"));

    expect(mockCreateMutate).toHaveBeenCalledWith(
      expect.objectContaining({ advisor_contact_id: "contact-self" })
    );
  });

  it("shows the full advisor picker (not the self-assign checkbox) for a manage_all caller", () => {
    rtlRender(
      <NewRepairOrderForm
        advisorCandidates={[{ id: "contact-2", displayName: "Other Advisor" }]}
        canManageAll={true}
        ownAdvisorContactId={null}
      />
    );

    expect(screen.getByTestId("new-order-advisor-select")).toBeInTheDocument();
    expect(screen.queryByRole("checkbox")).not.toBeInTheDocument();
  });

  it("navigates to the created order's detail page once the mutation's onCreated callback fires", () => {
    rtlRender(
      <NewRepairOrderForm advisorCandidates={[]} canManageAll={false} ownAdvisorContactId={null} />
    );

    expect(capturedOnCreated.current).toBeTypeOf("function");
    capturedOnCreated.current?.({ id: "ro-new-1" });

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/dashboard/workshop/[id]",
      params: { id: "ro-new-1" },
    });
  });
});
