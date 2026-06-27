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

    expect(actionsSource).toContain("const branchId = context?.app.activeBranchId");
    expect(actionsSource).not.toContain("createSession(supabase, orgId, null");
    expect(serviceSource).toContain("listImportableSessionsForBranch");
    expect(serviceSource).toContain("getMovementImportCandidates");
    expect(serviceSource).toContain('.eq("branch_id", branchId)');
    expect(indexMigration).toContain("wdd_matcher_sessions_org_branch_status_created_idx");
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
    expect(dialogSource).toContain("createEnhancedInventoryProductAction");
    expect(dialogSource).toContain("createInventoryUnitAction");
    expect(dialogSource).toContain("currentDestinationLocationId");
    expect(dialogSource).toContain("svwmsLines");
    expect(dialogSource).toContain("Zlecenie / Order");
    expect(dialogSource).not.toContain("No order / direct warehouse");
    expect(dialogSource).toContain("Create missing units");
    expect(dialogSource).toContain("Create missing products");
    expect(dialogSource).toContain("lineContextNote");
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
    const serviceSource = readFileSync(
      resolve(__dirname, "../../../../server/services/inventory-movements.service.ts"),
      "utf8"
    );

    expect(submissionSource).toContain("note: l.note ?? null");
    expect(submissionSource).not.toContain("note: null");
    expect(serviceSource).toContain("destination_location_id, note, snapshot_product_name");
    expect(detailSource).toContain("line.note");
  });
});
