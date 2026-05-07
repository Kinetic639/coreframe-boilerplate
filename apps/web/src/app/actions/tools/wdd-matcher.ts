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
  type WddMatcherBlock,
  type WddMatchResultEntry,
  type ExtractedFileData,
  type PdfBlockData,
  type MatchSummary,
} from "@/server/services/wdd-matcher.service";
import { exportCsvSchema } from "@/lib/validations/wdd-matcher";
import type {
  ParseResultV4,
  ParsedBlockV4,
  ParsedLineV4,
} from "@/lib/tools/svwms-wdd-matcher/parser_v4";
import type { BlockMatchType } from "@/lib/validations/wdd-matcher";
import { runWddEnrichment, toMatchSummary } from "@/lib/tools/svwms-wdd-matcher/matcher";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export interface PreparedWddMatcherSessionResult {
  session: WddMatcherSession;
  extractedFiles: ExtractedFileData[];
  results: WddMatchResultEntry[];
  pdfBlocks: PdfBlockData[];
  summary: MatchSummary;
}

function errMsg(r: { success: boolean; error?: string }): string {
  return (r as { error: string }).error;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function metadataNumber(metadata: Record<string, unknown>, key: string): number | null {
  const value = metadata[key];
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toPreparedFileRecord(args: {
  fileId: string;
  sessionId: string;
  orgId: string;
  file: File;
  parseResult: ParseResultV4;
}): ExtractedFileData["file"] {
  return {
    id: args.fileId,
    session_id: args.sessionId,
    organization_id: args.orgId,
    file_role: args.parseResult.detectedRole,
    file_path: null,
    file_name: args.file.name,
    file_size: args.file.size,
    brand_label: args.parseResult.detectedRole,
    parsed_at: nowIso(),
    parse_error: null,
    created_at: nowIso(),
  };
}

function toPreparedBlockRecord(args: {
  blockId: string;
  fileId: string;
  sessionId: string;
  orgId: string;
  block: ParsedBlockV4;
}): WddMatcherBlock {
  return {
    id: args.blockId,
    session_file_id: args.fileId,
    session_id: args.sessionId,
    organization_id: args.orgId,
    block_index: args.block.blockIndex,
    block_type: args.block.blockType,
    block_header_text: args.block.header,
    warehouse_section: args.block.warehouseSection,
    brand_label: args.block.warehouseFamilyAlias,
    from_section: null,
    to_section: null,
    is_excluded: false,
    page_number: args.block.pageNumber,
    metadata: {
      ...args.block.metadata,
      header_raw: args.block.headerRaw,
      header_normalized: args.block.headerNormalized,
      warehouse_code: args.block.warehouseCode,
      warehouse_section_code: args.block.warehouseSectionCode,
      warehouse_section_label: args.block.warehouseSectionLabel,
      warehouse_family_alias: args.block.warehouseFamilyAlias,
      document_brand: args.block.documentBrand,
      logical_order_family: args.block.logicalOrderFamily,
      group_name_normalized: args.block.groupNameNormalized,
      shipment_code: args.block.shipmentCode,
      group_source_label: args.block.groupSourceLabel,
      parser_quality: args.block.parserQuality,
      parser_status: args.block.parserStatus,
      block_validation: args.block.blockValidation,
      logical_order_key: args.block.logicalOrderKey,
      reconstructed_block: args.block.reconstructedBlock,
      reconstruction_sources: args.block.reconstructionSources,
      requires_manual_review: args.block.requiresManualReview,
      manual_review_reasons: args.block.manualReviewReasons,
    },
    created_at: nowIso(),
  };
}

function toPreparedLineRecord(args: {
  lineId: string;
  blockId: string;
  sessionId: string;
  orgId: string;
  line: ParsedLineV4;
}): WddMatcherLine {
  return {
    id: args.lineId,
    block_id: args.blockId,
    session_id: args.sessionId,
    organization_id: args.orgId,
    line_number: args.line.lineNumber,
    product_code: args.line.productCode,
    product_name: args.line.productName,
    quantity: args.line.quantityAbs,
    unit: args.line.unit,
    location: args.line.location,
    raw_text: args.line.rawText,
    page_number: args.line.pageNumber,
    metadata: {
      lp: args.line.lp,
      product_code_kind: args.line.productCodeKind,
      quantity_abs: args.line.quantityAbs,
      quantity_signed: args.line.quantitySigned,
      quantity_legacy: args.line.quantity,
      idp_raw: args.line.idpRaw,
      idp_value: args.line.idpValue,
      idp_abs: args.line.idpAbs,
      movement_direction: args.line.movementDirection,
      operation_code: args.line.operationCode,
      iz: args.line.iz,
      iw: args.line.iw,
      ir: args.line.ir,
      inz: args.line.inz,
      raw_row_text: args.line.rawRowText,
      raw_tokens: args.line.rawTokens,
      assigned_raw_row_text: args.line.assignedRawRowText,
      assigned_raw_tokens: args.line.assignedRawTokens,
      all_row_text_in_band: args.line.allRowTextInBand,
      all_row_tokens_in_band: args.line.allRowTokensInBand,
      raw_name_fragments: args.line.rawNameFragments,
      raw_location_fragments: args.line.rawLocationFragments,
      raw_cells: args.line.rawCells,
      corrections: args.line.corrections,
      name_source: args.line.nameSource,
      row_confidence: args.line.rowConfidence,
      has_orphan_tokens: args.line.hasOrphanTokens,
      unassigned_tokens_near_row: args.line.unassignedTokensNearRow,
      name_looks_truncated: args.line.nameLooksTruncated,
      has_suspicious_location: args.line.hasSuspiciousLocation,
      suspicious_location_reason: args.line.suspiciousLocationReason,
      was_duplicate_reconciled: args.line.wasDuplicateReconciled,
      reconciled_from_block_index: args.line.reconciledFromBlockIndex,
      reconciled_from_block_header: args.line.reconciledFromBlockHeader,
      reconciled_from_page_number: args.line.reconciledFromPageNumber,
      reconciled_from_logical_order_family: args.line.reconciledFromLogicalOrderFamily,
      reconciled_from_operation_code: args.line.reconciledFromOperationCode,
      line_validation: args.line.lineValidation,
      warnings: args.line.warnings,
    },
    created_at: nowIso(),
  };
}

function buildPreparedResults(
  blocks: WddMatcherBlock[],
  linesByBlockId: Map<string, WddMatcherLine[]>
): { results: WddMatchResultEntry[]; pdfBlocks: PdfBlockData[]; summary: MatchSummary } {
  const enrich = runWddEnrichment(blocks, linesByBlockId);
  const blockMap = new Map(blocks.map((block) => [block.id, block]));
  const results: WddMatchResultEntry[] = [];

  for (const match of enrich.matches) {
    const wddBlock = match.bcBlockId ? blockMap.get(match.bcBlockId) : undefined;
    if (!wddBlock) continue;
    const wddMeta = wddBlock.metadata;
    const orderBlock = match.brandBlockId ? blockMap.get(match.brandBlockId) : undefined;
    const orderMeta = orderBlock?.metadata ?? {};

    results.push({
      wdd: {
        blockId: wddBlock.id,
        headerText: wddBlock.block_header_text,
        wddNumber: metadataString(wddMeta, "wdd_number"),
        groupName: metadataString(wddMeta, "group_name"),
        partsCount: typeof wddMeta.parts_count === "number" ? wddMeta.parts_count : 0,
        pageNumber: wddBlock.page_number,
      },
      matchType: match.blockMatchType,
      confidence: match.blockConfidence,
      order: orderBlock
        ? {
            blockId: orderBlock.id,
            headerText: orderBlock.block_header_text,
            orderNumber: metadataString(orderMeta, "order_number"),
            zlNumber: metadataString(orderMeta, "zl_number"),
            zwNumber: metadataString(orderMeta, "zw_number"),
            clientName: metadataString(orderMeta, "client_name"),
            brandLabel: orderBlock.brand_label,
            partsCount: typeof orderMeta.parts_count === "number" ? orderMeta.parts_count : 0,
          }
        : null,
    });
  }

  const toPdfLines = (blockId: string) =>
    (linesByBlockId.get(blockId) ?? []).map((line) => {
      const metadata = line.metadata;
      return {
        lp: metadataNumber(metadata, "lp") ?? line.line_number,
        productCode: line.product_code,
        productName: line.product_name,
        iz: metadataNumber(metadata, "iz"),
        iw: metadataNumber(metadata, "iw"),
        ir: metadataNumber(metadata, "ir"),
        inz: metadataNumber(metadata, "inz"),
        location: line.location,
        quantity: line.quantity,
        idpRaw: metadataString(metadata, "idp_raw"),
        unit: line.unit,
        operationCode: metadataString(metadata, "operation_code"),
      };
    });

  const directPdfBlocks: PdfBlockData[] = blocks
    .filter((block) => block.block_type === "direct_order" && !block.is_excluded)
    .map((block) => {
      const metadata = block.metadata;
      return {
        isDirect: true,
        headerText: block.block_header_text,
        wddNumber: metadataString(metadata, "wdd_number"),
        groupName: metadataString(metadata, "group_name"),
        orderNumber: metadataString(metadata, "order_number"),
        zlNumber: metadataString(metadata, "zl_number"),
        zwNumber: metadataString(metadata, "zw_number"),
        clientName: metadataString(metadata, "client_name"),
        manualNote: metadataString(metadata, "manual_note"),
        vin: metadataString(metadata, "vin"),
        warehouseCode: metadataString(metadata, "warehouse_code"),
        warehouseLabel: metadataString(metadata, "warehouse_section_label"),
        documentBrand: metadataString(metadata, "document_brand"),
        matchType: "unmatched_bc" as BlockMatchType,
        confidence: 0,
        lines: toPdfLines(block.id),
      };
    });

  const wddPdfBlocks: PdfBlockData[] = enrich.matches.flatMap((match) => {
    if (!match.bcBlockId) return [];
    const wddBlock = blockMap.get(match.bcBlockId);
    if (!wddBlock || wddBlock.block_type !== "wdd_reconciliation") return [];
    const wddMeta = wddBlock.metadata;
    const orderMeta = match.brandBlockId ? (blockMap.get(match.brandBlockId)?.metadata ?? {}) : {};
    return [
      {
        isDirect: false,
        headerText: wddBlock.block_header_text,
        wddNumber: metadataString(wddMeta, "wdd_number"),
        groupName: metadataString(wddMeta, "group_name"),
        orderNumber: metadataString(orderMeta, "order_number"),
        zlNumber: metadataString(orderMeta, "zl_number"),
        zwNumber: metadataString(orderMeta, "zw_number"),
        clientName: metadataString(orderMeta, "client_name"),
        manualNote: metadataString(orderMeta, "manual_note"),
        vin: metadataString(orderMeta, "vin"),
        warehouseCode:
          metadataString(orderMeta, "warehouse_code") ?? metadataString(wddMeta, "warehouse_code"),
        warehouseLabel:
          metadataString(orderMeta, "warehouse_section_label") ??
          metadataString(wddMeta, "warehouse_section_label"),
        documentBrand:
          metadataString(orderMeta, "document_brand") ?? metadataString(wddMeta, "document_brand"),
        matchType: match.blockMatchType,
        confidence: match.blockConfidence,
        lines: toPdfLines(wddBlock.id),
      },
    ];
  });

  return {
    results,
    pdfBlocks: [...directPdfBlocks, ...wddPdfBlocks],
    summary: toMatchSummary(enrich.summary),
  };
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

    const { buildCsvString } = await import("@/lib/tools/svwms-wdd-matcher/csv-exporter");
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

export async function prepareFastSessionAction(
  formData: FormData
): Promise<ActionResult<PreparedWddMatcherSessionResult>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_UPLOAD))
      return { success: false, error: "Unauthorized" };

    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return { success: false, error: "No files provided" };
    if (files.some((file) => file.type !== "application/pdf")) {
      return { success: false, error: "Only PDF files are accepted" };
    }
    if (files.some((file) => file.size > 26214400)) {
      return { success: false, error: "Each file must be ≤ 25 MB" };
    }

    const now = new Date();
    const sessionName = `Dostawa ${now.toLocaleDateString("pl-PL")} ${now.toLocaleTimeString("pl-PL", { hour: "2-digit", minute: "2-digit" })}`;
    const sessionResult = await WddMatcherService.createSession(
      supabase,
      orgId,
      null,
      sessionName,
      user.id
    );
    if (!sessionResult.success) return { success: false, error: errMsg(sessionResult) };

    const session = sessionResult.data;
    const extractedFiles: ExtractedFileData[] = [];
    const allBlocks: WddMatcherBlock[] = [];
    const linesByBlockId = new Map<string, WddMatcherLine[]>();

    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const { parsePdfAutoV4 } = await import("@/lib/tools/svwms-wdd-matcher/parser_v4");
      const parseResult = await parsePdfAutoV4(await file.arrayBuffer());
      const fileId = `${session.id}-temp-file-${fileIndex}`;
      const fileRecord = toPreparedFileRecord({
        fileId,
        sessionId: session.id,
        orgId,
        file,
        parseResult,
      });
      const fileBlocks: ExtractedFileData["blocks"] = [];

      for (const parsedBlock of parseResult.blocks) {
        const blockId = `${fileId}-block-${parsedBlock.blockIndex}`;
        const block = toPreparedBlockRecord({
          blockId,
          fileId,
          sessionId: session.id,
          orgId,
          block: parsedBlock,
        });
        const lines = parsedBlock.lines.map((line) =>
          toPreparedLineRecord({
            lineId: `${blockId}-line-${line.lineNumber}`,
            blockId,
            sessionId: session.id,
            orgId,
            line,
          })
        );
        allBlocks.push(block);
        linesByBlockId.set(blockId, lines);
        fileBlocks.push({ block, lines });
      }

      extractedFiles.push({ file: fileRecord, blocks: fileBlocks });
    }

    const { results, pdfBlocks, summary } = buildPreparedResults(allBlocks, linesByBlockId);

    return {
      success: true,
      data: {
        session: {
          ...session,
          status: "processing",
          match_summary: summary as unknown as Record<string, unknown>,
        },
        extractedFiles,
        results,
        pdfBlocks,
        summary,
      },
    };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" };
  }
}

