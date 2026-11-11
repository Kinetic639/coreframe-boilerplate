/**
 * @vitest-environment jsdom
 *
 * Repair-order review in the PZ import ("receipt" mode): every order is a
 * checkbox (all on), select/clear all, and unchecked ZLs are reported so the
 * PZ leaves their parts out. Import mode only offers orders that change.
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
vi.mock("react-toastify", () => ({ toast: { error: vi.fn(), success: vi.fn() } }));

const h = vi.hoisted(() => ({ preview: vi.fn(), apply: vi.fn() }));
vi.mock("@/app/actions/workshop/import", () => ({
  previewRepairOrderImportAction: (...a: unknown[]) => h.preview(...a),
  applyRepairOrderImportAction: (...a: unknown[]) => h.apply(...a),
}));

import { RepairOrderImportReview } from "../repair-order-import-review";

const order = (zl: string, status: "new" | "existing", willChange: boolean) => ({
  zlNumber: zl,
  status,
  conflictReason: null,
  repairOrderId: status === "existing" ? `ro-${zl}` : null,
  orderNumber: null,
  vin: null,
  vehicleBrand: "VW",
  clientName: "Klient",
  willChange,
  lines: [],
});

beforeEach(() => {
  vi.clearAllMocks();
  h.preview.mockResolvedValue({
    success: true,
    data: {
      sourceType: "svwms_wdd_matcher",
      orders: [
        order("ZL/1", "new", true),
        order("ZL/2", "existing", false),
        order("ZL/3", "existing", true),
      ],
      counts: { new: 1, existing: 2, conflict: 0, unchanged: 1 },
    },
  });
});

describe("RepairOrderImportReview", () => {
  it("receipt mode: all orders checked, unchecking one reports it and keeps it out of the import", async () => {
    const onSelectionChange = vi.fn();
    render(
      <RepairOrderImportReview
        sourceType="svwms_wdd_matcher"
        sourceInput={{ session_id: "s1" }}
        canApply
        mode="receipt"
        onSelectionChange={onSelectionChange}
      />
    );
    await screen.findByTestId("ro-import-review");
    expect(screen.getAllByRole("checkbox")).toHaveLength(3);
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith([]));

    fireEvent.click(screen.getByLabelText("ZL/1"));
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith(["ZL/1"]));

    h.apply.mockResolvedValue({
      success: true,
      data: { created: 0, updated: 1, unchanged: 0, conflicts: 0 },
    });
    fireEvent.click(screen.getByTestId("ro-import-apply"));
    await waitFor(() => expect(h.apply).toHaveBeenCalled());
    expect(h.apply.mock.calls[0][0].zl_numbers).toEqual(["ZL/3"]);
  });

  it("select/clear all toggles every order", async () => {
    const onSelectionChange = vi.fn();
    render(
      <RepairOrderImportReview
        sourceType="svwms_wdd_matcher"
        sourceInput={{}}
        canApply
        mode="receipt"
        onSelectionChange={onSelectionChange}
      />
    );
    fireEvent.click(await screen.findByTestId("ro-import-toggle-all"));
    await waitFor(() =>
      expect(onSelectionChange).toHaveBeenLastCalledWith(["ZL/1", "ZL/2", "ZL/3"])
    );
    fireEvent.click(screen.getByTestId("ro-import-toggle-all"));
    await waitFor(() => expect(onSelectionChange).toHaveBeenLastCalledWith([]));
  });

  it("import mode only offers orders that would change", async () => {
    render(<RepairOrderImportReview sourceType="svwms_wdd_matcher" sourceInput={{}} canApply />);
    await screen.findByTestId("ro-import-review");
    expect(screen.getAllByRole("checkbox")).toHaveLength(2);
  });
});
