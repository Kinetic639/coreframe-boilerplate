/**
 * SVWMS WDD Matcher — Block Template Parser V4
 *
 * Complete refactor of V3 with:
 * - Signed IDP extraction (handles "- 1,00" two-token form)
 * - Split document brand vs warehouse section fields
 * - Normalized + raw block headers
 * - Lossless per-row token storage (rawTokens, rawRowText)
 * - Validation layer (parserQuality, parserStatus)
 * - Layered architecture: Extraction → Structural → Semantic → Validation → Output
 */

// ─── Exported primitive types ────────────────────────────────────────────────

export interface TokenV4 {
  text: string;
  page: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  width: number;
  height: number;
}

export interface CellFragmentV4 {
  text: string;
  column: ColumnName;
  x0: number;
  x1: number;
  y: number;
  page: number;
}

export interface RawTokenV4 {
  text: string;
  x: number;
  y: number;
  column: ColumnName;
}

// ─── Semantic type aliases ────────────────────────────────────────────────────

/** Brand detected from dealer header text ("Dealer Seat", "Body Center", etc.) */
export type DocumentBrand = "Seat" | "VW" | "Skoda" | "BC" | "unknown";

/** Logical order family derived from section kind + warehouse code + source role */
export type LogicalOrderFamily = "wdd" | "mirror" | "bc_direct" | "standard";

/** Signed direction of the IDP value: positive = goods in, negative = correction */
export type MovementDirection = "in" | "correction";

/** Overall parse confidence level */
export type ParserStatus = "ok" | "warning" | "error";

// ─── Line-level output ────────────────────────────────────────────────────────

export interface ParsedLineV4 {
  lineNumber: number;
  lp: number | null;
  productCode: string | null;
  productName: string | null;
  /** Absolute quantity (= idpAbs); retained for backward-compat alias */
  quantity: number | null;
  unit: string | null;
  location: string | null;
  /** Structured column-delimited text: "lp=1 | code=... | name=... | ..." */
  rawText: string | null;
  /** Lossless space-joined tokens in reading order (for full provenance) */
  rawRowText: string;
  rawTokens: RawTokenV4[];
  rawNameFragments: string[];
  rawLocationFragments: string[];
  pageNumber: number | null;
  operationCode: string | null;
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  /** Raw IDP cell text before sign-aware parsing */
  idpRaw: string;
  /** Signed IDP value; negative = correction movement */
  idpValue: number | null;
  /** Absolute (unsigned) IDP value */
  idpAbs: number | null;
  movementDirection: MovementDirection | null;
  rawCells: CellFragmentV4[];
  nameSource: "name_zone" | "name_col_only" | "empty";
  warnings: string[];
}

// ─── Block-level output ───────────────────────────────────────────────────────

export interface ParsedBlockV4 {
  blockIndex: number;
  blockType: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source";
  sourceRole: "bc" | "brand";
  sectionKind: "wdd" | "zw" | "unknown";
  candidateKind: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source" | "mirror";
  isExcluded: false;
  /** Normalized header (leading ordinal prefix stripped from WDD headers) */
  header: string | null;
  /** Raw header before normalization */
  headerRaw: string | null;
  /** Same as header — normalized form */
  headerNormalized: string | null;
  /** Human warehouse label from Magazyn line or WAREHOUSE_MAP (backward compat) */
  warehouseSection: string | null;
  /** Numeric warehouse code e.g. "415" */
  warehouseCode: string | null;
  /** = warehouseCode (explicit alias) */
  warehouseSectionCode: string | null;
  /** Warehouse label extracted from Magazyn line (parenthetical) or WAREHOUSE_MAP */
  warehouseSectionLabel: string | null;
  /** Backward-compat alias for warehouseSectionLabel */
  brandLabel: string | null;
  /** Authoritative brand from dealer header text */
  documentBrand: DocumentBrand;
  /** Order family classification */
  logicalOrderFamily: LogicalOrderFamily;
  pageNumber: number | null;
  metadata: Record<string, unknown>;
  lines: ParsedLineV4[];
}

// ─── Document-level output ────────────────────────────────────────────────────

export interface ParserQuality {
  confidenceScore: number;
  detectedRows: number;
  totalCollectedTokens: number;
  totalAssignedTokens: number;
  unassignedRatio: number;
  correctionCount: number;
  incompleteRowCount: number;
  duplicateLpCount: number;
  lpGapCount: number;
  negativeIdpParseFailures: number;
  warnings: string[];
  stats: Record<string, number>;
}

export interface ParseResultV4 {
  detectedRole: "bc" | "brand";
  blocks: ParsedBlockV4[];
  parserQuality: ParserQuality;
  parserStatus: ParserStatus;
}

// ─── Internal types ───────────────────────────────────────────────────────────

interface VisualRow {
  page: number;
  y: number;
  tokens: TokenV4[];
  text: string;
}

interface ColumnBands {
  lp: [number, number];
  code: [number, number];
  name: [number, number];
  iz: [number, number];
  iw: [number, number];
  ir: [number, number];
  inz: [number, number];
  location: [number, number];
  idp: [number, number];
  op: [number, number];
}

type ColumnName = keyof ColumnBands | "unclassified";

interface BlockStart {
  idx: number;
  sectionKind: "wdd" | "zw";
  triggerText: string;
  markerValue: string;
}

interface Anchor {
  page: number;
  y: number;
  code: string;
}

interface RowBand {
  page: number;
  topY: number;
  bottomY: number;
}

interface RawTableRowV4 {
  codeText: string | null;
  lpText: string | null;
  nameFragments: string[];
  locationFragments: string[];
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  /** Raw IDP cell text (all tokens joined) — NOT yet parsed; preserves sign */
  idpRawText: string;
  opText: string | null;
  pageNumber: number | null;
  rawCells: CellFragmentV4[];
  nameSource: "name_zone" | "name_col_only" | "empty";
  warnings: string[];
}

interface RawTableResultV4 {
  rows: RawTableRowV4[];
  correctionCount: number;
  totalCollected: number;
  totalAssigned: number;
}

// ─── Constants ────────────────────────────────────────────────────────────────

const PRODUCT_CODE_RE = /^([0-9][0-9A-Z]{4,}|[A-Z]{1,4}[0-9][0-9A-Z]{3,})$/;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const WDD_NUMBER_RE = /\bWDD\/(\d+(?:\/\d+\/\d+)*)\b/i;
const ZW_NUMBER_RE = /\bZW\/(\d+(?:\/\d+\/\d+)*)\b/i;
const ZL_NUMBER_RE = /\b(ZLEC|ZL)\/([^\s]+)/i;
const BLWK_RE = /\bBLWK\/(\d+)\b/i;
const DECIMAL_RE = /-?\d{1,8}[,.]\d{1,6}/g;

