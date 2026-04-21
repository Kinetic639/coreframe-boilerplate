"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PERMISSION_WDD_MATCHER_READ,
  PERMISSION_WDD_MATCHER_UPLOAD,
} from "@repo/contracts/permissions";
import {
  WddMatcherService,
  type WddMatcherSession,
  type WddMatcherLine,
  type WddMatchResultEntry,
  type ExtractedFileData,
  type PdfBlockData,
} from "@/server/services/wdd-matcher.service";
import { exportCsvSchema } from "@/lib/validations/wdd-matcher";
import { parsePdfAutoV4 } from "@/lib/tools/svwms-wdd-matcher/parser_v4";
import { runWddEnrichment, toMatchSummary } from "@/lib/tools/svwms-wdd-matcher/matcher";
import { buildCsvString } from "@/lib/tools/svwms-wdd-matcher/csv-exporter";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

function errMsg(r: { success: boolean; error?: string }): string {
  return (r as { error: string }).error;
}

// ---------------------------------------------------------------------------
// Auth helper
// ---------------------------------------------------------------------------

async function getAuthedContext() {
  const supabase = await createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();
  if (error || !user) return { supabase, user: null, context: null };
  const context = await loadDashboardContextV2();
  return { supabase, user, context };
}

// ---------------------------------------------------------------------------
// Read actions
// ---------------------------------------------------------------------------

export async function listSessionsAction(): Promise<ActionResult<WddMatcherSession[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_READ))
      return { success: false, error: "Unauthorized" };
    return WddMatcherService.listSessions(supabase, orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function getSessionResultsAction(
  sessionId: string
): Promise<ActionResult<WddMatchResultEntry[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_READ))
      return { success: false, error: "Unauthorized" };
    return WddMatcherService.getSessionResults(supabase, sessionId, orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function getSessionExtractedDataAction(
  sessionId: string
): Promise<ActionResult<ExtractedFileData[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_READ))
      return { success: false, error: "Unauthorized" };
    return WddMatcherService.getSessionExtractedData(supabase, sessionId, orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function exportCsvAction(rawInput: unknown): Promise<ActionResult<string>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_READ))
      return { success: false, error: "Unauthorized" };

    const parsed = exportCsvSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: parsed.error.errors[0].message };

    const rowsResult = await WddMatcherService.getExportRows(
      supabase,
      parsed.data.sessionId,
      orgId
    );
    if (!rowsResult.success) return { success: false, error: errMsg(rowsResult) };

    const csv = buildCsvString(rowsResult.data);
    return { success: true, data: csv };
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ---------------------------------------------------------------------------
// Upload + Process — single action that handles one file at a time
// (called in parallel from the client for each file in the drop zone)
// ---------------------------------------------------------------------------

