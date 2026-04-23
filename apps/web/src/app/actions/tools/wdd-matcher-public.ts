"use server";

import type { BlockMatchType } from "@/lib/validations/wdd-matcher";
import { runWddEnrichment, toMatchSummary } from "@/lib/tools/svwms-wdd-matcher/matcher";
import type {
  ParseResultV4,
  ParsedBlockV4,
  ParsedLineV4,
} from "@/lib/tools/svwms-wdd-matcher/parser_v4";
import { parsePdfAutoV4 } from "@/lib/tools/svwms-wdd-matcher/parser_v4";
import type {
  ExtractedFileData,
  MatchSummary,
  PdfBlockData,
  PdfLineData,
  WddMatcherBlock,
  WddMatcherLine,
  WddMatcherSessionFile,
  WddMatchResultEntry,
} from "@/server/services/wdd-matcher.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

export interface PublicWddMatcherResult {
  sessionName: string;
  extractedFiles: ExtractedFileData[];
  results: WddMatchResultEntry[];
  pdfBlocks: PdfBlockData[];
  summary: MatchSummary;
}

function metadataString(metadata: Record<string, unknown>, key: string): string | null {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value : null;
}

function nowIso(): string {
  return new Date().toISOString();
}

function toFileRecord(args: {
  fileId: string;
  sessionId: string;
  file: File;
  parseResult: ParseResultV4;
}): WddMatcherSessionFile {
  return {
    id: args.fileId,
    session_id: args.sessionId,
    organization_id: "public",
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

function toBlockRecord(args: {
  blockId: string;
  fileId: string;
  sessionId: string;
  block: ParsedBlockV4;
}): WddMatcherBlock {
  const metadata = {
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
  };

  return {
    id: args.blockId,
    session_file_id: args.fileId,
    session_id: args.sessionId,
    organization_id: "public",
    block_index: args.block.blockIndex,
    block_type: args.block.blockType,
    block_header_text: args.block.header,
    warehouse_section: args.block.warehouseSection,
    brand_label: args.block.warehouseFamilyAlias,
    from_section: null,
    to_section: null,
    is_excluded: false,
    page_number: args.block.pageNumber,
    metadata,
    created_at: nowIso(),
  };
}

function toLineRecord(args: {
  lineId: string;
  blockId: string;
  sessionId: string;
  line: ParsedLineV4;
}): WddMatcherLine {
  return {
    id: args.lineId,
    block_id: args.blockId,
    session_id: args.sessionId,
    organization_id: "public",
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
      quantity_signed: args.line.quantitySigned,
      idp_raw: args.line.idpRaw,
      movement_direction: args.line.movementDirection,
      operation_code: args.line.operationCode,
      line_validation: args.line.lineValidation,
      warnings: args.line.warnings,
    },
    created_at: nowIso(),
  };
}

function buildResultEntries(
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

  const toPdfLines = (blockId: string): PdfLineData[] =>
    (linesByBlockId.get(blockId) ?? []).map((line) => ({
      productCode: line.product_code,
      productName: line.product_name,
      quantity: line.quantity,
      unit: line.unit,
    }));

  const directPdfBlocks: PdfBlockData[] = blocks
    .filter((block) => block.block_type === "direct_order" && !block.is_excluded)
    .map((block) => {
      const metadata = block.metadata;
      return {
        isDirect: true,
        wddNumber: null,
        groupName: null,
        orderNumber: metadataString(metadata, "order_number"),
        zlNumber: metadataString(metadata, "zl_number"),
        zwNumber: metadataString(metadata, "zw_number"),
        clientName: metadataString(metadata, "client_name"),
        vin: metadataString(metadata, "vin"),
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
        wddNumber: metadataString(wddMeta, "wdd_number"),
        groupName: metadataString(wddMeta, "group_name"),
        orderNumber: metadataString(orderMeta, "order_number"),
        zlNumber: metadataString(orderMeta, "zl_number"),
        zwNumber: metadataString(orderMeta, "zw_number"),
        clientName: metadataString(orderMeta, "client_name"),
        vin: metadataString(orderMeta, "vin"),
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

export async function runPublicWddMatcherAction(
  formData: FormData
): Promise<ActionResult<PublicWddMatcherResult>> {
  try {
    const files = formData.getAll("files").filter((item): item is File => item instanceof File);
    if (!files.length) return { success: false, error: "No files provided" };
    if (files.some((file) => file.type !== "application/pdf")) {
      return { success: false, error: "Only PDF files are accepted" };
    }

    const sessionId = `public-${Date.now()}`;
    const allBlocks: WddMatcherBlock[] = [];
    const linesByBlockId = new Map<string, WddMatcherLine[]>();
    const extractedFiles: ExtractedFileData[] = [];

    for (let fileIndex = 0; fileIndex < files.length; fileIndex += 1) {
      const file = files[fileIndex];
      const parseResult = await parsePdfAutoV4(await file.arrayBuffer());
      const fileId = `${sessionId}-file-${fileIndex}`;
      const fileRecord = toFileRecord({ fileId, sessionId, file, parseResult });
      const fileBlocks: ExtractedFileData["blocks"] = [];

      for (const parsedBlock of parseResult.blocks) {
        const blockId = `${fileId}-block-${parsedBlock.blockIndex}`;
        const block = toBlockRecord({ blockId, fileId, sessionId, block: parsedBlock });
        const lines = parsedBlock.lines.map((line) =>
          toLineRecord({
            lineId: `${blockId}-line-${line.lineNumber}`,
            blockId,
            sessionId,
            line,
          })
        );
        allBlocks.push(block);
        linesByBlockId.set(blockId, lines);
        fileBlocks.push({ block, lines });
      }

      extractedFiles.push({ file: fileRecord, blocks: fileBlocks });
    }

    const { results, pdfBlocks, summary } = buildResultEntries(allBlocks, linesByBlockId);
    const sessionName = `Public WDD ${new Date().toLocaleString("pl-PL", {
      dateStyle: "short",
      timeStyle: "short",
    })}`;

    return {
      success: true,
      data: {
        sessionName,
        extractedFiles,
        results,
        pdfBlocks,
        summary,
      },
    };
  } catch (error) {
    return { success: false, error: error instanceof Error ? error.message : "Unexpected error" };
  }
}