const WAREHOUSE_MAP: Record<string, string> = {
  "115": "VW",
  "315": "Skoda",
  "415": "Mirror",
  "515": "Seat",
};

const DEFAULT_BANDS: ColumnBands = {
  lp: [18, 48],
  code: [48, 130],
  name: [130, 285],
  iz: [285, 322],
  iw: [322, 354],
  ir: [354, 390],
  inz: [390, 432],
  location: [432, 520],
  idp: [520, 562],
  op: [562, 900],
};

// ─── Layer 1: Utility functions ───────────────────────────────────────────────

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function isVin(value: string): boolean {
  return VIN_RE.test(value.trim().toUpperCase());
}

function isProductCode(value: string): boolean {
  const token = value.trim().toUpperCase();
  return PRODUCT_CODE_RE.test(token) && !isVin(token);
}

/** Matches decimal quantities ("0,00", "1.05", "-0,05") and bare sign characters. */
function isDecimalToken(text: string): boolean {
  const v = text.trim();
  return /^[-–+]?[\d]+[.,][\d]+$/.test(v) || /^[-–+]$/.test(v);
}

function extractLastDecimal(value: string): number | null {
  const matches = value.match(DECIMAL_RE);
  if (!matches?.length) return null;
  const raw = matches[matches.length - 1].replace(",", ".");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

function parseLp(text: string | null): number | null {
  if (!text) return null;
  const n = Number.parseInt(text.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}

function detectWarehouseSection(text: string): string | null {
  const match = text.match(/\b(115|315|415|515)\b/);
  return match ? match[1] : null;
}

function warehouseToBrand(section: string | null): string | null {
  return section ? (WAREHOUSE_MAP[section] ?? null) : null;
}

// ─── Layer 2: Structural classifiers ─────────────────────────────────────────

function isPageFooterRow(text: string): boolean {
  return /^Strona\b/i.test(text);
}

function isDateStampRow(text: string): boolean {
  return /^[A-Z]\d{3,4}\s*-\s*\d{2}\.\d{2}\.\d{4}/i.test(text);
}

function isTableHeaderRow(text: string): boolean {
  return /\bNr\s*katalogowy\b/i.test(text) || /\bLp\b.*\bNr\s*katalogowy\b/i.test(text);
}

function isLegendRow(text: string): boolean {
  return (
    /^L\s*-\s*Stan realizacji/i.test(text) ||
    /^-\s*Brak towaru/i.test(text) ||
    /^-\s*Czesc zam[oó]wionego/i.test(text) ||
    /^-\s*Caly zam[oó]wiony/i.test(text) ||
    /^(IZ|IW|IR|ILI|ILG|INZ|IDP|IK|AP|ZR|ZL)\s*-\s*/i.test(text)
  );
}

function isTimestampLine(text: string): boolean {
  return /^[A-Z]\d{3,4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}/i.test(text);
}

function isWarehouseInfoRow(text: string): boolean {
  return (
    /^Dealer\b/i.test(text) ||
    /^Body\s*Center\b/i.test(text) ||
    /^Magazyn\b/i.test(text) ||
    /\bMagazyn\s+\d{3}\b/i.test(text)
  );
}

function isDepartmentCodeRow(text: string): boolean {
  return (
    /^(31\s+VWO|32\s+Seat|33\s+Skoda|31\s+Audi_BC)\b/i.test(text) ||
    /^\d{2}\s+[A-Z_]{3,}$/i.test(text)
  );
}

function isBlockTitleLine(text: string): boolean {
  return (
    /^2\.\s*Zam[oó]wienie/i.test(text) ||
    /^99\.\s*Zam[oó]wienie/i.test(text) ||
    /^Blacharnia\s+D\d+\b/i.test(text)
  );
}

function isVinZwHeaderRow(text: string): boolean {
  return (
    ZW_NUMBER_RE.test(text) ||
    WDD_NUMBER_RE.test(text) ||
    (VIN_RE.test(text) && ZL_NUMBER_RE.test(text))
  );
}

function isStructuralHeaderRow(text: string): boolean {
  return (
    /^99\.\s*Zam[oó]wienie\s+WDD/i.test(text) ||
    /^2\.\s*Zam[oó]wienie/i.test(text) ||
    /^Wysylka\//i.test(text) ||
    /^Telefony\s*:/i.test(text) ||
    /^(Body\s*Center|Dealer|Magazyn)\b/i.test(text) ||
    /^Audi_BC$/i.test(text) ||
    /^31\s+Audi_BC$/i.test(text) ||
    /^31\s+VWO$/i.test(text) ||
    /^32\s+Seat$/i.test(text) ||
    /^33\s+Skoda$/i.test(text) ||
    /^BRA_SKO\b/i.test(text) ||
    /^WAJ_SEA\b/i.test(text) ||
    // Note: ^VGP\b intentionally omitted — VGP is a client org abbreviation
    /^NIE ZMIENIAC\b/i.test(text) ||
    isDateStampRow(text) ||
    isPageFooterRow(text) ||
    isLegendRow(text)
  );
}

function isLikelyClientLine(text: string): boolean {
  if (text.length < 3) return false;
  if (isStructuralHeaderRow(text)) return false;
  if (isTableHeaderRow(text)) return false;
  if (isTimestampLine(text)) return false;
  if (isWarehouseInfoRow(text)) return false;
  if (isDepartmentCodeRow(text)) return false;
  if (isBlockTitleLine(text)) return false;
  if (WDD_NUMBER_RE.test(text) || ZW_NUMBER_RE.test(text) || BLWK_RE.test(text)) return false;
  if (ZL_NUMBER_RE.test(text) || VIN_RE.test(text)) return false;
  if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{3,}/.test(text)) return false;
  return true;
}

function cleanGroupName(text: string): string | null {
  const normalized = normalizeText(text)
    .replace(/\s*-\s*NIE ZMIENIAC.*$/i, "")
    .replace(/\(\d+\)\s*$/i, "")
    .trim();
  return normalized || null;
}

// ─── Layer 3: Semantic functions (V4-new) ─────────────────────────────────────

/**
 * Parse the raw IDP cell text with sign preservation.
 * Handles the two-token PDF form "- 1,00" (sign token + digit token joined by space)
 * as well as the single-token form "-1,00".
 */
function extractSignedIdp(raw: string): {
  raw: string;
  value: number | null;
  abs: number | null;
} {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: trimmed, value: null, abs: null };

  // Two-token form: "- 1,00" or "– 1,00" (sign separated from digits by whitespace)
  const splitMatch = trimmed.match(/^([-–+])\s+([\d]+[,.][\d]+)$/);
  if (splitMatch) {
    const sign = splitMatch[1] === "+" ? 1 : -1;
    const absVal = Number.parseFloat(splitMatch[2].replace(",", "."));
    if (Number.isFinite(absVal)) {
      return { raw: trimmed, value: sign * absVal, abs: absVal };
    }
  }

  // Single-token form: "-1,00" or "+1,00" or "1,00"
  const directMatch = trimmed.match(/^([-–+]?)([\d]+[,.][\d]+)$/);
  if (directMatch) {
    const sign = directMatch[1] === "-" || directMatch[1] === "–" ? -1 : 1;
    const absVal = Number.parseFloat(directMatch[2].replace(",", "."));
    if (Number.isFinite(absVal)) {
      return { raw: trimmed, value: sign * absVal, abs: absVal };
    }
  }

  // Multi-value fallback: use last decimal, preserve sign if a standalone "-" precedes it
  const decimalMatches = trimmed.match(DECIMAL_RE);
  if (decimalMatches?.length) {
    const lastDecStr = decimalMatches[decimalMatches.length - 1];
    const parsed = Number.parseFloat(lastDecStr.replace(",", "."));
    if (Number.isFinite(parsed)) {
      const beforeDec = trimmed.substring(0, trimmed.lastIndexOf(lastDecStr));
      const hasLeadingMinus =
        /[-–]/.test(beforeDec) && !decimalMatches.some((m) => m.startsWith("-"));
      const value = hasLeadingMinus && parsed >= 0 ? -parsed : parsed;
      return { raw: trimmed, value, abs: Math.abs(value) };
    }
  }

  return { raw: trimmed, value: null, abs: null };
}

