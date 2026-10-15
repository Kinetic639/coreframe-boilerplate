/**
 * @vitest-environment jsdom
 *
 * PZ import dialog: Polish UI, no movement type field, no auto-selected
 * source, already-imported session warning, and quick import from session
 * to a filled form (repair orders + missing parts in SZT).
 */
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { NextIntlClientProvider } from "next-intl";
import { beforeEach, describe, expect, it, vi } from "vitest";
import plMessages from "../../../../../../../../../../../messages/pl.json";
import type {
  MovementImportPreview,
  MovementImportPreviewLine,
  MovementImportSource,
} from "@/lib/warehouse/inventory-types";

const actions = vi.hoisted(() => ({
  listMovementImportSourcesAction: vi.fn(),
  previewMovementImportFromSourceAction: vi.fn(),
  createMovementImportProductsAction: vi.fn(),
  createMovementImportUnitsAction: vi.fn(),
  previewRepairOrderImportAction: vi.fn(),
  applyRepairOrderImportAction: vi.fn(),
}));
const toast = vi.hoisted(() => ({
  success: vi.fn(),
  error: vi.fn(),
  warning: vi.fn(),
}));

vi.mock("@/app/actions/warehouse/inventory", () => ({
  listMovementImportSourcesAction: actions.listMovementImportSourcesAction,
  previewMovementImportFromSourceAction: actions.previewMovementImportFromSourceAction,
  createMovementImportProductsAction: actions.createMovementImportProductsAction,
  createMovementImportUnitsAction: actions.createMovementImportUnitsAction,
}));
vi.mock("@/app/actions/workshop/import", () => ({
  previewRepairOrderImportAction: actions.previewRepairOrderImportAction,
  applyRepairOrderImportAction: actions.applyRepairOrderImportAction,
}));
vi.unmock("next-intl");
vi.mock("react-toastify", () => ({ toast }));
vi.mock("@/components/workshop/repair-order-import-review", () => ({
  RepairOrderImportReview: () => <div data-testid="ro-review" />,
}));

import { MovementImportDialog } from "../movement-import-dialog";

const SOURCE: MovementImportSource = {
  source_type: "svwms_wdd_matcher",
  label: "SVWMS WDD matcher",
  description: null,
  supported_movement_type_codes: ["101"],
  input_fields: [
    {
      key: "session_id",
      label: "Matcher session",
      type: "select",
      required: true,
      placeholder: "Select parsed SVWMS matcher session",
      options: [
        { value: "s-new", label: "Dostawa 15.10" },
        { value: "s-old", label: "Dostawa 14.10", imported_document: "PZ/2026/000001" },
      ],
    },
  ],
} as MovementImportSource;

function line(overrides: Partial<MovementImportPreviewLine>): MovementImportPreviewLine {
  return {
    line_number: 1,
    source_line_id: "l1",
    raw_product_code: "5H0807221",
    raw_product_name: "Zderzak przedni",
    raw_unit: null,
    raw_quantity: 1,
    normalized_product_code: "5H0807221",
    normalized_product_name: "Zderzak przedni",
    normalized_unit_code: null,
    raw_source_location: null,
    raw_destination_location: null,
    raw_metadata: { zl_number: "184213" },
    variant_id: null,
    unit_id: null,
    source_location_id: null,
    destination_location_id: null,
    quantity: 1,
    product_resolution_status: "missing",
    unit_resolution_status: "missing",
    validation_errors: [],
    ...overrides,
  };
}

function preview(lines: MovementImportPreviewLine[]): MovementImportPreview {
  return {
    source_type: "svwms_wdd_matcher",
    source_label: "SVWMS WDD matcher",
    movement_type_code: "101",
    documents: [
      {
        source_document_id: "doc-1",
        source_document_number: "SVWMS-20261015-ABCDEF12",
        source_metadata: { session_id: "s-new" },
        movement_type_code: "101",
        external_reference: "SVWMS-20261015-ABCDEF12",
        sender_name: null,
        sender_details: null,
        recipient_name: null,
        recipient_details: null,
        validation_errors: [],
        exception_groups: [],
        lines,
      },
    ],
  };
}

const UNITS = [{ id: "u-szt", code: "SZT", name: "sztuka" }];
const KNOWN = {
  id: "v-known",
  sku: "WHT005263",
  label: "WHT005263 - Spinka",
  product_name: "Spinka",
  unit_id: "u-szt",
  unit_code: "SZT",
};

function renderDialog(onApply = vi.fn(), canManageProducts = true) {
  render(
    <NextIntlClientProvider locale="pl" messages={plMessages}>
      <MovementImportDialog
        open
        onOpenChange={vi.fn()}
        fieldPolicies={{}}
        currentMovementTypeCode="101"
        variants={[KNOWN]}
        units={UNITS}
        stockableLocations={[]}
        currentDestinationLocationId="loc-prz"
        canManageProducts={canManageProducts}
        onApply={onApply}
      />
    </NextIntlClientProvider>
  );
  return onApply;
}

async function pickSession(value: string) {
  const sourceSelect = await screen.findByRole("combobox", { name: "Źródło" });
  await waitFor(() => expect(sourceSelect.querySelectorAll("option")).toHaveLength(2));
  fireEvent.change(sourceSelect, { target: { value: "svwms_wdd_matcher" } });
  fireEvent.change(screen.getByRole("combobox", { name: "Sesja Matchera" }), {
    target: { value },
  });
}

