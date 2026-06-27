import { SupabaseClient } from "@supabase/supabase-js";
import type {
  BlockMatchType,
  FileRole,
  LineMatchType,
  ReviewStatus,
  SessionStatus,
} from "@/lib/validations/wdd-matcher";

// ---------------------------------------------------------------------------
// Session results — structured output for the simplified results view
// ---------------------------------------------------------------------------

export interface WddMatchResultEntry {
  wdd: {
    blockId: string;
    headerText: string | null;
    wddNumber: string | null;
    groupName: string | null;
    partsCount: number;
    pageNumber: number | null;
  };
  matchType: BlockMatchType;
  confidence: number;
  order: {
    blockId: string;
    headerText: string | null;
    orderNumber: string | null;
    zlNumber: string | null;
    zwNumber: string | null;
    clientName: string | null;
    brandLabel: string | null;
    partsCount: number;
  } | null;
}

// ---------------------------------------------------------------------------
// Shared types
// ---------------------------------------------------------------------------

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface WddMatcherSession {
  id: string;
  organization_id: string;
  branch_id: string | null;
  name: string;
  status: SessionStatus;
  match_summary: Record<string, unknown> | null;
  created_by: string | null;
  approved_by: string | null;
  approved_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface WddMatcherSessionFile {
  id: string;
  session_id: string;
  organization_id: string;
  file_role: FileRole;
  file_path: string | null;
  file_name: string;
  file_size: number;
  brand_label: string | null;
  parsed_at: string | null;
  parse_error: string | null;
  created_at: string;
}

export interface WddMatcherBlock {
  id: string;
  session_file_id: string;
  session_id: string;
  organization_id: string;
  block_index: number;
  block_type: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source";
  block_header_text: string | null;
  warehouse_section: string | null;
  brand_label: string | null;
  from_section: string | null;
  to_section: string | null;
  is_excluded: boolean;
  page_number: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WddMatcherLine {
  id: string;
  block_id: string;
  session_id: string;
  organization_id: string;
  line_number: number;
  product_code: string | null;
  product_name: string | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  raw_text: string | null;
  page_number: number | null;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface WddMatcherBlockMatch {
  id: string;
  session_id: string;
  organization_id: string;
  bc_block_id: string | null;
  brand_block_id: string | null;
  wdd_block_id: string | null;
  block_match_type: BlockMatchType;
  block_confidence: number;
  block_match_reasons: Record<string, unknown>;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface WddMatcherLineMatch {
  id: string;
  block_match_id: string;
  session_id: string;
  organization_id: string;
  bc_line_id: string | null;
  brand_line_id: string | null;
  wdd_line_id: string | null;
  line_match_type: LineMatchType;
  line_confidence: number;
  line_match_reasons: Record<string, unknown>;
  discrepancies: Array<{ field: string; bc_value: unknown; brand_value: unknown }>;
  review_status: ReviewStatus;
  reviewed_by: string | null;
  reviewed_at: string | null;
  reviewer_notes: string | null;
  created_at: string;
  updated_at: string;
}

export interface MatchSummary {
  exact_block_matches: number;
  partial_block_matches: number;
  unmatched_bc: number;
  unmatched_brand: number;
  total_lines_matched: number;
  total_wdd_blocks: number;
  direct_orders: number;
}

export interface ExtractedBlockData {
  block: WddMatcherBlock;
  lines: WddMatcherLine[];
}

export interface ExtractedFileData {
  file: WddMatcherSessionFile;
  blocks: ExtractedBlockData[];
}

export interface PdfLineData {
  lp: number | null;
  productCode: string | null;
  productName: string | null;
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  location: string | null;
  quantity: number | null;
  idpRaw: string | null;
  unit: string | null;
  operationCode: string | null;
}

export interface PdfBlockData {
  isDirect: boolean;
  headerText: string | null;
  wddNumber: string | null;
  groupName: string | null;
  orderNumber: string | null;
  zlNumber: string | null;
  zwNumber: string | null;
  clientName: string | null;
  manualNote: string | null;
  vin: string | null;
  warehouseCode: string | null;
  warehouseLabel: string | null;
  documentBrand: string | null;
  matchType: BlockMatchType;
  confidence: number;
  lines: PdfLineData[];
}

export interface WddMovementImportCandidateLine {
  sourceBlockId: string;
  sourceLineId: string;
  sourceBlockType: WddMatcherBlock["block_type"];
  lineNumber: number;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  parsedLocation: string | null;
  wddNumber: string | null;
  orderNumber: string | null;
  zlNumber: string | null;
  zwNumber: string | null;
  clientName: string | null;
  groupName: string | null;
  warehouseCode: string | null;
  warehouseLabel: string | null;
  documentBrand: string | null;
  matchType: BlockMatchType | null;
  matchConfidence: number | null;
  blockMetadata: Record<string, unknown>;
  lineMetadata: Record<string, unknown>;
}

export interface WddMovementImportCandidates {
  session: WddMatcherSession;
  lines: WddMovementImportCandidateLine[];
}

export interface ExportRow {
  session_name: string;
  session_status: string;
  bc_file_name: string;
  brand_file_name: string;
  brand_file_label: string;
  block_match_type: string;
  block_confidence: number;
  block_review_status: string;
  bc_block_header: string;
  bc_warehouse_section: string;
  brand_block_header: string;
  brand_to_section: string;
  line_match_type: string;
  line_confidence: number;
  line_review_status: string;
  bc_product_code: string;
  bc_product_name: string;
  bc_quantity: string;
  bc_unit: string;
  brand_product_code: string;
  brand_product_name: string;
  brand_quantity: string;
  brand_unit: string;
  wdd_corroborated: string;
  wdd_product_code: string;
  wdd_quantity: string;
  discrepancy_fields: string;
  discrepancy_detail: string;
  reviewer_notes: string;
}

// Input types for bulk inserts
export interface BlockInsertInput {
  sessionFileId: string;
  blockIndex: number;
  blockType: WddMatcherBlock["block_type"];
  /** Renamed from blockHeaderText — maps to block_header_text column. */
  header: string | null;
  warehouseSection: string | null;
  brandLabel: string | null;
  fromSection: string | null;
  toSection: string | null;
  /** Always false — parser never excludes blocks. */
  isExcluded: false;
  pageNumber: number | null;
  metadata?: Record<string, unknown>;
}

export interface LineInsertInput {
  blockId: string;
  lineNumber: number;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  rawText: string | null;
  pageNumber: number | null;
  metadata?: Record<string, unknown>;
}

export interface BlockMatchInsertInput {
  bcBlockId: string | null;
  brandBlockId: string | null;
  wddBlockId: string | null;
  blockMatchType: BlockMatchType;
  blockConfidence: number;
  blockMatchReasons: Record<string, unknown>;
  reviewStatus: ReviewStatus;
}

export interface LineMatchInsertInput {
  blockMatchId: string;
  bcLineId: string | null;
  brandLineId: string | null;
  wddLineId: string | null;
  lineMatchType: LineMatchType;
  lineConfidence: number;
  lineMatchReasons: Record<string, unknown>;
  discrepancies: Array<{ field: string; bc_value: unknown; brand_value: unknown }>;
  reviewStatus: ReviewStatus;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function normalizeDbError(error: { code?: string; message: string }): string {
  if (error.code === "42501" || error.message?.includes("row-level security")) {
    return "You do not have permission to perform this action.";
  }
  return error.message;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function wddSortNumber(value: string | null): number {
  if (!value) return Number.POSITIVE_INFINITY;
  const match = value.match(/\/(\d+)/);
  return match ? Number(match[1]) : Number.POSITIVE_INFINITY;
}

// ---------------------------------------------------------------------------
// WddMatcherService
// ---------------------------------------------------------------------------

export class WddMatcherService {
  // -------------------------------------------------------------------------
  // Sessions
  // -------------------------------------------------------------------------

  static async createSession(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string | null,
    name: string,
    userId: string
  ): Promise<ServiceResult<WddMatcherSession>> {
    const { data, error } = await supabase
      .from("wdd_matcher_sessions")
      .insert({
        organization_id: orgId,
        branch_id: branchId,
        name,
        created_by: userId,
        status: "pending",
      })
      .select("*")
      .single();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherSession };
  }

  static async updateSessionStatus(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    status: SessionStatus,
    extra?: Partial<Pick<WddMatcherSession, "approved_by" | "approved_at">>
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("wdd_matcher_sessions")
      .update({ status, ...extra })
      .eq("id", sessionId)
      .eq("organization_id", orgId);
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async updateMatchSummary(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    summary: MatchSummary
  ): Promise<ServiceResult<void>> {
    const { error } = await supabase
      .from("wdd_matcher_sessions")
      .update({ match_summary: summary, status: "ready_for_review" })
      .eq("id", sessionId)
      .eq("organization_id", orgId);
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async listSessions(
    supabase: SupabaseClient,
    orgId: string,
    branchId?: string | null
  ): Promise<ServiceResult<WddMatcherSession[]>> {
    let query = supabase
      .from("wdd_matcher_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .order("created_at", { ascending: false });
    if (branchId) query = query.eq("branch_id", branchId);
    const { data, error } = await query;
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherSession[] };
  }

  static async listImportableSessionsForBranch(
    supabase: SupabaseClient,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<WddMatcherSession[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_sessions")
      .select("*")
      .eq("organization_id", orgId)
      .eq("branch_id", branchId)
      .not("created_by", "is", null)
      .in("status", ["ready_for_review", "approved"])
      .order("created_at", { ascending: false })
      .limit(50);
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherSession[] };
  }

  static async getSession(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherSession | null>> {
    const { data, error } = await supabase
      .from("wdd_matcher_sessions")
      .select("*")
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .maybeSingle();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherSession | null };
  }

  static async getMovementImportCandidates(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    branchId: string
  ): Promise<ServiceResult<WddMovementImportCandidates>> {
    const sessionResult = await WddMatcherService.getSession(supabase, sessionId, orgId);
    if (!sessionResult.success) return sessionResult as ServiceResult<WddMovementImportCandidates>;
    if (!sessionResult.data) return { success: false, error: "SVWMS matcher session not found" };
    if (!sessionResult.data.created_by) {
      return {
        success: false,
        error: "Only authenticated dashboard matcher sessions can import movements",
      };
    }
    if (sessionResult.data.branch_id !== branchId) {
      return { success: false, error: "Matcher session belongs to another branch" };
    }
    if (!["ready_for_review", "approved"].includes(sessionResult.data.status)) {
      return { success: false, error: "Matcher session is not ready to import" };
    }

    const [blocksRes, matchesRes] = await Promise.all([
      supabase
        .from("wdd_matcher_blocks")
        .select("*")
        .eq("session_id", sessionId)
        .eq("organization_id", orgId),
      supabase
        .from("wdd_matcher_block_matches")
        .select("*")
        .eq("session_id", sessionId)
        .eq("organization_id", orgId),
    ]);
    if (blocksRes.error) return { success: false, error: normalizeDbError(blocksRes.error) };
    if (matchesRes.error) return { success: false, error: normalizeDbError(matchesRes.error) };

    const blocks = (blocksRes.data ?? []) as WddMatcherBlock[];
    const blockMap = new Map(blocks.map((block) => [block.id, block]));
    const importableBlocks = blocks.filter(
      (block) =>
        !block.is_excluded &&
        (block.block_type === "wdd_reconciliation" || block.block_type === "direct_order")
    );
    if (importableBlocks.length === 0) {
      return { success: true, data: { session: sessionResult.data, lines: [] } };
    }

    const matchByWddBlockId = new Map<string, WddMatcherBlockMatch>();
    for (const match of (matchesRes.data ?? []) as WddMatcherBlockMatch[]) {
      const blockId = match.bc_block_id ?? match.wdd_block_id;
      if (!blockId) continue;
      const current = matchByWddBlockId.get(blockId);
      if (!current || match.block_confidence > current.block_confidence) {
        matchByWddBlockId.set(blockId, match);
      }
    }

    const { data: lineRows, error: linesError } = await supabase
      .from("wdd_matcher_lines")
      .select("*")
      .in(
        "block_id",
        importableBlocks.map((block) => block.id)
      )
      .eq("organization_id", orgId)
      .order("line_number", { ascending: true });
    if (linesError) return { success: false, error: normalizeDbError(linesError) };

    const importableBlockIds = new Set(importableBlocks.map((block) => block.id));
    const lines = ((lineRows ?? []) as WddMatcherLine[])
      .filter((line) => {
        if (!importableBlockIds.has(line.block_id)) return false;
        return Boolean(line.product_code || line.product_name || line.quantity);
      })
      .map((line): WddMovementImportCandidateLine | null => {
        const block = blockMap.get(line.block_id);
        if (!block) return null;
        const blockMetadata = block.metadata ?? {};
        const match = matchByWddBlockId.get(block.id) ?? null;
        const orderBlock = match?.brand_block_id ? blockMap.get(match.brand_block_id) : null;
        const orderMetadata = orderBlock?.metadata ?? {};
        const orderNumber =
          block.block_type === "wdd_reconciliation"
            ? metadataString(orderMetadata, "order_number")
            : metadataString(blockMetadata, "order_number");

        return {
          sourceBlockId: block.id,
          sourceLineId: line.id,
          sourceBlockType: block.block_type,
          lineNumber: line.line_number,
          productCode: line.product_code,
          productName: line.product_name,
          quantity: line.quantity,
          unit: line.unit,
          parsedLocation: line.location,
          wddNumber: metadataString(blockMetadata, "wdd_number"),
          orderNumber,
          zlNumber:
            metadataString(orderMetadata, "zl_number") ??
            metadataString(blockMetadata, "zl_number"),
          zwNumber:
            metadataString(orderMetadata, "zw_number") ??
            metadataString(blockMetadata, "zw_number"),
          clientName:
            metadataString(orderMetadata, "client_name") ??
            metadataString(blockMetadata, "client_name"),
          groupName: metadataString(blockMetadata, "group_name"),
          warehouseCode:
            metadataString(orderMetadata, "warehouse_code") ??
            metadataString(blockMetadata, "warehouse_code"),
          warehouseLabel:
            metadataString(orderMetadata, "warehouse_section_label") ??
            metadataString(blockMetadata, "warehouse_section_label"),
          documentBrand:
            metadataString(orderMetadata, "document_brand") ??
            metadataString(blockMetadata, "document_brand"),
          matchType: match?.block_match_type ?? null,
          matchConfidence: match?.block_confidence ?? null,
          blockMetadata,
          lineMetadata: line.metadata ?? {},
        };
      })
      .filter((line): line is WddMovementImportCandidateLine => Boolean(line))
      .sort((a, b) => {
        const orderCompare = (a.orderNumber ?? "\uffff").localeCompare(b.orderNumber ?? "\uffff");
        if (orderCompare !== 0) return orderCompare;
        const wddCompare = wddSortNumber(a.wddNumber) - wddSortNumber(b.wddNumber);
        if (wddCompare !== 0) return wddCompare;
        if (a.sourceBlockId !== b.sourceBlockId) {
          return a.sourceBlockId.localeCompare(b.sourceBlockId);
        }
        return a.lineNumber - b.lineNumber;
      });

    return { success: true, data: { session: sessionResult.data, lines } };
  }

  static async approveSession(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<WddMatcherSession>> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wdd_matcher_sessions")
      .update({ status: "approved", approved_by: userId, approved_at: now })
      .eq("id", sessionId)
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherSession };
  }

  // -------------------------------------------------------------------------
  // Files
  // -------------------------------------------------------------------------

  static async registerFile(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    role: FileRole,
    fileName: string,
    fileSize: number,
    brandLabel?: string
  ): Promise<ServiceResult<WddMatcherSessionFile>> {
    const { data, error } = await supabase
      .from("wdd_matcher_session_files")
      .insert({
        session_id: sessionId,
        organization_id: orgId,
        file_role: role,
        file_name: fileName,
        file_size: fileSize,
        brand_label: brandLabel ?? null,
      })
      .select("*")
      .single();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherSessionFile };
  }

  static async uploadPdf(
    supabase: SupabaseClient,
    orgId: string,
    sessionId: string,
    fileId: string,
    file: File
  ): Promise<ServiceResult<string>> {
    const path = `${orgId}/${sessionId}/${fileId}.pdf`;
    const { error } = await supabase.storage.from("wdd-matcher-files").upload(path, file, {
      contentType: "application/pdf",
      upsert: false,
    });
    if (error) return { success: false, error: error.message };

    // Persist path to DB
    const { error: dbError } = await supabase
      .from("wdd_matcher_session_files")
      .update({ file_path: path })
      .eq("id", fileId)
      .eq("organization_id", orgId);
    if (dbError) return { success: false, error: normalizeDbError(dbError) };

    return { success: true, data: path };
  }

  static async downloadPdfBytes(
    supabase: SupabaseClient,
    path: string
  ): Promise<ServiceResult<ArrayBuffer>> {
    const { data, error } = await supabase.storage.from("wdd-matcher-files").download(path);
    if (error) return { success: false, error: error.message };
    const buffer = await data.arrayBuffer();
    return { success: true, data: buffer };
  }

  static async markFileParsed(
    supabase: SupabaseClient,
    fileId: string,
    orgId: string,
    parseError?: string
  ): Promise<ServiceResult<void>> {
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("wdd_matcher_session_files")
      .update({ parsed_at: now, parse_error: parseError ?? null })
      .eq("id", fileId)
      .eq("organization_id", orgId);
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async listSessionFiles(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherSessionFile[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_session_files")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherSessionFile[] };
  }

  // -------------------------------------------------------------------------
  // Blocks
  // -------------------------------------------------------------------------

  static async insertBlocks(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    blocks: BlockInsertInput[]
  ): Promise<ServiceResult<WddMatcherBlock[]>> {
    if (blocks.length === 0) return { success: true, data: [] };

    const rows = blocks.map((b) => ({
      session_file_id: b.sessionFileId,
      session_id: sessionId,
      organization_id: orgId,
      block_index: b.blockIndex,
      block_type: b.blockType,
      block_header_text: b.header,
      warehouse_section: b.warehouseSection,
      brand_label: b.brandLabel,
      from_section: b.fromSection,
      to_section: b.toSection,
      is_excluded: b.isExcluded,
      page_number: b.pageNumber,
      metadata: b.metadata ?? {},
    }));

    const { data, error } = await supabase.from("wdd_matcher_blocks").insert(rows).select("*");
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherBlock[] };
  }

  static async insertLines(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    lines: LineInsertInput[]
  ): Promise<ServiceResult<void>> {
    if (lines.length === 0) return { success: true, data: undefined };

    const rows = lines.map((l) => ({
      block_id: l.blockId,
      session_id: sessionId,
      organization_id: orgId,
      line_number: l.lineNumber,
      product_code: l.productCode,
      product_name: l.productName,
      quantity: l.quantity,
      unit: l.unit,
      location: l.location,
      raw_text: l.rawText,
      page_number: l.pageNumber,
      metadata: l.metadata ?? {},
    }));

    // Insert in chunks of 500 to avoid request size limits
    const CHUNK = 500;
    for (let i = 0; i < rows.length; i += CHUNK) {
      const { error } = await supabase.from("wdd_matcher_lines").insert(rows.slice(i, i + CHUNK));
      if (error) return { success: false, error: normalizeDbError(error) };
    }
    return { success: true, data: undefined };
  }

  static async listBlocksBySession(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherBlock[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("block_index", { ascending: true });
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherBlock[] };
  }

  static async listLinesByBlock(
    supabase: SupabaseClient,
    blockId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherLine[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_lines")
      .select("*")
      .eq("block_id", blockId)
      .eq("organization_id", orgId)
      .order("line_number", { ascending: true });
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherLine[] };
  }

  // -------------------------------------------------------------------------
  // Block matches
  // -------------------------------------------------------------------------

  static async clearSessionMatches(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<void>> {
    // Deleting block matches cascades to line matches via FK ON DELETE CASCADE
    const { error } = await supabase
      .from("wdd_matcher_block_matches")
      .delete()
      .eq("session_id", sessionId)
      .eq("organization_id", orgId);
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: undefined };
  }

  static async insertBlockMatches(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string,
    matches: BlockMatchInsertInput[]
  ): Promise<ServiceResult<WddMatcherBlockMatch[]>> {
    if (matches.length === 0) return { success: true, data: [] };

    const rows = matches.map((m) => ({
      session_id: sessionId,
      organization_id: orgId,
      bc_block_id: m.bcBlockId,
      brand_block_id: m.brandBlockId,
      wdd_block_id: m.wddBlockId,
      block_match_type: m.blockMatchType,
      block_confidence: m.blockConfidence,
      block_match_reasons: m.blockMatchReasons,
      review_status: m.reviewStatus,
    }));

    const { data, error } = await supabase
      .from("wdd_matcher_block_matches")
      .insert(rows)
      .select("*");
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherBlockMatch[] };
  }

  static async listBlockMatches(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherBlockMatch[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_block_matches")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherBlockMatch[] };
  }

  static async updateBlockMatchReview(
    supabase: SupabaseClient,
    blockMatchId: string,
    orgId: string,
    status: ReviewStatus,
    notes: string | undefined,
    userId: string
  ): Promise<ServiceResult<WddMatcherBlockMatch>> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wdd_matcher_block_matches")
      .update({
        review_status: status,
        reviewer_notes: notes ?? null,
        reviewed_by: userId,
        reviewed_at: now,
      })
      .eq("id", blockMatchId)
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherBlockMatch };
  }

  // -------------------------------------------------------------------------
  // Line matches
  // -------------------------------------------------------------------------

  static async insertLineMatches(
    supabase: SupabaseClient,
    blockMatchId: string,
    sessionId: string,
    orgId: string,
    matches: Omit<LineMatchInsertInput, "blockMatchId">[]
  ): Promise<ServiceResult<WddMatcherLineMatch[]>> {
    if (matches.length === 0) return { success: true, data: [] };

    const rows = matches.map((m) => ({
      block_match_id: blockMatchId,
      session_id: sessionId,
      organization_id: orgId,
      bc_line_id: m.bcLineId,
      brand_line_id: m.brandLineId,
      wdd_line_id: m.wddLineId,
      line_match_type: m.lineMatchType,
      line_confidence: m.lineConfidence,
      line_match_reasons: m.lineMatchReasons,
      discrepancies: m.discrepancies,
      review_status: m.reviewStatus,
    }));

    const { data, error } = await supabase
      .from("wdd_matcher_line_matches")
      .insert(rows)
      .select("*");
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherLineMatch[] };
  }

  static async listLineMatches(
    supabase: SupabaseClient,
    blockMatchId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatcherLineMatch[]>> {
    const { data, error } = await supabase
      .from("wdd_matcher_line_matches")
      .select("*")
      .eq("block_match_id", blockMatchId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: (data ?? []) as WddMatcherLineMatch[] };
  }

  static async updateLineMatchReview(
    supabase: SupabaseClient,
    lineMatchId: string,
    orgId: string,
    status: ReviewStatus,
    notes: string | undefined,
    userId: string
  ): Promise<ServiceResult<WddMatcherLineMatch>> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wdd_matcher_line_matches")
      .update({
        review_status: status,
        reviewer_notes: notes ?? null,
        reviewed_by: userId,
        reviewed_at: now,
      })
      .eq("id", lineMatchId)
      .eq("organization_id", orgId)
      .select("*")
      .single();
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: data as WddMatcherLineMatch };
  }

  static async bulkApproveExactLines(
    supabase: SupabaseClient,
    blockMatchId: string,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<{ count: number }>> {
    const now = new Date().toISOString();
    const { data, error } = await supabase
      .from("wdd_matcher_line_matches")
      .update({ review_status: "approved", reviewed_by: userId, reviewed_at: now })
      .eq("block_match_id", blockMatchId)
      .eq("organization_id", orgId)
      .eq("line_match_type", "exact")
      .eq("review_status", "pending")
      .select("id");
    if (error) return { success: false, error: normalizeDbError(error) };
    return { success: true, data: { count: (data ?? []).length } };
  }

  // -------------------------------------------------------------------------
  // Export
  // -------------------------------------------------------------------------

  // -------------------------------------------------------------------------
  // Extraction data — full parsed structure for the extraction-review step
  // -------------------------------------------------------------------------

  static async getSessionExtractedData(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<ExtractedFileData[]>> {
    const [filesResult, blocksResult] = await Promise.all([
      WddMatcherService.listSessionFiles(supabase, sessionId, orgId),
      WddMatcherService.listBlocksBySession(supabase, sessionId, orgId),
    ]);
    if (!filesResult.success)
      return { success: false, error: (filesResult as { success: false; error: string }).error };
    if (!blocksResult.success)
      return { success: false, error: (blocksResult as { success: false; error: string }).error };

    const nonExcludedBlockIds = blocksResult.data.filter((b) => !b.is_excluded).map((b) => b.id);

    let allLines: WddMatcherLine[] = [];
    if (nonExcludedBlockIds.length > 0) {
      const { data, error } = await supabase
        .from("wdd_matcher_lines")
        .select("*")
        .in("block_id", nonExcludedBlockIds)
        .eq("organization_id", orgId)
        .order("line_number", { ascending: true });
      if (error) return { success: false, error: normalizeDbError(error) };
      allLines = (data ?? []) as WddMatcherLine[];
    }

    const linesByBlockId = new Map<string, WddMatcherLine[]>();
    for (const line of allLines) {
      const arr = linesByBlockId.get(line.block_id) ?? [];
      arr.push(line);
      linesByBlockId.set(line.block_id, arr);
    }

    const blocksByFileId = new Map<string, WddMatcherBlock[]>();
    for (const block of blocksResult.data) {
      const arr = blocksByFileId.get(block.session_file_id) ?? [];
      arr.push(block);
      blocksByFileId.set(block.session_file_id, arr);
    }

    const result: ExtractedFileData[] = filesResult.data.map((file) => ({
      file,
      blocks: (blocksByFileId.get(file.id) ?? []).map((block) => ({
        block,
        lines: linesByBlockId.get(block.id) ?? [],
      })),
    }));

    return { success: true, data: result };
  }

  // -------------------------------------------------------------------------
  // Session results — simplified view for the redesigned UI
  // -------------------------------------------------------------------------

  static async getSessionResults(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<WddMatchResultEntry[]>> {
    // Load all block matches
    const { data: matches, error: bmError } = await supabase
      .from("wdd_matcher_block_matches")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (bmError) return { success: false, error: normalizeDbError(bmError) };

    // Load all blocks for the session
    const { data: blocks, error: bError } = await supabase
      .from("wdd_matcher_blocks")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId);
    if (bError) return { success: false, error: normalizeDbError(bError) };

    // Load all session files for brand labels
    const { data: files, error: fError } = await supabase
      .from("wdd_matcher_session_files")
      .select("id, brand_label")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId);
    if (fError) return { success: false, error: normalizeDbError(fError) };

    const blockMap = new Map((blocks ?? []).map((b) => [b.id as string, b]));
    const fileMap = new Map((files ?? []).map((f) => [f.id as string, f]));

    const results: WddMatchResultEntry[] = [];

    for (const bm of matches ?? []) {
      // Only include rows that have a WDD (bc) block
      const wddBlock = bm.bc_block_id ? blockMap.get(bm.bc_block_id as string) : undefined;
      if (!wddBlock) continue;

      const wddMeta = (wddBlock.metadata ?? {}) as Record<string, unknown>;
      const orderBlock = bm.brand_block_id ? blockMap.get(bm.brand_block_id as string) : undefined;

      let orderEntry: WddMatchResultEntry["order"] = null;
      if (orderBlock) {
        const orderMeta = (orderBlock.metadata ?? {}) as Record<string, unknown>;
        const orderFile = fileMap.get(orderBlock.session_file_id as string);
        orderEntry = {
          blockId: orderBlock.id as string,
          headerText: (orderBlock.block_header_text as string) ?? null,
          orderNumber: (orderMeta.order_number as string) ?? null,
          zlNumber: (orderMeta.zl_number as string) ?? null,
          zwNumber: (orderMeta.zw_number as string) ?? null,
          clientName: (orderMeta.client_name as string) ?? null,
          brandLabel: (orderFile?.brand_label as string) ?? null,
          partsCount: (orderMeta.parts_count as number) ?? 0,
        };
      }

      results.push({
        wdd: {
          blockId: wddBlock.id as string,
          headerText: (wddBlock.block_header_text as string) ?? null,
          wddNumber: (wddMeta.wdd_number as string) ?? null,
          groupName: (wddMeta.group_name as string) ?? null,
          partsCount: (wddMeta.parts_count as number) ?? 0,
          pageNumber: (wddBlock.page_number as number) ?? null,
        },
        matchType: bm.block_match_type as BlockMatchType,
        confidence: (bm.block_confidence as number) ?? 0,
        order: orderEntry,
      });
    }

    return { success: true, data: results };
  }

  static async getEnhancedPdfData(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<PdfBlockData[]>> {
    // Fetch matches + all blocks in parallel
    const [matchesRes, blocksRes] = await Promise.all([
      supabase
        .from("wdd_matcher_block_matches")
        .select("*")
        .eq("session_id", sessionId)
        .eq("organization_id", orgId),
      supabase
        .from("wdd_matcher_blocks")
        .select("*")
        .eq("session_id", sessionId)
        .eq("organization_id", orgId),
    ]);
    if (matchesRes.error) return { success: false, error: normalizeDbError(matchesRes.error) };
    if (blocksRes.error) return { success: false, error: normalizeDbError(blocksRes.error) };

    const blockMap = new Map((blocksRes.data ?? []).map((b) => [b.id as string, b]));

    // Identify direct_order blocks and WDD bc_block_ids that appear in matches
    const directBlocks = (blocksRes.data ?? []).filter(
      (b) => b.block_type === "direct_order" && !b.is_excluded
    );
    const wddBlockIds = (matchesRes.data ?? [])
      .filter((bm) => bm.bc_block_id)
      .map((bm) => bm.bc_block_id as string);

    // Fetch lines for all relevant blocks in one query
    const allBlockIds = [...new Set([...wddBlockIds, ...directBlocks.map((b) => b.id as string)])];
    const linesRes =
      allBlockIds.length > 0
        ? await supabase
            .from("wdd_matcher_lines")
            .select("*")
            .in("block_id", allBlockIds)
            .eq("organization_id", orgId)
            .order("line_number", { ascending: true })
        : { data: [], error: null };
    if (linesRes.error) return { success: false, error: normalizeDbError(linesRes.error) };

    const linesByBlock = new Map<string, WddMatcherLine[]>();
    for (const line of linesRes.data ?? []) {
      const arr = linesByBlock.get(line.block_id as string) ?? [];
      arr.push(line as WddMatcherLine);
      linesByBlock.set(line.block_id as string, arr);
    }

    const toLines = (blockId: string): PdfLineData[] =>
      (linesByBlock.get(blockId) ?? []).map((l) => {
        const meta = (l.metadata ?? {}) as Record<string, unknown>;
        return {
          lp: typeof meta.lp === "number" ? meta.lp : l.line_number,
          productCode: l.product_code,
          productName: l.product_name,
          iz: typeof meta.iz === "number" ? meta.iz : null,
          iw: typeof meta.iw === "number" ? meta.iw : null,
          ir: typeof meta.ir === "number" ? meta.ir : null,
          inz: typeof meta.inz === "number" ? meta.inz : null,
          location: l.location,
          quantity: l.quantity,
          idpRaw: typeof meta.idp_raw === "string" ? meta.idp_raw : null,
          unit: l.unit,
          operationCode: typeof meta.operation_code === "string" ? meta.operation_code : null,
        };
      });

    // ── Direct order blocks (no matching needed — metadata is self-contained) ──
    const directPdfBlocks: PdfBlockData[] = directBlocks.map((b) => {
      const m = (b.metadata ?? {}) as Record<string, unknown>;
      return {
        isDirect: true,
        headerText: (b.block_header_text as string) ?? null,
        wddNumber: (m.wdd_number as string) ?? null,
        groupName: (m.group_name as string) ?? null,
        orderNumber: (m.order_number as string) ?? null,
        zlNumber: (m.zl_number as string) ?? null,
        zwNumber: (m.zw_number as string) ?? null,
        clientName: (m.client_name as string) ?? null,
        manualNote: (m.manual_note as string) ?? null,
        vin: (m.vin as string) ?? null,
        warehouseCode: (m.warehouse_code as string) ?? null,
        warehouseLabel: (m.warehouse_section_label as string) ?? null,
        documentBrand: (m.document_brand as string) ?? null,
        matchType: "unmatched_bc" as BlockMatchType,
        confidence: 0,
        lines: toLines(b.id as string),
      };
    });

    // ── Matched WDD blocks ────────────────────────────────────────────────────
    const wddPdfBlocks: PdfBlockData[] = [];
    for (const bm of matchesRes.data ?? []) {
      if (!bm.bc_block_id) continue;
      const wddBlock = blockMap.get(bm.bc_block_id as string);
      if (!wddBlock || wddBlock.block_type !== "wdd_reconciliation") continue;

      const wddMeta = (wddBlock.metadata ?? {}) as Record<string, unknown>;
      const orderBlock = bm.brand_block_id ? blockMap.get(bm.brand_block_id as string) : null;
      const orderMeta = orderBlock ? ((orderBlock.metadata ?? {}) as Record<string, unknown>) : {};

      wddPdfBlocks.push({
        isDirect: false,
        headerText: (wddBlock.block_header_text as string) ?? null,
        wddNumber: (wddMeta.wdd_number as string) ?? null,
        groupName: (wddMeta.group_name as string) ?? null,
        orderNumber: (orderMeta.order_number as string) ?? null,
        zlNumber: (orderMeta.zl_number as string) ?? null,
        zwNumber: (orderMeta.zw_number as string) ?? null,
        clientName: (orderMeta.client_name as string) ?? null,
        manualNote: (orderMeta.manual_note as string) ?? null,
        vin: (orderMeta.vin as string) ?? null,
        warehouseCode:
          (orderMeta.warehouse_code as string) ?? (wddMeta.warehouse_code as string) ?? null,
        warehouseLabel:
          (orderMeta.warehouse_section_label as string) ??
          (wddMeta.warehouse_section_label as string) ??
          null,
        documentBrand:
          (orderMeta.document_brand as string) ?? (wddMeta.document_brand as string) ?? null,
        matchType: bm.block_match_type as BlockMatchType,
        confidence: (bm.block_confidence as number) ?? 0,
        lines: toLines(bm.bc_block_id as string),
      });
    }

    // Sort WDD blocks by the numeric part of wdd_number ascending ("WDD/875/..." → 875)
    wddPdfBlocks.sort((a, b) => {
      const num = (s: string | null) => {
        if (!s) return Infinity;
        const m = s.match(/\/(\d+)/);
        return m ? parseInt(m[1], 10) : Infinity;
      };
      return num(a.wddNumber) - num(b.wddNumber);
    });

    // Direct orders first, then sorted WDD blocks
    return { success: true, data: [...directPdfBlocks, ...wddPdfBlocks] };
  }

  static async getExportRows(
    supabase: SupabaseClient,
    sessionId: string,
    orgId: string
  ): Promise<ServiceResult<ExportRow[]>> {
    // Fetch all data in parallel — session, block matches, blocks, files
    const [sessionResult, bmResult, blocksResult, filesResult] = await Promise.all([
      WddMatcherService.getSession(supabase, sessionId, orgId),
      WddMatcherService.listBlockMatches(supabase, sessionId, orgId),
      WddMatcherService.listBlocksBySession(supabase, sessionId, orgId),
      WddMatcherService.listSessionFiles(supabase, sessionId, orgId),
    ]);

    if (!sessionResult.success)
      return { success: false, error: (sessionResult as { success: false; error: string }).error };
    const session = sessionResult.data;
    if (!session) return { success: false, error: "Session not found" };
    if (!bmResult.success)
      return { success: false, error: (bmResult as { success: false; error: string }).error };
    if (!blocksResult.success)
      return { success: false, error: (blocksResult as { success: false; error: string }).error };
    if (!filesResult.success)
      return { success: false, error: (filesResult as { success: false; error: string }).error };

    const blockMap = new Map(blocksResult.data.map((b) => [b.id, b]));
    const fileMap = new Map(filesResult.data.map((f) => [f.id, f]));
    const blockFileMap = new Map(blocksResult.data.map((b) => [b.id, b.session_file_id]));

    // Fetch all line matches for the session in one query
    const { data: allLineMatches, error: lmError } = await supabase
      .from("wdd_matcher_line_matches")
      .select("*")
      .eq("session_id", sessionId)
      .eq("organization_id", orgId)
      .order("created_at", { ascending: true });
    if (lmError) return { success: false, error: normalizeDbError(lmError) };

    // Collect all referenced line IDs, then fetch all lines in one query
    const lineIds = new Set<string>();
    for (const lm of allLineMatches ?? []) {
      if (lm.bc_line_id) lineIds.add(lm.bc_line_id);
      if (lm.brand_line_id) lineIds.add(lm.brand_line_id);
      if (lm.wdd_line_id) lineIds.add(lm.wdd_line_id);
    }

    let lineMap = new Map<string, WddMatcherLine>();
    if (lineIds.size > 0) {
      const { data: allLines, error: linesError } = await supabase
        .from("wdd_matcher_lines")
        .select("*")
        .in("id", [...lineIds])
        .eq("organization_id", orgId);
      if (linesError) return { success: false, error: normalizeDbError(linesError) };
      lineMap = new Map((allLines ?? []).map((l) => [l.id, l as WddMatcherLine]));
    }

    // Group line matches by block_match_id for O(1) lookup
    const lmByBlockMatch = new Map<string, WddMatcherLineMatch[]>();
    for (const lm of allLineMatches ?? []) {
      const arr = lmByBlockMatch.get(lm.block_match_id) ?? [];
      arr.push(lm as WddMatcherLineMatch);
      lmByBlockMatch.set(lm.block_match_id, arr);
    }

    const rows: ExportRow[] = [];

    for (const bm of bmResult.data) {
      const bcBlock = bm.bc_block_id ? blockMap.get(bm.bc_block_id) : undefined;
      const brandBlock = bm.brand_block_id ? blockMap.get(bm.brand_block_id) : undefined;
      const bcFileId = bm.bc_block_id ? blockFileMap.get(bm.bc_block_id) : undefined;
      const brandFileId = bm.brand_block_id ? blockFileMap.get(bm.brand_block_id) : undefined;
      const bcFile = bcFileId ? fileMap.get(bcFileId) : undefined;
      const brandFile = brandFileId ? fileMap.get(brandFileId) : undefined;

      const lineMatches = lmByBlockMatch.get(bm.id) ?? [];

      if (lineMatches.length === 0) {
        rows.push(
          buildExportRow(
            session,
            bm,
            bcBlock,
            brandBlock,
            bcFile,
            brandFile,
            null,
            null,
            null,
            blockMap
          )
        );
        continue;
      }

      for (const lm of lineMatches) {
        const bcLine = lm.bc_line_id ? (lineMap.get(lm.bc_line_id) ?? null) : null;
        const brandLine = lm.brand_line_id ? (lineMap.get(lm.brand_line_id) ?? null) : null;
        const wddLine = lm.wdd_line_id ? (lineMap.get(lm.wdd_line_id) ?? null) : null;
        rows.push(
          buildExportRow(
            session,
            bm,
            bcBlock,
            brandBlock,
            bcFile,
            brandFile,
            lm,
            bcLine,
            brandLine,
            blockMap,
            wddLine
          )
        );
      }
    }

    return { success: true, data: rows };
  }
}

// ---------------------------------------------------------------------------
// Export row builder helpers
// ---------------------------------------------------------------------------

function buildExportRow(
  session: WddMatcherSession,
  bm: WddMatcherBlockMatch,
  bcBlock: WddMatcherBlock | undefined,
  brandBlock: WddMatcherBlock | undefined,
  bcFile: WddMatcherSessionFile | undefined,
  brandFile: WddMatcherSessionFile | undefined,
  lm: WddMatcherLineMatch | null,
  bcLine: WddMatcherLine | null,
  brandLine: WddMatcherLine | null,
  _blockMap: Map<string, WddMatcherBlock>,
  wddLine?: WddMatcherLine | null
): ExportRow {
  const discrepancies = lm?.discrepancies ?? [];
  const discFields = discrepancies.map((d: { field: string }) => d.field).join(",");

  return {
    session_name: session.name,
    session_status: session.status,
    bc_file_name: bcFile?.file_name ?? "",
    brand_file_name: brandFile?.file_name ?? "",
    brand_file_label: brandFile?.brand_label ?? "",
    block_match_type: bm.block_match_type,
    block_confidence: bm.block_confidence,
    block_review_status: bm.review_status,
    bc_block_header: bcBlock?.block_header_text ?? "",
    bc_warehouse_section: bcBlock?.warehouse_section ?? "",
    brand_block_header: brandBlock?.block_header_text ?? "",
    brand_to_section: brandBlock?.to_section ?? "",
    line_match_type: lm?.line_match_type ?? "",
    line_confidence: lm?.line_confidence ?? 0,
    line_review_status: lm?.review_status ?? "",
    bc_product_code: bcLine?.product_code ?? "",
    bc_product_name: bcLine?.product_name ?? "",
    bc_quantity: bcLine?.quantity != null ? String(bcLine.quantity) : "",
    bc_unit: bcLine?.unit ?? "",
    brand_product_code: brandLine?.product_code ?? "",
    brand_product_name: brandLine?.product_name ?? "",
    brand_quantity: brandLine?.quantity != null ? String(brandLine.quantity) : "",
    brand_unit: brandLine?.unit ?? "",
    wdd_corroborated: wddLine ? "yes" : "no",
    wdd_product_code: wddLine?.product_code ?? "",
    wdd_quantity: wddLine?.quantity != null ? String(wddLine.quantity) : "",
    discrepancy_fields: discFields,
    discrepancy_detail: discrepancies.length > 0 ? JSON.stringify(discrepancies) : "",
    reviewer_notes: lm?.reviewer_notes ?? "",
  };
}