function computeMovementDirection(idpValue: number | null): MovementDirection | null {
  if (idpValue === null) return null;
  return idpValue < 0 ? "correction" : "in";
}

/**
 * Detect the authoritative document brand from the first 20 header rows.
 * Scans for "Dealer Seat", "Dealer VW", "Dealer Skoda", "Body Center" patterns.
 */
function detectDocumentBrand(rows: VisualRow[]): DocumentBrand {
  for (const row of rows.slice(0, 20)) {
    if (/Dealer\s+Seat/i.test(row.text)) return "Seat";
    if (/Dealer\s+VW/i.test(row.text)) return "VW";
    if (/Dealer\s+Skoda/i.test(row.text)) return "Skoda";
    if (/Body\s*Center/i.test(row.text)) return "BC";
  }
  return "unknown";
}

/**
 * Extract numeric warehouse code and human label from a "Magazyn N (label)" line.
 * Falls back to WAREHOUSE_MAP if only the code number is found.
 */
function extractWarehouseSectionInfo(rows: VisualRow[]): {
  code: string | null;
  label: string | null;
} {
  for (const row of rows) {
    const full = row.text.match(/Magazyn\s+(\d+)\s*\(([^)]+)\)/i);
    if (full) return { code: full[1], label: full[2].trim().toLowerCase() };
    const codeOnly = row.text.match(/Magazyn\s+(\d{3})\b/i);
    if (codeOnly) {
      return {
        code: codeOnly[1],
        label: WAREHOUSE_MAP[codeOnly[1]] ?? null,
      };
    }
    for (const token of row.tokens) {
      const code = detectWarehouseSection(token.text);
      if (code) return { code, label: WAREHOUSE_MAP[code] ?? null };
    }
  }
  return { code: null, label: null };
}

function computeLogicalOrderFamily(
  sectionKind: "wdd" | "zw" | "unknown",
  warehouseCode: string | null,
  sourceRole: "bc" | "brand"
): LogicalOrderFamily {
  if (sectionKind === "wdd") return "wdd";
  if (warehouseCode === "415") return "mirror";
  if (sourceRole === "bc") return "bc_direct";
  return "standard";
}

/**
 * Normalize a block header string:
 * strips leading ordinal prefix on WDD/ZW headers ("2 WDD/..." → "WDD/...").
 */
function normalizeBlockHeader(raw: string | null): string | null {
  if (!raw) return null;
  const normalized = raw.replace(/^\d+\.?\s+(?=WDD\/|ZW\/)/i, "").trim();
  return normalized || raw;
}

// ─── Layer 1: Token extraction ────────────────────────────────────────────────

async function extractTokens(buffer: ArrayBuffer): Promise<TokenV4[]> {
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const tokens: TokenV4[] = [];

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent({ disableNormalization: false });

    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const transform = item.transform as number[];
      const x0 = transform[4];
      const y1 = transform[5];
      const width = (item.width as number) ?? 0;
      const height = (item.height as number) ?? 10;
      tokens.push({
        text: item.str,
        page: pageNumber,
        x0,
        x1: x0 + width,
        y0: y1 - height,
        y1,
        width,
        height,
      });
    }
  }

  return tokens;
}

// ─── Layer 1: Row building ────────────────────────────────────────────────────

function buildRows(tokens: TokenV4[]): VisualRow[] {
  const buckets = new Map<string, TokenV4[]>();

  for (const token of tokens) {
    const yBucket = Math.round(token.y1 / 2) * 2;
    const key = `${token.page}:${yBucket}`;
    const items = buckets.get(key) ?? [];
    items.push(token);
    buckets.set(key, items);
  }

  const rows: VisualRow[] = [];

  for (const [key, bucketTokens] of buckets) {
    const sorted = bucketTokens.sort((a, b) => a.x0 - b.x0);
    const fragments: string[] = [];

    for (const token of sorted) {
      const value = token.text.trim();
      if (!value) continue;
      fragments.push(value);
    }

    const [pageText, yText] = key.split(":");
    const normalized = normalizeText(fragments.join(" "));
    if (!normalized) continue;

    rows.push({
      page: Number.parseInt(pageText, 10),
      y: Number.parseInt(yText, 10),
      tokens: sorted,
      text: normalized,
    });
  }

  rows.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y));
  return rows;
}

// ─── Layer 1: Band detection ──────────────────────────────────────────────────