export async function persistPreparedSessionAction(
  formData: FormData
): Promise<ActionResult<{ sessionId: string }>> {
  try {
    const { supabase, user, context } = await getAuthedContext();
    if (!user) return { success: false, error: "Unauthenticated" };
    const orgId = context?.app.activeOrgId;
    if (!orgId) return { success: false, error: "No active organisation" };
    if (!checkPermission(context.user.permissionSnapshot, PERMISSION_WDD_MATCHER_UPLOAD))
      return { success: false, error: "Unauthorized" };

    const sessionId = formData.get("sessionId");
    const extractedFilesJson = formData.get("extractedFiles");
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);

    if (typeof sessionId !== "string" || !sessionId) {
      return { success: false, error: "sessionId required" };
    }
    if (typeof extractedFilesJson !== "string" || !extractedFilesJson) {
      return { success: false, error: "prepared extracted files required" };
    }

    const extractedFiles = JSON.parse(extractedFilesJson) as ExtractedFileData[];
    if (!Array.isArray(extractedFiles) || extractedFiles.length === 0) {
      return { success: false, error: "No extracted files provided" };
    }

    await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "processing");

    const persistedBlocks: WddMatcherBlock[] = [];
    const persistedLinesByBlockId = new Map<string, WddMatcherLine[]>();

    for (let fileIndex = 0; fileIndex < extractedFiles.length; fileIndex += 1) {
      const extractedFile = extractedFiles[fileIndex];
      const sourceFile = files[fileIndex];
      const registerResult = await WddMatcherService.registerFile(
        supabase,
        sessionId,
        orgId,
        extractedFile.file.file_role,
        extractedFile.file.file_name,
        extractedFile.file.file_size,
        extractedFile.file.brand_label ?? undefined
      );
      if (!registerResult.success) {
        await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
        return { success: false, error: errMsg(registerResult) };
      }

      const dbFile = registerResult.data;
      if (sourceFile) {
        const uploadResult = await WddMatcherService.uploadPdf(
          supabase,
          orgId,
          sessionId,
          dbFile.id,
          sourceFile
        );
        if (!uploadResult.success) {
          await WddMatcherService.markFileParsed(supabase, dbFile.id, orgId, errMsg(uploadResult));
          await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
          return { success: false, error: errMsg(uploadResult) };
        }
      }

      const blockInserts = extractedFile.blocks.map(({ block }) => ({
        sessionFileId: dbFile.id,
        blockIndex: block.block_index,
        blockType: block.block_type,
        header: block.block_header_text,
        warehouseSection: block.warehouse_section,
        brandLabel: block.brand_label,
        fromSection: block.from_section,
        toSection: block.to_section,
        isExcluded: false as const,
        pageNumber: block.page_number,
        metadata: block.metadata,
      }));

      const blocksResult = await WddMatcherService.insertBlocks(
        supabase,
        sessionId,
        orgId,
        blockInserts
      );
      if (!blocksResult.success) {
        await WddMatcherService.markFileParsed(supabase, dbFile.id, orgId, errMsg(blocksResult));
        await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
        return { success: false, error: errMsg(blocksResult) };
      }

      for (let blockIndex = 0; blockIndex < extractedFile.blocks.length; blockIndex += 1) {
        const sourceBlock = extractedFile.blocks[blockIndex];
        const dbBlock = blocksResult.data[blockIndex];
        if (!dbBlock) continue;

        const lineInserts = sourceBlock.lines.map((line) => ({
          blockId: dbBlock.id,
          lineNumber: line.line_number,
          productCode: line.product_code,
          productName: line.product_name,
          quantity: line.quantity,
          unit: line.unit,
          location: line.location,
          rawText: line.raw_text,
          pageNumber: line.page_number,
          metadata: line.metadata,
        }));

        const linesResult = await WddMatcherService.insertLines(
          supabase,
          sessionId,
          orgId,
          lineInserts
        );
        if (!linesResult.success) {
          await WddMatcherService.markFileParsed(supabase, dbFile.id, orgId, errMsg(linesResult));
          await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
          return { success: false, error: errMsg(linesResult) };
        }

        persistedBlocks.push(dbBlock);
        persistedLinesByBlockId.set(
          dbBlock.id,
          sourceBlock.lines.map((line, lineIndex) => ({
            ...line,
            id: `${dbBlock.id}-line-${lineIndex}`,
            block_id: dbBlock.id,
            session_id: sessionId,
            organization_id: orgId,
          }))
        );
      }

      await WddMatcherService.markFileParsed(supabase, dbFile.id, orgId);
    }

    await WddMatcherService.clearSessionMatches(supabase, sessionId, orgId);
    const enrichResult = runWddEnrichment(persistedBlocks, persistedLinesByBlockId);
    const insertMatchesResult = await WddMatcherService.insertBlockMatches(
      supabase,
      sessionId,
      orgId,
      enrichResult.matches
    );
    if (!insertMatchesResult.success) {
      await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
      return { success: false, error: errMsg(insertMatchesResult) };
    }

    const summary = toMatchSummary(enrichResult.summary);
    const summaryResult = await WddMatcherService.updateMatchSummary(
      supabase,
      sessionId,
      orgId,
      summary
    );
    if (!summaryResult.success) {
      await WddMatcherService.updateSessionStatus(supabase, sessionId, orgId, "failed");
      return { success: false, error: errMsg(summaryResult) };
    }

    return { success: true, data: { sessionId } };
  } catch (err) {
    return { success: false, error: err instanceof Error ? err.message : "Unexpected error" };
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
    let parseResult: ParseResultV4;
    try {
      const { parsePdfAutoV4 } = await import("@/lib/tools/svwms-wdd-matcher/parser_v4");
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
export async function runMatchingAction(sessionId: string): Promise<ActionResult<MatchSummary>> {
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

    // Run WDD enrichment engine. Loaded lazily so the tool route does not pull the
    // matcher graph into Turbopack until the server action is actually invoked.
    const { runWddEnrichment, toMatchSummary } =
      await import("@/lib/tools/svwms-wdd-matcher/matcher");
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
