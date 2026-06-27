/**
 * @vitest-environment node
 */

import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
import { InventoryMovementImportsService } from "../inventory-movement-imports.service";
import { svwmsWddMatcherMovementImportAdapter } from "../movement-import-adapters/svwms-wdd-matcher.adapter";
import { WddMatcherService } from "../wdd-matcher.service";

afterEach(() => {
  vi.restoreAllMocks();
});

describe("InventoryMovementImportsService preview imports", () => {
  it("keeps the core movement import service independent from SVWMS", () => {
    const serviceSource = readFileSync(
      resolve(__dirname, "../inventory-movement-imports.service.ts"),
      "utf8"
    );

    expect(serviceSource).not.toContain("WddMatcherService");
    expect(serviceSource).not.toContain("wdd-matcher.service");
  });

  it("lists registered movement import sources for supported movement types", async () => {
    const result = await InventoryMovementImportsService.listSources(
      undefined,
      undefined,
      undefined,
      "101"
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          source_type: "svwms_wdd_matcher",
          label: "SVWMS WDD matcher",
        }),
      ])
    );
  });

  it("does not list SVWMS WDD matcher for MM 801 imports", async () => {
    const result = await InventoryMovementImportsService.listSources(
      undefined,
      undefined,
      undefined,
      "801"
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data.map((source) => source.source_type)).not.toContain("svwms_wdd_matcher");
  });

  it("rejects unsupported source types before touching database dependencies", async () => {
    const result = await InventoryMovementImportsService.previewFromSource(
      {} as never,
      "org-1",
      "branch-1",
      {
        source_type: "unknown_source",
        source_input: {},
        movement_type_code: "101",
      }
    );

    expect(result).toEqual({
      success: false,
      error: "Unsupported movement import source",
    });
  });

  it("rejects source and movement type combinations not supported by the adapter", async () => {
    const result = await InventoryMovementImportsService.previewFromSource(
      {} as never,
      "org-1",
      "branch-1",
      {
        source_type: "svwms_wdd_matcher",
        source_input: {},
        movement_type_code: "801",
      }
    );

    expect(result).toEqual({
      success: false,
      error: "Selected import source does not support this movement type",
    });
  });

  it("maps one SVWMS matcher session to one canonical import document", async () => {
    vi.spyOn(WddMatcherService, "getMovementImportCandidates").mockResolvedValue({
      success: true,
      data: {
        session: {
          id: "session-1",
          organization_id: "org-1",
          branch_id: "branch-1",
          name: "Dostawa 26.06.2026 22:09",
          status: "ready_for_review",
          match_summary: null,
          created_by: "user-1",
          approved_by: null,
          approved_at: null,
          created_at: "2026-06-26T20:09:00.000Z",
          updated_at: "2026-06-26T20:09:00.000Z",
        },
        lines: [
          {
            sourceBlockId: "wdd-block-1",
            sourceLineId: "line-1",
            sourceBlockType: "wdd_reconciliation",
            lineNumber: 1,
            productCode: "57H823031",
            productName: "Pokrywa przednia",
            quantity: 1,
            unit: "SZT",
            parsedLocation: "PRZY A1",
            wddNumber: "WDD/1488/26/3142",
            orderNumber: "BLWK/6",
            zlNumber: null,
            zwNumber: null,
            clientName: null,
            groupName: "BRA_SKO",
            warehouseCode: "115",
            warehouseLabel: "Magazyn",
            documentBrand: "skoda",
            matchType: "exact",
            matchConfidence: 99,
            blockMetadata: {},
            lineMetadata: { idp_raw: "1" },
          },
          {
            sourceBlockId: "direct-block-1",
            sourceLineId: "line-2",
            sourceBlockType: "direct_order",
            lineNumber: 2,
            productCode: "ABC123",
            productName: "Direct item",
            quantity: 2,
            unit: "SZT",
            parsedLocation: null,
            wddNumber: null,
            orderNumber: null,
            zlNumber: null,
            zwNumber: null,
            clientName: null,
            groupName: null,
            warehouseCode: null,
            warehouseLabel: null,
            documentBrand: null,
            matchType: null,
            matchConfidence: null,
            blockMetadata: {},
            lineMetadata: {},
          },
        ],
      },
    });

    const result = await svwmsWddMatcherMovementImportAdapter.loadCanonicalDocuments(
      {} as never,
      "org-1",
      "branch-1",
      { session_id: "session-1" }
    );

    expect(result.success).toBe(true);
    if (!result.success) return;
    expect(result.data).toHaveLength(1);
    expect(result.data[0]).toMatchObject({
      sourceDocumentId: "svwms-session:session-1",
      sourceDocumentNumber: "Dostawa 26.06.2026 22:09",
      senderName: null,
      recipientName: null,
    });
    expect(result.data[0].lines).toHaveLength(2);
    expect(result.data[0].lines[0].rawMetadata).toMatchObject({
      wdd_number: "WDD/1488/26/3142",
      order_number: "BLWK/6",
      parsed_location: "PRZY A1",
      source_block_type: "wdd_reconciliation",
    });
    expect(result.data[0].lines[1].rawMetadata).toMatchObject({
      order_number: null,
      source_block_type: "direct_order",
    });
  });
});