function detectBandsFromHeaderRow(row: VisualRow): ColumnBands {
  const findToken = (matcher: RegExp) =>
    row.tokens.find((token) => matcher.test(token.text.trim()));

  const lp = findToken(/^Lp$/i) ?? findToken(/^L$/i);
  const nr = findToken(/^Nr$/i) ?? findToken(/^Nr\.$/i);
  const nazwa = findToken(/^Nazwa$/i) ?? findToken(/^Opis$/i);
  const iz = findToken(/^IZ$/i);
  const iw = findToken(/^IW$/i);
  const ir = findToken(/^IR$/i);
  const ili = findToken(/^ILI$/i);
  const inz = findToken(/^INZ$/i);
  const lok = findToken(/^Lokalizacja$/i);
  const idp = findToken(/^IDP$/i);
  const op = findToken(/^O$/i);

  const lpX = lp?.x0 ?? DEFAULT_BANDS.lp[0];
  const codeX = nr?.x0 ?? DEFAULT_BANDS.code[0];
  const nameX = nazwa?.x0 ?? DEFAULT_BANDS.name[0];
  const izX = iz?.x0 ?? DEFAULT_BANDS.iz[0];
  const iwX = iw?.x0 ?? DEFAULT_BANDS.iw[0];
  const irX = (ir ?? ili)?.x0 ?? DEFAULT_BANDS.ir[0];
  const inzX = inz?.x0 ?? DEFAULT_BANDS.inz[0];
  const locationX = lok?.x0 ?? DEFAULT_BANDS.location[0];
  const idpX = idp?.x0 ?? DEFAULT_BANDS.idp[0];
  const opX = op?.x0 ?? DEFAULT_BANDS.op[0];

  return {
    lp: [lpX - 4, codeX - 4],
    code: [codeX - 4, nameX - 8],
    name: [nameX - 8, izX - 6],
    iz: [izX - 6, iwX - 4],
    iw: [iwX - 4, irX - 4],
    ir: [irX - 4, inzX - 4],
    inz: [inzX - 4, locationX - 4],
    location: [locationX - 4, idpX - 4],
    idp: [idpX - 4, opX - 4],
    op: [opX - 4, 900],
  };
}

function detectBandsByPage(rows: VisualRow[]): Map<number, ColumnBands> {
  const result = new Map<number, ColumnBands>();
  for (const row of rows) {
    if (!result.has(row.page) && isTableHeaderRow(row.text)) {
      result.set(row.page, detectBandsFromHeaderRow(row));
    }
  }
  return result;
}

function bandsForPage(page: number, bandMap: Map<number, ColumnBands>): ColumnBands {
  if (bandMap.has(page)) return bandMap.get(page)!;
  if (bandMap.size === 0) return DEFAULT_BANDS;

  let best: ColumnBands = DEFAULT_BANDS;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (const [bandPage, bands] of bandMap.entries()) {
    const dist = Math.abs(bandPage - page);
    if (dist < bestDistance) {
      bestDistance = dist;
      best = bands;
    }
  }
  return best;
}

function assignColumn(token: TokenV4, bands: ColumnBands): ColumnName {
  const centerX = (token.x0 + token.x1) / 2;
  for (const column of Object.keys(bands) as (keyof ColumnBands)[]) {
    const [from, to] = bands[column];
    if (centerX >= from && centerX < to) return column;
  }
  return "unclassified";
}

// ─── Layer 2: Document structure detection ────────────────────────────────────

function detectRole(rows: VisualRow[]): "bc" | "brand" {
  const fullText = rows.map((row) => row.text).join("\n");
  const wddCount = (fullText.match(/WDD\/\d+/gi) ?? []).length;
  const zwCount = (fullText.match(/ZW\/\d+/gi) ?? []).length;

  if (wddCount > zwCount) return "bc";
  if (zwCount > wddCount) return "brand";
  if (/Body\s*Center/i.test(fullText)) return "bc";
  return "brand";
}

function findBlockStarts(rows: VisualRow[], role: "bc" | "brand"): BlockStart[] {
  const starts: BlockStart[] = [];

  for (let index = 0; index < rows.length; index += 1) {
    const row = rows[index];
    const wddMatch = row.text.match(WDD_NUMBER_RE);
    if (wddMatch) {
      const markerValue = `WDD/${wddMatch[1]}`;
      const last = starts[starts.length - 1];
      if (!last || last.markerValue !== markerValue || index - last.idx > 3) {
        starts.push({ idx: index, sectionKind: "wdd", triggerText: row.text, markerValue });
      }
      continue;
    }

    const zwMatch = row.text.match(ZW_NUMBER_RE);
    if (zwMatch) {
      const markerValue = `ZW/${zwMatch[1]}`;
      const last = starts[starts.length - 1];
      if (!last || last.markerValue !== markerValue || index - last.idx > 3) {
        starts.push({ idx: index, sectionKind: "zw", triggerText: row.text, markerValue });
      }
    }
  }

  return role === "brand" ? starts.filter((s) => s.sectionKind === "zw") : starts;
}

// ─── Layer 2: Block region helpers ───────────────────────────────────────────

function splitBlockRegions(blockRows: VisualRow[]): {
  headerRows: VisualRow[];
  tableHeaderRow: VisualRow | null;
  tableBodyRows: VisualRow[];
} {
  for (let idx = 0; idx < Math.min(blockRows.length, 30); idx += 1) {
    if (isTableHeaderRow(blockRows[idx].text)) {
      return {
        headerRows: blockRows.slice(0, idx),
        tableHeaderRow: blockRows[idx],
        tableBodyRows: blockRows.slice(idx + 1),
      };
    }
  }
  return { headerRows: blockRows, tableHeaderRow: null, tableBodyRows: [] };
}

/**
 * Find pre-header rows strictly bounded by the previous block's trigger row.
 */
function findPreHeaderRows(
  rows: VisualRow[],
  blockStartIdx: number,
  prevBlockStartIdx: number
): VisualRow[] {
  const lowerBound = prevBlockStartIdx + 1;
  let blwkIdx = -1;

  for (let i = blockStartIdx - 1; i >= lowerBound; i -= 1) {
    const text = rows[i].text;
    if (ZW_NUMBER_RE.test(text) || WDD_NUMBER_RE.test(text)) break;
    if (BLWK_RE.test(text)) {
      blwkIdx = i;
      break;
    }
  }

  if (blwkIdx < 0) return [];
  return rows.slice(blwkIdx, blockStartIdx);
}

/**
 * Build the deterministic header string for a block.
 * Checks both forward (lower y) and backward (higher y) neighbors for VIN+ZL.
 */