export async function createAutoSessionAction(): Promise<ActionResult<WddMatcherSession>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_UPLOAD))
      return { success: false, error: "Unauthorized" };

    const now = new Date();
    const sessionName = `Dostawa ${now.toLocaleDateString("pl-PL")} ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;

    return WddMatcherService.createSession(supabase, orgId, null, sessionName, user.id);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/**
 * Upload a single PDF, auto-detect its role (bc vs brand), parse it, and persist
 * blocks + lines. Returns the file ID for tracking.
 *
 * Designed to be called in parallel for each file the user drops.
 */
export async function uploadAndParseFileAction(
  formData: FormData
): Promise<ActionResult<{ fileId: string; role: "bc" | "brand"; blockCount: number }>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_UPLOAD))
      return { success: false, error: "Unauthorized" };

    const sessionId = formData.get("sessionId") as string;
    if (!sessionId) return { success: false, error: "sessionId required" };

    const file = formData.get("file") as File | null;
    if (!file) return { success: false, error: "No file provided" };

    if (file.type !== "application/pdf")
      return { success: false, error: `${file.name}: only PDF files are accepted` };
    if (file.size > 26214400)
      return { success: false, error: `${file.name}: file must be ≤ 25 MB` };

    // Read file bytes — parsed once for both role detection and block extraction
    const fileBytes = await file.arrayBuffer();

    // Parse PDF and auto-detect role in a single pass.
    // pdfjs detaches the ArrayBuffer after first use, so detection and parsing
    // cannot be done in two separate calls on the same buffer.
    let parseResult: Awaited<ReturnType<typeof parsePdfAutoV4>>;
    try {
      parseResult = await parsePdfAutoV4(fileBytes);
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Parse failed";
      // Register + mark failed so the session knows this file errored
      const tempReg = await WddMatcherService.registerFile(
        supabase,
        sessionId,
        orgId,
        "brand",
        file.name,
        file.size
      );
      if (tempReg.success) {
        await WddMatcherService.markFileParsed(supabase, tempReg.data.id, orgId, msg);
      }
      return { success: false, error: msg };
    }

    const role = parseResult.detectedRole;

    // Register DB row with the detected role
    const registerResult = await WddMatcherService.registerFile(
      supabase,
      sessionId,
      orgId,
      role,
      file.name,
      file.size
    );
    if (!registerResult.success) return { success: false, error: errMsg(registerResult) };
    const fileRecord = registerResult.data;

    // Upload to storage (file object is still intact — only fileBytes was consumed by pdfjs)
    const uploadResult = await WddMatcherService.uploadPdf(
      supabase,
      orgId,
      sessionId,
      fileRecord.id,
      file
    );
    if (!uploadResult.success) {
      await WddMatcherService.markFileParsed(supabase, fileRecord.id, orgId, errMsg(uploadResult));
      return { success: false, error: errMsg(uploadResult) };
    }

    // Persist blocks
    const blockInserts = parseResult.blocks.map((b, index) => {
      const fileLevelMetadata =
        index === 0
          ? {
              file_parser_quality: parseResult.parserQuality,
              file_parser_status: parseResult.parserStatus,
              file_validation: parseResult.fileValidation,
            }
          : {};

      return {
        sessionFileId: fileRecord.id,
        blockIndex: b.blockIndex,
        blockType: b.blockType as
          | "wdd_reconciliation"
          | "direct_order"
          | "brand_order"
          | "wdd_source",
        header: b.header,
        warehouseSection: b.warehouseSection,
        brandLabel: b.warehouseFamilyAlias,
        fromSection: null,
        toSection: null,
        isExcluded: false as const,
        pageNumber: b.pageNumber,
        metadata: {
          ...b.metadata,
          ...fileLevelMetadata,
          header_raw: b.headerRaw,
          header_normalized: b.headerNormalized,
          warehouse_code: b.warehouseCode,
          warehouse_section_code: b.warehouseSectionCode,
          warehouse_section_label: b.warehouseSectionLabel,
          warehouse_family_alias: b.warehouseFamilyAlias,
          document_brand: b.documentBrand,
          logical_order_family: b.logicalOrderFamily,
          group_name_normalized: b.groupNameNormalized,
          shipment_code: b.shipmentCode,
          group_source_label: b.groupSourceLabel,
          parser_quality: b.parserQuality,
          parser_status: b.parserStatus,
          block_validation: b.blockValidation,
          logical_order_key: b.logicalOrderKey,
          reconstructed_block: b.reconstructedBlock,
          reconstruction_sources: b.reconstructionSources,
          requires_manual_review: b.requiresManualReview,
          manual_review_reasons: b.manualReviewReasons,
        },
      };
    });

    const blocksResult = await WddMatcherService.insertBlocks(
      supabase,
      sessionId,
      orgId,
      blockInserts
    );
    if (!blocksResult.success) {
      const e = errMsg(blocksResult);
      await WddMatcherService.markFileParsed(supabase, fileRecord.id, orgId, e);
      return { success: false, error: e };
    }

    // Persist lines for non-excluded blocks
    const dbBlocks = blocksResult.data;
    for (let i = 0; i < parseResult.blocks.length; i++) {
      const parsedBlock = parseResult.blocks[i];
      const dbBlock = dbBlocks[i];
      if (!dbBlock) continue;

      const lineInserts = parsedBlock.lines.map((l) => ({
        blockId: dbBlock.id,
        lineNumber: l.lineNumber,
        productCode: l.productCode,
        productName: l.productName,
        quantity: l.quantityAbs,
        unit: l.unit,
        location: l.location,
        rawText: l.rawText,
        pageNumber: l.pageNumber,
        metadata: {
          lp: l.lp,
          product_code_kind: l.productCodeKind,
          quantity_abs: l.quantityAbs,
          quantity_signed: l.quantitySigned,
          quantity_legacy: l.quantity,
          idp_raw: l.idpRaw,
          idp_value: l.idpValue,
          idp_abs: l.idpAbs,
          movement_direction: l.movementDirection,
          operation_code: l.operationCode,
          iz: l.iz,
          iw: l.iw,
          ir: l.ir,
          inz: l.inz,
          raw_row_text: l.rawRowText,
          raw_tokens: l.rawTokens,
          assigned_raw_row_text: l.assignedRawRowText,
          assigned_raw_tokens: l.assignedRawTokens,
          all_row_text_in_band: l.allRowTextInBand,
          all_row_tokens_in_band: l.allRowTokensInBand,
          raw_name_fragments: l.rawNameFragments,
          raw_location_fragments: l.rawLocationFragments,
          raw_cells: l.rawCells,
          corrections: l.corrections,
          name_source: l.nameSource,
          row_confidence: l.rowConfidence,
          has_orphan_tokens: l.hasOrphanTokens,
          unassigned_tokens_near_row: l.unassignedTokensNearRow,
          name_looks_truncated: l.nameLooksTruncated,
          has_suspicious_location: l.hasSuspiciousLocation,
          suspicious_location_reason: l.suspiciousLocationReason,
          was_duplicate_reconciled: l.wasDuplicateReconciled,
          reconciled_from_block_index: l.reconciledFromBlockIndex,
          reconciled_from_block_header: l.reconciledFromBlockHeader,
          reconciled_from_page_number: l.reconciledFromPageNumber,
          reconciled_from_logical_order_family: l.reconciledFromLogicalOrderFamily,
          reconciled_from_operation_code: l.reconciledFromOperationCode,
          line_validation: l.lineValidation,
          warnings: l.warnings,
        },
      }));

      const linesResult = await WddMatcherService.insertLines(
        supabase,
        sessionId,
        orgId,
        lineInserts
      );
      if (!linesResult.success) {
        const e = errMsg(linesResult);
        await WddMatcherService.markFileParsed(supabase, fileRecord.id, orgId, e);
        return { success: false, error: e };
      }
    }

    await WddMatcherService.markFileParsed(supabase, fileRecord.id, orgId);

    return {
      success: true,
      data: {
        fileId: fileRecord.id,
        role,
        blockCount: parseResult.blocks.length,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

/**
 * Run block matching for a session after all files have been uploaded and parsed.
 * Returns a match summary.
 */
export async function runMatchingAction(
  sessionId: string
): Promise<ActionResult<ReturnType<typeof toMatchSummary>>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_UPLOAD))
      return { success: false, error: "Unauthorized" };

    // Clear any existing matches (idempotent re-run)
    const clearResult = await WddMatcherService.clearSessionMatches(supabase, sessionId, orgId);
    if (!clearResult.success) return { success: false, error: errMsg(clearResult) };

    await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "processing");

    // Load all blocks
    const blocksResult = await WddMatcherService.listBlocksBySession(supabase, sessionId, orgId);
    if (!blocksResult.success) {
      await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
      return { success: false, error: errMsg(blocksResult) };
    }

    // Load lines for each non-excluded block
    const linesByBlockId = new Map<string, WddMatcherLine[]>();
    for (const block of blocksResult.data) {
      if (block.is_excluded) continue;
      const linesResult = await WddMatcherService.listLinesByBlock(supabase, block.id, orgId);
      if (linesResult.success) {
        linesByBlockId.set(block.id, linesResult.data);
      }
    }

    // Run WDD enrichment engine
    const enrichResult = runWddEnrichment(blocksResult.data, linesByBlockId);

    // Persist matches
    const insertResult = await WddMatcherService.insertBlockMatches(
      supabase,
      sessionId,
      orgId,
      enrichResult.matches
    );
    if (!insertResult.success) {
      await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
      return { success: false, error: errMsg(insertResult) };
    }

    // Update session status + summary
    const summary = toMatchSummary(enrichResult.summary);
    await WddMatcherService.updateMatchSummary(supabase, sessionId, orgId, summary);

    return { success: true, data: summary };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function getEnhancedPdfDataAction(
  sessionId: string
): Promise<ActionResult<PdfBlockData[]>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_READ))
      return { success: false, error: "Unauthorized" };

    return await WddMatcherService.getEnhancedPdfData(supabase, sessionId, orgId);
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}