beforeEach(() => {
  vi.clearAllMocks();
  actions.listMovementImportSourcesAction.mockResolvedValue({ success: true, data: [SOURCE] });
});

describe("MovementImportDialog", () => {
  it("is in Polish, has no movement type field and does not pick a source", async () => {
    renderDialog();
    expect(screen.getByText("Import danych do ruchu")).toBeTruthy();
    const sourceSelect = await screen.findByRole("combobox", { name: "Źródło" });
    await waitFor(() => expect(sourceSelect.querySelectorAll("option")).toHaveLength(2));
    expect((sourceSelect as HTMLSelectElement).value).toBe("");
    expect(screen.queryByText(/Movement type|Rodzaj ruchu|Typ ruchu/)).toBeNull();
    expect(screen.getByRole("button", { name: /Szybki import/ })).toHaveProperty("disabled", true);
  });

  it("warns when the chosen session was already imported", async () => {
    renderDialog();
    await pickSession("s-old");
    expect(screen.getByTestId("import-already-imported").textContent).toContain("PZ/2026/000001");
    expect(
      screen.getByRole("option", { name: "Dostawa 14.10 — już w PZ/2026/000001" })
    ).toBeTruthy();
  });

  it("quick import creates repair orders and missing parts in SZT, then fills the form", async () => {
    actions.previewMovementImportFromSourceAction.mockResolvedValue({
      success: true,
      data: preview([
        line({}),
        line({
          source_line_id: "l2",
          line_number: 2,
          raw_product_code: "WHT005263",
          normalized_product_code: "WHT005263",
          variant_id: "v-known",
          unit_id: null,
          product_resolution_status: "resolved",
        }),
      ]),
    });
    actions.previewRepairOrderImportAction.mockResolvedValue({
      success: true,
      data: {
        sourceType: "svwms_wdd_matcher",
        orders: [
          { zlNumber: "184213", willChange: true },
          { zlNumber: "184214", willChange: false },
        ],
        counts: { new: 1, existing: 1, conflict: 0, unchanged: 1 },
      },
    });
    actions.applyRepairOrderImportAction.mockResolvedValue({
      success: true,
      data: { created: 1, updated: 0, unchanged: 0, conflicts: 0 },
    });
    actions.createMovementImportProductsAction.mockResolvedValue({
      success: true,
      data: {
        created: [
          {
            key: "5H0807221",
            variant: {
              id: "v-new",
              sku: "5H0807221",
              label: "5H0807221 - Zderzak przedni",
              product_name: "Zderzak przedni",
              unit_id: "u-szt",
              unit_code: "SZT",
            },
          },
        ],
      },
    });

    const onApply = renderDialog();
    await pickSession("s-new");
    fireEvent.click(screen.getByRole("button", { name: /Szybki import/ }));

    await waitFor(() => expect(onApply).toHaveBeenCalledTimes(1));
    expect(actions.applyRepairOrderImportAction).toHaveBeenCalledWith({
      source_type: "svwms_wdd_matcher",
      source_input: { session_id: "s-new" },
      zl_numbers: ["184213"],
    });
    expect(actions.createMovementImportUnitsAction).not.toHaveBeenCalled();
    expect(actions.createMovementImportProductsAction).toHaveBeenCalledWith({
      products: [
        {
          key: "5H0807221",
          sku: "5H0807221",
          name: "Zderzak przedni",
          unit_id: "u-szt",
          unit_code: "SZT",
        },
      ],
    });
    const draft = onApply.mock.calls[0][0];
    expect(draft.note).toBe("Zaimportowano z Matcher SVWMS (WDD): SVWMS-20261015-ABCDEF12");
    expect(draft.lines).toHaveLength(2);
    expect(draft.lines[0]).toMatchObject({
      variant_id: "v-new",
      unit_id: "u-szt",
      source_order_number: "184213",
      destination_location_id: "loc-prz",
    });
    expect(draft.lines[1]).toMatchObject({ variant_id: "v-known", unit_id: "u-szt" });
    expect(toast.success).toHaveBeenCalledWith(
      "Formularz wypełniony: 2 poz. Nowe zlecenia: 1, nowe części: 1."
    );
  });

  it("quick import stops on a part matching several catalog items", async () => {
    actions.previewMovementImportFromSourceAction.mockResolvedValue({
      success: true,
      data: preview([line({ product_resolution_status: "ambiguous" })]),
    });
    actions.previewRepairOrderImportAction.mockResolvedValue({
      success: true,
      data: { sourceType: "svwms_wdd_matcher", orders: [], counts: {} },
    });

    const onApply = renderDialog();
    await pickSession("s-new");
    fireEvent.click(screen.getByRole("button", { name: /Szybki import/ }));

    await waitFor(() => expect(toast.warning).toHaveBeenCalled());
    expect(onApply).not.toHaveBeenCalled();
    expect(actions.createMovementImportProductsAction).not.toHaveBeenCalled();
    expect(await screen.findByText("Kilka pasujących części")).toBeTruthy();
  });
});