function buildBlockHeader(
  triggerRow: VisualRow,
  preHeaderRows: VisualRow[],
  postTriggerRows: VisualRow[]
): string {
  const text = triggerRow.text;
  if (VIN_RE.test(text) && ZL_NUMBER_RE.test(text)) return text;

  for (let i = 0; i < Math.min(4, postTriggerRows.length); i += 1) {
    const row = postTriggerRows[i];
    if (VIN_RE.test(row.text) || ZL_NUMBER_RE.test(row.text)) {
      return normalizeText(`${text} ${row.text}`);
    }
  }

  for (let i = preHeaderRows.length - 1; i >= Math.max(0, preHeaderRows.length - 3); i -= 1) {
    const pre = preHeaderRows[i];
    if (VIN_RE.test(pre.text) || ZL_NUMBER_RE.test(pre.text)) {
      return normalizeText(`${pre.text} ${text}`);
    }
  }

  return text;
}

// ─── Layer 2: Header metadata extractors ─────────────────────────────────────

function extractHeaderValue(rows: VisualRow[], matcher: RegExp): string | null {
  for (const row of rows) {
    const match = row.text.match(matcher);
    if (match) return match[0].toUpperCase();
  }
  return null;
}

function extractVin(rows: VisualRow[]): string | null {
  for (const row of rows) {
    const match = row.text.match(VIN_RE);
    if (match) return match[1].toUpperCase();
  }
  return null;
}

function extractWarehouse(rows: VisualRow[]): string | null {
  for (const row of rows) {
    const code = detectWarehouseSection(row.text);
    if (code) return code;
    for (const token of row.tokens) {
      const tokenCode = detectWarehouseSection(token.text);
      if (tokenCode) return tokenCode;
    }
  }
  return null;
}

function extractBlwk(rows: VisualRow[]): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const match = rows[index].text.match(BLWK_RE);
    if (match) return `BLWK/${match[1]}`;
  }
  return null;
}

function extractZl(rows: VisualRow[]): string | null {
  for (const row of rows) {
    const match = row.text.match(ZL_NUMBER_RE);
    if (match) return `${match[1].toUpperCase()}/${match[2]}`;
  }
  return null;
}

function extractGroupName(rows: VisualRow[]): string | null {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const text = rows[index].text;
    if (WDD_NUMBER_RE.test(text) || ZW_NUMBER_RE.test(text)) continue;
    if (isDateStampRow(text) || /^Wysylka\//i.test(text) || /^Telefony:/i.test(text)) continue;
    const cleaned = cleanGroupName(text);
    if (cleaned) return cleaned;
  }
  return null;
}

/**
 * Extract client name from block-local header rows, supporting multi-line names.
 */
function extractClientLineFromHeaderRows(headerRows: VisualRow[]): string | null {
  const parts: string[] = [];
  let collecting = false;

  for (const row of headerRows) {
    const text = row.text;
    if (text.length < 2) continue;

    if (isTableHeaderRow(text)) {
      if (collecting) break;
      continue;
    }
    if (isStructuralHeaderRow(text) || isTimestampLine(text)) {
      if (collecting) break;
      continue;
    }
    if (isWarehouseInfoRow(text) || isDepartmentCodeRow(text) || isBlockTitleLine(text)) {
      if (collecting) break;
      continue;
    }
    if (isVinZwHeaderRow(text) || ZL_NUMBER_RE.test(text) || VIN_RE.test(text)) {
      if (collecting) break;
      continue;
    }
    if (/^\d+$/.test(text.trim())) continue;

    if (BLWK_RE.test(text)) {
      const withoutBlwk = text.replace(BLWK_RE, "").trim();
      if (withoutBlwk.length >= 2 && /[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2,}/.test(withoutBlwk)) {
        parts.push(normalizeText(withoutBlwk));
        collecting = true;
      }
      continue;
    }

    if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]{2,}/.test(text)) continue;
    parts.push(normalizeText(text));
    collecting = true;
  }

  if (!parts.length) return null;
  return (
    normalizeText(parts.join(" "))
      .replace(/\s+Blacharnia\s+D\d+\b.*$/i, "")
      .replace(/\s+2\.\s*Zam[oó]wienie.*$/i, "")
      .trim() || null
  );
}

// ─── Layer 2: Table body parsing ──────────────────────────────────────────────

/**
 * Build raw table rows from already-sliced table body rows.
 * Returns structured result with stats for the validation layer.
 */
