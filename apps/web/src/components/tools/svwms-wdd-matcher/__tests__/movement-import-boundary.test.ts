/**
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("SVWMS matcher movement import boundary", () => {
  it("does not expose movement import controls in matcher result views", () => {
    const resultsView = readFileSync(resolve(__dirname, "../results-view.tsx"), "utf8");
    const extractionReview = readFileSync(
      resolve(__dirname, "../extraction-review-view.tsx"),
      "utf8"
    );

    for (const source of [resultsView, extractionReview]) {
      expect(source).not.toContain("Import to movements");
      expect(source).not.toContain("previewMovementImportFromSourceAction");
      expect(source).not.toContain("listMovementImportSourcesAction");
    }
  });

  it("keeps SVWMS as a canonical data adapter, not the movement import owner", () => {
    const adapterSource = readFileSync(
      resolve(
        __dirname,
        "../../../../server/services/movement-import-adapters/svwms-wdd-matcher.adapter.ts"
      ),
      "utf8"
    );
    const adapterTypes = readFileSync(
      resolve(__dirname, "../../../../server/services/movement-import-adapters/types.ts"),
      "utf8"
    );

    expect(adapterSource).toContain("senderName");
    expect(adapterSource).toContain("recipientName");
    expect(adapterSource).toContain('supportedMovementTypeCodes: ["101"]');
    expect(adapterSource).toContain("listImportableSessionsForBranch");
    expect(adapterSource).toContain('type: "select"');
    expect(adapterSource).not.toContain("Paste SVWMS matcher session UUID");
    expect(adapterSource).not.toContain("createDraft");
    expect(adapterTypes).toContain("CanonicalMovementImportDocument");
  });

  it("creates and lists dashboard matcher sessions through active branch scope", () => {
    const actionsSource = readFileSync(
      resolve(__dirname, "../../../../app/actions/tools/wdd-matcher.ts"),
      "utf8"
    );
    const serviceSource = readFileSync(
      resolve(__dirname, "../../../../server/services/wdd-matcher.service.ts"),
      "utf8"
    );
    const indexMigration = readFileSync(
      resolve(
        __dirname,
        "../../../../../supabase-target/supabase/migrations/20260626162000_wdd_matcher_branch_session_picker_index.sql"
      ),
      "utf8"
    );
    const numberMigration = readFileSync(
      resolve(
        __dirname,
        "../../../../../supabase-target/supabase/migrations/20260627173000_wdd_matcher_session_numbers.sql"
      ),
      "utf8"
    );

    expect(actionsSource).toContain("const branchId = context?.app.activeBranchId");
    expect(actionsSource).not.toContain("createSession(supabase, orgId, null");
    expect(serviceSource).toContain("wdd_matcher_allocate_session_number");
    expect(serviceSource).toContain("session_number");
    expect(serviceSource).toContain("listImportableSessionsForBranch");
    expect(serviceSource).toContain("getMovementImportCandidates");
    expect(serviceSource).toContain('.eq("branch_id", branchId)');
    expect(indexMigration).toContain("wdd_matcher_sessions_org_branch_status_created_idx");
    expect(numberMigration).toContain("wdd_matcher_session_number_counters");
    expect(numberMigration).toContain("wdd_matcher_allocate_session_number");
  });

  it("renders SVWMS movement import as a session-level list with product/unit repair", () => {
    const dialogSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-import-dialog.tsx"
      ),
      "utf8"
    );

    expect(dialogSource).toContain('preview?.source_type === "svwms_wdd_matcher"');
    expect(dialogSource).toContain("showDocumentSelector");
    expect(dialogSource).not.toContain("Default destination");
    expect(dialogSource).toContain("createMovementImportProductsAction");
    expect(dialogSource).toContain("createMovementImportUnitsAction");
    expect(dialogSource).toContain("currentDestinationLocationId");
    expect(dialogSource).toContain("flex max-h-[90vh] max-w-5xl flex-col");
    expect(dialogSource).toContain("min-h-0 flex-1 overflow-auto");
    expect(dialogSource).toContain("shrink-0 border-t");
    expect(dialogSource).toContain("dialogView");
    expect(dialogSource).toContain('"resolve_mismatches"');
    expect(dialogSource).toContain('"review_ready"');
    expect(dialogSource).toContain("svwmsLines");
    expect(dialogSource).toContain("Zlecenie / Order");
    expect(dialogSource).toContain('title="Imported items"');
    expect(dialogSource).toContain('header: "SKU"');
    expect(dialogSource).toContain('header: "Name"');
    expect(dialogSource).toContain('header: "Qty"');
    expect(dialogSource).toContain('header: "Unit"');
    expect(dialogSource).toContain("updateLine(line.source_line_id");
    expect(dialogSource).toContain('header: "Status"');
    expect(dialogSource).not.toContain("Product match");
    expect(dialogSource).not.toContain("Unit match");
    expect(dialogSource).not.toContain("No order / direct warehouse");
    expect(dialogSource).toContain("Import needs decisions");
    expect(dialogSource).toContain("Fill movement form is blocked");
    expect(dialogSource).toContain("WarehouseImportReviewTable");
    expect(dialogSource).toContain("Product mismatches");
    expect(dialogSource).toContain("Unit mismatches");
    expect(dialogSource).toContain("No.");
    expect(dialogSource).toContain('header: "SKU"');
    expect(dialogSource).toContain('header: "Name"');
    expect(dialogSource).toContain('header: "Imported unit"');
    expect(dialogSource).toContain("No unit provided");
    expect(dialogSource).toContain("Unit");
    expect(dialogSource).toContain("How to proceed");
    expect(dialogSource).toContain("ImportCopyButton");
    expect(dialogSource).toContain("copyFirstProductUnitToAll");
    expect(dialogSource).toContain("copyFirstProductActionToAll");
    expect(dialogSource).toContain("Create item");
    expect(dialogSource).toContain("Create selected items");
    expect(dialogSource).toContain("selectedCreateProductGroups");
    expect(dialogSource).toContain("Will be created by bulk action.");
    expect(dialogSource).toContain("Assign existing item");
    expect(dialogSource).toContain("Pick existing item");
    expect(dialogSource).toContain("Select unit first.");
    expect(dialogSource).toContain("Review manually");
    expect(dialogSource).toContain("Create missing units");
    expect(dialogSource).toContain("selectedDocumentErrors[0]");
    expect(dialogSource).toContain("Skip missing products");
    expect(dialogSource).toContain("Restore skipped");
    expect(dialogSource).toContain("skippedProductKeys");
    expect(dialogSource).toContain("lineContextNote");
    expect(dialogSource).toContain("line.normalized_product_code ?? line.raw_product_code");
    expect(dialogSource).toContain("line.normalized_product_name");
    expect(dialogSource).toContain("source_type: preview?.source_type");
    expect(dialogSource).toContain("source_line_id: line.source_line_id");
    expect(dialogSource).toContain("Zlecenie:");
    expect(dialogSource).not.toContain("WDD:");
    expect(dialogSource).not.toContain(">WDD<");
    expect(dialogSource).toContain("movement_order_number");
    expect(dialogSource).toContain("order_number");
    expect(dialogSource).not.toContain("parsed_location");
  });

  it("preserves imported order context as movement line notes", () => {
    const submissionSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/use-movement-submission.ts"
      ),
      "utf8"
    );
    const detailSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/_components/inventory-movement-detail-panel.tsx"
      ),
      "utf8"
    );
    const positionsSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-positions-tab.tsx"
      ),
      "utf8"
    );
    const documentDataSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-document-data-tab.tsx"
      ),
      "utf8"
    );
    const formStateSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/use-movement-form-state.ts"
      ),
      "utf8"
    );
    const serviceSource = readFileSync(
      resolve(__dirname, "../../../../server/services/inventory-movements.service.ts"),
      "utf8"
    );

    expect(submissionSource).toContain("note: l.note ?? null");
    expect(submissionSource).not.toContain("note: null");
    expect(serviceSource).toContain("destination_location_id, note, snapshot_product_name");
    expect(positionsSource).toContain("Zlecenie / Order");
    expect(positionsSource).toContain("orderNumber");
    expect(positionsSource).not.toContain("{line.note &&");
    expect(detailSource).toContain("line.note");
    expect(documentDataSource).toContain("MovementPartySection");
    expect(documentDataSource).toContain("recipientFields");
    expect(documentDataSource).toContain("onRecipientDetailsChange");
    expect(formStateSource).toContain("recipientDetails");
    expect(formStateSource).toContain("recipientFields");
  });

  it("guards imported movement lines behind manual correction mode", () => {
    const formStateSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/use-movement-form-state.ts"
      ),
      "utf8"
    );
    const positionsSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/movement-positions-tab.tsx"
      ),
      "utf8"
    );
    const formSource = readFileSync(
      resolve(
        __dirname,
        "../../../../app/[locale]/dashboard/warehouse/inventory/movements/new/_components/movement-editor/index.tsx"
      ),
      "utf8"
    );

    expect(formStateSource).toContain('origin: "imported"');
    expect(formStateSource).toContain('origin: "manual"');
    expect(formStateSource).toContain("manualCorrectionMode");
    expect(formStateSource).toContain("setManualCorrectionMode(false)");
    expect(formStateSource).toContain("enableManualCorrections");
    expect(positionsSource).not.toContain("Imported SVWMS positions are locked");
    expect(positionsSource).toContain("importedLinesLocked ? (");
    expect(positionsSource).toContain("Enable manual corrections");
    expect(positionsSource).toContain("disabled={lineLocked}");
    expect(positionsSource).toContain("disabled={pickerDisabled || !selType}");
    expect(formSource).toContain("form.importedLinesLocked");
  });
});