function buildRawTableRowsV4(
  tableBodyRows: VisualRow[],
  bandMap: Map<number, ColumnBands>
): RawTableResultV4 {
  const collected: Array<{
    token: TokenV4;
    page: number;
    y: number;
    column: ColumnName;
    corrected: boolean;
  }> = [];

  for (const row of tableBodyRows) {
    const text = row.text;
    if (!text) continue;
    if (isTableHeaderRow(text)) continue;
    // Hard stop: BLWK marks the next block's header — stop collecting to prevent spillover.
    if (BLWK_RE.test(text)) break;
    if (WDD_NUMBER_RE.test(text) || ZW_NUMBER_RE.test(text)) continue;
    if (isBlockTitleLine(text) || isTimestampLine(text)) continue;
    if (isStructuralHeaderRow(text)) continue;

    const bands = bandsForPage(row.page, bandMap);
    for (const token of row.tokens) {
      const value = token.text.trim();
      if (!value) continue;
      collected.push({
        token,
        page: row.page,
        y: token.y1,
        column: assignColumn(token, bands),
        corrected: false,
      });
    }
  }

  const totalCollected = collected.length;

  if (!collected.length) {
    return { rows: [], correctionCount: 0, totalCollected: 0, totalAssigned: 0 };
  }

  // Correction pass: non-decimal tokens in inz band past the midpoint are location codes
  // (e.g. "S8", "R15C", "NA") shifted by PDF rendering variance. Reassign to location.
  let correctionCount = 0;
  for (const entry of collected) {
    if (entry.column !== "inz") continue;
    const v = entry.token.text.trim();
    if (!v || isDecimalToken(v)) continue;
    const bands = bandsForPage(entry.page, bandMap);
    const inzMid = (bands.inz[0] + bands.inz[1]) / 2;
    if (entry.token.x0 >= inzMid) {
      entry.column = "location";
      entry.corrected = true;
      correctionCount += 1;
    }
  }

  // Anchor detection: product-code tokens define row boundaries
  const anchorBuckets = new Map<string, Anchor>();
  for (const entry of collected) {
    if (entry.column !== "code") continue;
    const code = entry.token.text.trim().toUpperCase();
    if (!isProductCode(code)) continue;
    const bucketY = Math.round(entry.y / 4) * 4;
    const key = `${entry.page}:${bucketY}`;
    if (!anchorBuckets.has(key)) {
      anchorBuckets.set(key, { page: entry.page, y: entry.y, code });
    }
  }

  const anchors = [...anchorBuckets.values()].sort((a, b) =>
    a.page !== b.page ? a.page - b.page : b.y - a.y
  );
  if (!anchors.length) {
    return { rows: [], correctionCount, totalCollected, totalAssigned: 0 };
  }

  const rowBands: RowBand[] = anchors.map((anchor, index) => {
    let previousY: number | null = null;
    for (let p = index - 1; p >= 0; p -= 1) {
      if (anchors[p].page === anchor.page) {
        previousY = anchors[p].y;
        break;
      }
    }
    let nextY: number | null = null;
    for (let p = index + 1; p < anchors.length; p += 1) {
      if (anchors[p].page === anchor.page) {
        nextY = anchors[p].y;
        break;
      }
    }
    return {
      page: anchor.page,
      topY: previousY == null ? anchor.y + 30 : (previousY + anchor.y) / 2,
      bottomY: nextY == null ? anchor.y - 30 : (anchor.y + nextY) / 2,
    };
  });

  const rowCells = anchors.map(() => new Map<ColumnName, TokenV4[]>());
  const rawCells = anchors.map(() => [] as CellFragmentV4[]);

  function findBandIndex(page: number, y: number): number {
    for (let i = 0; i < rowBands.length; i += 1) {
      const band = rowBands[i];
      if (band.page === page && y > band.bottomY && y <= band.topY) return i;
    }
    return -1;
  }

  const correctedBandIndices = new Set<number>();
  let totalAssigned = 0;

  for (const entry of collected) {
    const bandIndex = findBandIndex(entry.page, entry.y);
    if (bandIndex < 0) continue;
    totalAssigned += 1;
    const byColumn = rowCells[bandIndex];
    const items = byColumn.get(entry.column) ?? [];
    items.push(entry.token);
    byColumn.set(entry.column, items);
    rawCells[bandIndex].push({
      text: entry.token.text.trim(),
      column: entry.column,
      x0: entry.token.x0,
      x1: entry.token.x1,
      y: entry.y,
      page: entry.page,
    });
    if (entry.corrected) correctedBandIndices.add(bandIndex);
  }

  function sortCellTokens(tokens: TokenV4[]): TokenV4[] {
    return [...tokens].sort((a, b) => (Math.abs(b.y1 - a.y1) > 2 ? b.y1 - a.y1 : a.x0 - b.x0));
  }

  function cellText(cells: Map<ColumnName, TokenV4[]>, column: ColumnName): string {
    return normalizeText(
      sortCellTokens(cells.get(column) ?? [])
        .map((t) => t.text.trim())
        .join(" ")
    );
  }

  function dedupFragments(values: string[]): string[] {
    const output: string[] = [];
    for (const value of values) {
      if (!value) continue;
      if (output[output.length - 1] !== value) output.push(value);
    }
    return output;
  }

  // Name zone: code-band + name-band tokens (excluding product codes), sorted top→bottom, left→right.
  const NAME_ZONE_COLS = new Set<ColumnName>(["code", "name"]);
  const rows: RawTableRowV4[] = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const cells = rowCells[index];
    const codeToken = sortCellTokens(cells.get("code") ?? []).find((t) =>
      isProductCode(t.text.toUpperCase())
    );
    if (!codeToken) continue;

    const nameZoneCells = rawCells[index]
      .filter((cell) => {
        if (!NAME_ZONE_COLS.has(cell.column)) return false;
        const v = cell.text.trim();
        if (v.length === 0) return false;
        if (isProductCode(v.toUpperCase())) return false;
        return true;
      })
      .sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0));

    const nameFragments = dedupFragments(nameZoneCells.map((c) => c.text.trim()).filter(Boolean));
    const hasCodeBandInName = nameZoneCells.some((c) => c.column === "code");
    const nameSource: RawTableRowV4["nameSource"] =
      nameFragments.length === 0 ? "empty" : hasCodeBandInName ? "name_zone" : "name_col_only";

    const warnings: string[] = [];
    if (hasCodeBandInName) warnings.push("name_includes_code_band_tokens");
    if (correctedBandIndices.has(index)) warnings.push("location_corrected_from_inz");

    const locationFragments = dedupFragments(
      sortCellTokens(cells.get("location") ?? [])
        .map((t) => t.text.trim())
        .filter(Boolean)
    );

    // Store raw IDP cell text for sign-preserving semantic parsing
    const idpRawText = cellText(cells, "idp");

    rows.push({
      codeText: codeToken.text.trim().toUpperCase(),
      lpText: cellText(cells, "lp") || null,
      nameFragments,
      locationFragments,
      iz: extractLastDecimal(cellText(cells, "iz")),
      iw: extractLastDecimal(cellText(cells, "iw")),
      ir: extractLastDecimal(cellText(cells, "ir")),
      inz: extractLastDecimal(cellText(cells, "inz")),
      idpRawText,
      opText: cellText(cells, "op") || null,
      pageNumber: anchors[index].page,
      rawCells: rawCells[index],
      nameSource,
      warnings,
    });
  }

  return { rows, correctionCount, totalCollected, totalAssigned };
}

// ─── Layer 3: Semantic output assembly ───────────────────────────────────────

function buildParsedLinesV4(rawRows: RawTableRowV4[]): ParsedLineV4[] {
  return rawRows.map((row, index) => {
    // Build per-column text map from raw cells (top-to-bottom, left-to-right within line)
    const colMap = new Map<string, string[]>();
    const sortedCells = [...row.rawCells].sort((a, b) =>
      Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0
    );
    for (const cell of sortedCells) {
      const items = colMap.get(cell.column) ?? [];
      items.push(cell.text);
      colMap.set(cell.column, items);
    }
    const getCellText = (col: string) => (colMap.get(col) ?? []).join(" ");

    // Structured raw_text: column-delimited for unambiguous downstream parsing
    const rawText = [
      `lp=${getCellText("lp")}`,
      `code=${row.codeText ?? ""}`,
      `name=${row.nameFragments.join(" ")}`,
      `iz=${getCellText("iz")}`,
      `iw=${getCellText("iw")}`,
      `ir=${getCellText("ir")}`,
      `inz=${getCellText("inz")}`,
      `location=${row.locationFragments.join(" ")}`,
      `idp=${row.idpRawText}`,
      `op=${getCellText("op")}`,
    ].join(" | ");

    // Lossless token list sorted top-to-bottom, left-to-right
    const rawTokens: RawTokenV4[] = sortedCells.map((cell) => ({
      text: cell.text,
      x: cell.x0,
      y: cell.y,
      column: cell.column,
    }));

    // Lossless space-joined string (full provenance, no column structure)
    const rawRowText = rawTokens.map((t) => t.text).join(" ");

    // Sign-preserving IDP parsing
    const idp = extractSignedIdp(row.idpRawText);

    return {
      lineNumber: index + 1,
      lp: parseLp(row.lpText),
      productCode: row.codeText,
      productName: normalizeText(row.nameFragments.join(" ")) || null,
      quantity: idp.abs,
      unit: null,
      location: normalizeText(row.locationFragments.join(" ")) || null,
      rawText,
      rawRowText,
      rawTokens,
      rawNameFragments: [...row.nameFragments],
      rawLocationFragments: [...row.locationFragments],
      pageNumber: row.pageNumber,
      operationCode: row.opText,
      iz: row.iz,
      iw: row.iw,
      ir: row.ir,
      inz: row.inz,
      idpRaw: idp.raw,
      idpValue: idp.value,
      idpAbs: idp.abs,
      movementDirection: computeMovementDirection(idp.value),
      rawCells: row.rawCells,
      nameSource: row.nameSource,
      warnings: row.warnings,
    };
  });
}

// ─── Layer 4: Validation ──────────────────────────────────────────────────────

function computeParserQuality(
  rows: ParsedLineV4[],
  totalCollected: number,
  totalAssigned: number,
  correctionCount: number
): ParserQuality {
  const detectedRows = rows.length;
  const unassignedRatio =
    totalCollected > 0 ? (totalCollected - totalAssigned) / totalCollected : 0;

  const incompleteRowCount = rows.filter((r) => !r.productCode || !r.productName).length;

  const lpNumbers = rows.map((r) => r.lp).filter((lp): lp is number => lp !== null);
  const lpSet = new Set(lpNumbers);
  const duplicateLpCount = lpNumbers.length - lpSet.size;

  let lpGapCount = 0;
  if (lpNumbers.length > 1) {
    const sorted = [...lpNumbers].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] - sorted[i - 1] > 1) lpGapCount += 1;
    }
  }

  // Count rows where raw text suggests a negative sign but parsing yielded null
  const negativeIdpParseFailures = rows.filter(
    (r) => /[-–]/.test(r.idpRaw) && r.idpValue === null
  ).length;

  let score = 1.0;
  score -= unassignedRatio * 0.3;
  score -= (incompleteRowCount / Math.max(1, detectedRows)) * 0.2;
  score -= Math.min(0.2, duplicateLpCount * 0.05);
  score -= Math.min(0.15, lpGapCount * 0.05);
  score -= Math.min(0.15, negativeIdpParseFailures * 0.1);
  score = Math.max(0, Math.min(1, score));

  const warnings: string[] = [];
  if (unassignedRatio > 0.2) warnings.push("high_unassigned_token_ratio");
  if (incompleteRowCount > 0) warnings.push("incomplete_rows_detected");
  if (duplicateLpCount > 0) warnings.push("duplicate_lp_numbers");
  if (lpGapCount > 0) warnings.push("lp_sequence_gaps");
  if (negativeIdpParseFailures > 0) warnings.push("negative_idp_parse_failures");
  if (correctionCount > 0) warnings.push("column_corrections_applied");

  return {
    confidenceScore: score,
    detectedRows,
    totalCollectedTokens: totalCollected,
    totalAssignedTokens: totalAssigned,
    unassignedRatio,
    correctionCount,
    incompleteRowCount,
    duplicateLpCount,
    lpGapCount,
    negativeIdpParseFailures,
    warnings,
    stats: {
      detectedRows,
      totalCollectedTokens: totalCollected,
      totalAssignedTokens: totalAssigned,
      correctionCount,
      incompleteRowCount,
      duplicateLpCount,
      lpGapCount,
    },
  };
}

function computeParserStatus(quality: ParserQuality): ParserStatus {
  if (quality.negativeIdpParseFailures > 0) return "error";
  if (quality.detectedRows === 0 && quality.totalCollectedTokens > 20) return "error";
  if (quality.confidenceScore < 0.5) return "error";
  if (quality.confidenceScore < 0.8 || quality.warnings.length > 0) return "warning";
  return "ok";
}

// ─── Layer 5: Block parsers ───────────────────────────────────────────────────

function parseBcBlockV4(
  rows: VisualRow[],
  blockStart: BlockStart,
  blockRows: VisualRow[],
  bandMap: Map<number, ColumnBands>,
  blockIndex: number,
  prevBlockStartIdx: number
): { block: ParsedBlockV4; tableResult: RawTableResultV4 } {
  const { headerRows, tableBodyRows } = splitBlockRegions(blockRows);
  const preHeaderRows = findPreHeaderRows(rows, blockStart.idx, prevBlockStartIdx);
  const allHeaderRows = [...preHeaderRows, ...headerRows];

  const warehouseInfo = extractWarehouseSectionInfo(allHeaderRows);
  const warehouseSection = warehouseInfo.code ?? extractWarehouse(allHeaderRows);
  const brandLabel = warehouseToBrand(warehouseSection);
  const documentBrand = detectDocumentBrand(allHeaderRows);

  const tableResult = buildRawTableRowsV4(tableBodyRows, bandMap);
  const lines = buildParsedLinesV4(tableResult.rows);

  if (blockStart.sectionKind === "zw") {
    const triggerRow = rows[blockStart.idx];
    const postTriggerNeighbors = headerRows.slice(1, 5);
    const headerRaw = buildBlockHeader(triggerRow, preHeaderRows, postTriggerNeighbors);
    const headerNormalized = normalizeBlockHeader(headerRaw);
    const vinSearchRows = [triggerRow, ...postTriggerNeighbors, ...preHeaderRows.slice(-4)];

    const block: ParsedBlockV4 = {
      blockIndex,
      blockType: "direct_order",
      sourceRole: "bc",
      sectionKind: "zw",
      candidateKind: "direct_order",
      isExcluded: false,
      header: headerNormalized,
      headerRaw,
      headerNormalized,
      warehouseSection: warehouseInfo.label ?? brandLabel,
      warehouseCode: warehouseSection,
      warehouseSectionCode: warehouseSection,
      warehouseSectionLabel: warehouseInfo.label,
      brandLabel,
      documentBrand,
      logicalOrderFamily: computeLogicalOrderFamily("zw", warehouseSection, "bc"),
      pageNumber: blockRows[0]?.page ?? null,
      metadata: {
        bc_internal_zw: true,
        zw_number: extractHeaderValue(vinSearchRows, ZW_NUMBER_RE) ?? blockStart.markerValue,
        order_number: extractBlwk(preHeaderRows),
        vin: extractVin(vinSearchRows),
        zl_number: extractZl(vinSearchRows),
        client_name: extractClientLineFromHeaderRows(allHeaderRows),
        parts_count: lines.length,
      },
      lines,
    };
    return { block, tableResult };
  }

  const beforeRows = rows.slice(Math.max(0, blockStart.idx - 8), blockStart.idx);
  const headerRaw = blockStart.triggerText;
  const headerNormalized = normalizeBlockHeader(headerRaw);

  const block: ParsedBlockV4 = {
    blockIndex,
    blockType: "wdd_reconciliation",
    sourceRole: "bc",
    sectionKind: "wdd",
    candidateKind: "wdd_reconciliation",
    isExcluded: false,
    header: headerNormalized,
    headerRaw,
    headerNormalized,
    warehouseSection: warehouseInfo.label ?? brandLabel,
    warehouseCode: warehouseSection,
    warehouseSectionCode: warehouseSection,
    warehouseSectionLabel: warehouseInfo.label,
    brandLabel,
    documentBrand,
    logicalOrderFamily: computeLogicalOrderFamily("wdd", warehouseSection, "bc"),
    pageNumber: blockRows[0]?.page ?? null,
    metadata: {
      wdd_number: extractHeaderValue(allHeaderRows, WDD_NUMBER_RE),
      group_name: extractGroupName(beforeRows),
      parts_count: lines.length,
    },
    lines,
  };
  return { block, tableResult };
}

function parseBrandBlockV4(
  rows: VisualRow[],
  blockStart: BlockStart,
  blockRows: VisualRow[],
  bandMap: Map<number, ColumnBands>,
  blockIndex: number,
  prevBlockStartIdx: number
): { block: ParsedBlockV4; tableResult: RawTableResultV4 } {
  const preHeaderRows = findPreHeaderRows(rows, blockStart.idx, prevBlockStartIdx);
  const { headerRows: postTriggerHeaderRows, tableBodyRows } = splitBlockRegions(blockRows);
  const allHeaderRows = [...preHeaderRows, ...postTriggerHeaderRows];

  const warehouseInfo = extractWarehouseSectionInfo(allHeaderRows);
  const warehouseSection = warehouseInfo.code ?? extractWarehouse(allHeaderRows);
  const brandLabel = warehouseToBrand(warehouseSection);
  const documentBrand = detectDocumentBrand(allHeaderRows);

  const candidateKind: ParsedBlockV4["candidateKind"] =
    warehouseSection === "415" ? "mirror" : "brand_order";

  const triggerRow = rows[blockStart.idx];
  const postTriggerNeighbors = postTriggerHeaderRows.slice(1, 5);
  const headerRaw = buildBlockHeader(triggerRow, preHeaderRows, postTriggerNeighbors);
  const headerNormalized = normalizeBlockHeader(headerRaw);

  const vinSearchRows = [triggerRow, ...postTriggerNeighbors, ...preHeaderRows.slice(-4)];
  const zw_number = extractHeaderValue(vinSearchRows, ZW_NUMBER_RE) ?? blockStart.markerValue;
  const zl_number = extractZl(vinSearchRows);
  const vin = extractVin(vinSearchRows);
  const order_number = extractBlwk(preHeaderRows);
  const client_name = extractClientLineFromHeaderRows(allHeaderRows);

  const tableResult = buildRawTableRowsV4(tableBodyRows, bandMap);
  const lines = buildParsedLinesV4(tableResult.rows);

  const block: ParsedBlockV4 = {
    blockIndex,
    blockType: "brand_order",
    sourceRole: "brand",
    sectionKind: "zw",
    candidateKind,
    isExcluded: false,
    header: headerNormalized,
    headerRaw,
    headerNormalized,
    warehouseSection: warehouseInfo.label ?? brandLabel,
    warehouseCode: warehouseSection,
    warehouseSectionCode: warehouseSection,
    warehouseSectionLabel: warehouseInfo.label,
    brandLabel,
    documentBrand,
    logicalOrderFamily: computeLogicalOrderFamily("zw", warehouseSection, "brand"),
    pageNumber: blockRows[0]?.page ?? null,
    metadata: {
      zw_number,
      zl_number,
      order_number,
      vin,
      client_name,
      parts_count: lines.length,
    },
    lines,
  };
  return { block, tableResult };
}

// ─── Entry point ──────────────────────────────────────────────────────────────

export async function parsePdfAutoV4(buffer: ArrayBuffer): Promise<ParseResultV4> {
  const tokens = await extractTokens(buffer);
  const rows = buildRows(tokens);
  const bandMap = detectBandsByPage(rows);
  const detectedRole = detectRole(rows);
  const starts = findBlockStarts(rows, detectedRole);

  let totalCollected = 0;
  let totalAssigned = 0;
  let totalCorrected = 0;

  const blocks: ParsedBlockV4[] = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const prevBlockStartIdx = index > 0 ? starts[index - 1].idx : 0;
    const end = index + 1 < starts.length ? starts[index + 1].idx : rows.length;
    const blockRows = rows.slice(start.idx, end);
    if (!blockRows.length) continue;

    const { block, tableResult } =
      detectedRole === "bc"
        ? parseBcBlockV4(rows, start, blockRows, bandMap, index, prevBlockStartIdx)
        : parseBrandBlockV4(rows, start, blockRows, bandMap, index, prevBlockStartIdx);

    blocks.push(block);
    totalCollected += tableResult.totalCollected;
    totalAssigned += tableResult.totalAssigned;
    totalCorrected += tableResult.correctionCount;
  }

  const allLines = blocks.flatMap((b) => b.lines);
  const parserQuality = computeParserQuality(
    allLines,
    totalCollected,
    totalAssigned,
    totalCorrected
  );
  const parserStatus = computeParserStatus(parserQuality);

  return { detectedRole, blocks, parserQuality, parserStatus };
}
