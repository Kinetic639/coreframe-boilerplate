/**
 * SVWMS WDD Matcher — Geometry-First Table Parser V2
 *
 * Experimental, kept separate from parser.ts (v1) which may be returned to.
 * Never uses concatenated line text for field extraction — every field is
 * determined by which column band each token belongs to (center-X ownership).
 *
 * Entry point: parsePdfAutoV2(buffer: ArrayBuffer): Promise<ParseResultV2>
 *
 * Key differences from v1 (parser.ts):
 *  - ColumnBands: explicit x-range per column (lp/code/name/iz/iw/ir/inz/location/idp/op)
 *  - TokenRow: same grouping as VisualLine but NEVER used for text-based field extraction
 *  - Anchor detection: code-band center-X check only, no text-regex fallback
 *  - Table termination: footer legend causes flush+stop (not continue)
 *  - Operation code (O column) captured separately as operationCode
 *  - Per-row provenance: rawCells[] with token text, column assignment, coordinates
 *  - No fallback to text parsing for any field
 */

/* ============================================================
 * TYPES
 * ========================================================== */

export interface Token {
  text: string;
  page: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  width: number;
  height: number;
}

/** Tokens grouped by (page, Y-bucket). text is for pattern matching ONLY. */
interface TokenRow {
  page: number;
  y: number;
  tokens: Token[];
  text: string;
  x0: number;
  x1: number;
}

/** Explicit x-range [lo, hi) for each table column. */
export interface ColumnBands {
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

type ColName = keyof ColumnBands | "unclassified";

/** Per-token debug info attached to each parsed row. */
export interface CellFragment {
  text: string;
  column: ColName;
  x0: number;
  x1: number;
  y: number;
  page: number;
}

/** V2 parsed line — superset of v1 ParsedLine with extra fields. */
export interface ParsedLineV2 {
  lineNumber: number;
  productCode: string | null;
  productName: string | null;
  quantity: number | null; // IDP value
  unit: string | null;
  location: string | null;
  rawText: string | null;
  rawNameFragments: string[];
  rawLocationFragments: string[];
  pageNumber: number | null;
  // V2 extensions:
  operationCode: string | null;
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  rawCells: CellFragment[];
}

export interface BlockMetadataV2 {
  vin?: string | null;
  zl_number?: string | null;
  zw_number?: string | null;
  wdd_number?: string | null;
  client_name?: string | null;
  order_number?: string | null;
  group_name?: string | null;
  parts_count?: number;
  bc_internal_zw?: boolean;
  [key: string]: unknown;
}

export interface ParsedBlockV2 {
  blockIndex: number;
  blockType: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source";
  sourceRole: "bc" | "brand";
  sectionKind: "wdd" | "zw" | "unknown";
  candidateKind: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source" | "mirror";
  isExcluded: false;
  header: string | null;
  warehouseSection: string | null;
  warehouseCode: string | null;
  brandLabel: string | null;
  pageNumber: number | null;
  metadata: BlockMetadataV2;
  lines: ParsedLineV2[];
}

export interface ParseResultV2 {
  detectedRole: "bc" | "brand";
  blocks: ParsedBlockV2[];
}

/* ============================================================
 * CONSTANTS
 * ========================================================== */

const PRODUCT_CODE_RE = /^([0-9][0-9A-Z]{4,}|[A-Z]{1,4}[0-9][0-9A-Z]{3,})$/;
const WDD_NUMBER_RE = /\bWDD\/(\d+)\b/i;
const ZW_NUMBER_RE = /\bZW\/(\d+)\b/i;
const DECIMAL_RE = /(\d{1,8})[,.](\d{1,6})/g;

const WAREHOUSE_MAP: Record<string, string> = {
  "115": "VW",
  "315": "Skoda",
  "415": "Mirror",
  "515": "Seat",
};

/**
 * Calibrated default column bands for A4-landscape ERP PDFs.
 * Used as fallback when no "Lp Nr katalogowy" header row is found.
 * Units: PDF points (1pt ≈ 0.353 mm).
 */
const CALIBRATED_BANDS: ColumnBands = {
  lp: [22, 52],
  code: [52, 127],
  name: [127, 365],
  iz: [365, 395],
  iw: [395, 418],
  ir: [418, 448],
  inz: [448, 478],
  location: [478, 548],
  idp: [548, 610],
  op: [610, 900],
};

/* ============================================================
 * HELPERS
 * ========================================================== */

function isProductCode(s: string): boolean {
  const t = s.toUpperCase().trim();
  if (!PRODUCT_CODE_RE.test(t)) return false;
  // Reject 17-char VINs
  if (/^[A-HJ-NPR-Z0-9]{17}$/.test(t)) return false;
  return true;
}

function isFooterLegendLine(t: string): boolean {
  return (
    /^L\s*-\s*Stan realizacji/i.test(t) ||
    /^-\s*Brak towaru/i.test(t) ||
    /^-\s*Czesc zam[oó]wionego/i.test(t) ||
    /^-\s*Caly zam[oó]wiony/i.test(t) ||
    /^IZ\s*-\s*Ilosc/i.test(t) ||
    /^IW\s*-\s*Ilosc/i.test(t) ||
    /^IR\s*-\s*Ilosc/i.test(t) ||
    /^ILI\s*-\s*Ilosc/i.test(t) ||
    /^ILG\s*-\s*Ilosc/i.test(t) ||
    /^INZ\s*-\s*Ilosc/i.test(t) ||
    /^IDP\s*-\s*Ilosc/i.test(t) ||
    /^IK\s*-\s*Ilosc/i.test(t) ||
    /^AP\s*-\s*Anulowanie/i.test(t) ||
    /^ZR\s*-\s*Zmiana/i.test(t) ||
    /^ZL\s*-\s*Zmiana/i.test(t)
  );
}

function isTableBoundaryLine(t: string): boolean {
  return (
    /^(Strona|Data|Body\s*Center|Magazyn|Dealer)\b/i.test(t) ||
    /\bLp\b.*\bNr\s*katalogowy\b/i.test(t) ||
    /^Telefony\s*:/i.test(t) ||
    /^[A-Z]\d{3,4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}/i.test(t) ||
    /^Wysylka\//i.test(t) ||
    /^(BRA_SKO|WAJ_SEA)/i.test(t) ||
    /^W[OÓ]ZEK/i.test(t) ||
    /^NIE ZMIENIAC/i.test(t) ||
    /^\d+\.\s*Zam[oó]wienie/i.test(t) ||
    /^(BLWK|ZL|ZLEC|VIN)[/\s]/i.test(t) ||
    t === "L" ||
    isFooterLegendLine(t)
  );
}

function detectWarehouseSection(text: string): string | null {
  const m = text.match(/\b(115|315|415|515)\b/);
  return m ? m[1] : null;
}

function warehouseToBrand(section: string | null): string | null {
  return section ? (WAREHOUSE_MAP[section] ?? null) : null;
}

function isClientNameLine(t: string): boolean {
  if (t.length < 3) return false;
  if (/^(ZW|BLWK|ZL|ZLEC|VIN|WDD|Magazyn|Strona|Data|Dealer|Body\s*Center|Telefony)\b/i.test(t))
    return false;
  if (/^\d{1,3}\s+[A-Z]{2,6}$/i.test(t)) return false;
  if (/^\d+\.\s/.test(t)) return false;
  if (/Zamów/i.test(t)) return false;
  if (/\d{2}\.\d{2}\.\d{4}/.test(t)) return false;
  if (!/[a-zA-ZąćęłńóśźżĄĆĘŁŃÓŚŹŻ]{3,}/.test(t)) return false;
  return true;
}

function stripNameBoilerplate(s: string): string {
  return s
    .replace(/\s+[A-Z]\d{3,4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}.*/i, "")
    .replace(/\s+\d{2}\.\d{2}\.\d{4}.*/i, "")
    .replace(/\s+\d+\.\s+Zamów.*/i, "")
    .replace(/\s+Telefony\s*:.*$/i, "")
    .replace(/\s+Dealer\b.*$/i, "")
    .replace(/\s+Body\s*Center\b.*$/i, "")
    .trim();
}

/** Extract last decimal value from a cell's text content. */
function lastDecimalInText(txt: string): number | null {
  const matches = [...txt.matchAll(DECIMAL_RE)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  const v = parseFloat(`${last[1]}.${last[2]}`);
  return Number.isFinite(v) ? v : null;
}

/* ============================================================
 * STAGE 1: Token extraction
 * ========================================================== */

async function extractTokens(buffer: ArrayBuffer): Promise<Token[]> {
  if (typeof (globalThis as any).DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix {};
  }
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  if (!pdfjsLib.GlobalWorkerOptions.workerSrc) {
    const { createRequire } = await import("node:module");
    const workerPath = createRequire(import.meta.url).resolve(
      "pdfjs-dist/legacy/build/pdf.worker.mjs"
    );
    pdfjsLib.GlobalWorkerOptions.workerSrc = `file://${workerPath}`;
  }
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const tokens: Token[] = [];

  for (let p = 1; p <= doc.numPages; p++) {
    const page = await doc.getPage(p);
    const content = await page.getTextContent({ disableNormalization: false });

    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const tf = item.transform as number[];
      const x0 = tf[4];
      const y1 = tf[5];
      const w = (item.width as number) ?? 0;
      const h = (item.height as number) ?? 10;
      tokens.push({
        text: item.str,
        page: p,
        x0,
        x1: x0 + w,
        y0: y1 - h,
        y1,
        width: w,
        height: h,
      });
    }
  }

  return tokens;
}

/* ============================================================
 * STAGE 2: Build TokenRows (grouped by page + Y-bucket)
 * ========================================================== */

function buildTokenRows(tokens: Token[]): TokenRow[] {
  const buckets = new Map<string, Token[]>();

  for (const tok of tokens) {
    const yb = Math.round(tok.y1 / 4) * 4;
    const key = `${tok.page}:${yb}`;
    const arr = buckets.get(key) ?? [];
    arr.push(tok);
    buckets.set(key, arr);
  }

  const rows: TokenRow[] = [];

  for (const [key, toks] of buckets) {
    const sorted = toks.sort((a, b) => a.x0 - b.x0);

    // Build text for pattern matching only (gap-aware concatenation)
    let text = "";
    let prevX1: number | null = null;
    for (const t of sorted) {
      const s = t.text.trim();
      if (!s) continue;
      if (!text) {
        text = s;
      } else {
        const gap = prevX1 != null ? t.x0 - prevX1 : 0;
        text += gap > 25 ? "  " : " ";
        text += s;
      }
      prevX1 = t.x1;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    const [ps, ys] = key.split(":");
    rows.push({
      page: parseInt(ps, 10),
      y: parseInt(ys, 10),
      tokens: sorted,
      text,
      x0: sorted[0]?.x0 ?? 0,
      x1: sorted[sorted.length - 1]?.x1 ?? 0,
    });
  }

  // Page asc, Y desc (higher Y = closer to top of page in PDF coordinates)
  rows.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y));
  return rows;
}

/* ============================================================
 * STAGE 3: Column band detection
 * ========================================================== */

function bandsFromHeaderRow(hr: TokenRow): ColumnBands {
  const find = (re: RegExp) => hr.tokens.find((t) => re.test(t.text.trim()));

  const lpTok = find(/^Lp$/i);
  const nrTok = find(/^Nr$/i) ?? find(/^Nr\.$/i);
  const nmTok = find(/^Nazwa$/i) ?? find(/^Opis$/i);
  const izTok = find(/^IZ$/i);
  const iwTok = find(/^IW$/i);
  const irTok = find(/^IR(\/ILI)?$/i) ?? find(/^ILI$/i) ?? find(/^IR$/i);
  const inzTok = find(/^INZ$/i);
  const lokTok = find(/^Lokalizacja$/i) ?? find(/^Lok\.?$/i) ?? find(/^L$/i);
  const idpTok = find(/^IDP$/i);
  const opTok = find(/^O$/i);

  const D = CALIBRATED_BANDS;

  const lpX = lpTok?.x0 ?? D.lp[0];
  const codeX = nrTok?.x0 ?? D.code[0];
  const nameX = nmTok?.x0 ?? D.name[0];
  const izX = izTok?.x0 ?? D.iz[0];
  const iwX = iwTok?.x0 ?? D.iw[0];
  const irX = irTok?.x0 ?? D.ir[0];
  const inzX = inzTok?.x0 ?? D.inz[0];
  const locX = lokTok?.x0 ?? D.location[0];
  const idpX = idpTok?.x0 ?? D.idp[0];
  const opX = opTok?.x0 ?? D.op[0];
  const right = opTok ? opTok.x1 + 60 : D.op[1];

  return {
    lp: [lpX - 3, codeX - 2],
    code: [codeX - 2, nameX - 2],
    name: [nameX - 2, izX - 4],
    iz: [izX - 4, iwX - 4],
    iw: [iwX - 4, irX - 4],
    ir: [irX - 4, inzX - 4],
    inz: [inzX - 4, locX - 4],
    location: [locX - 4, idpX - 4],
    idp: [idpX - 4, opX - 2],
    op: [opX - 2, right],
  };
}

function detectColumnBandsMap(rows: TokenRow[]): Map<number, ColumnBands> {
  const map = new Map<number, ColumnBands>();
  for (const row of rows) {
    if (!map.has(row.page) && /\bLp\b.*\bNr\s*katalogowy\b/i.test(row.text)) {
      map.set(row.page, bandsFromHeaderRow(row));
    }
  }
  return map;
}

function bandsForPage(page: number, map: Map<number, ColumnBands>): ColumnBands {
  if (map.has(page)) return map.get(page)!;
  if (map.size === 0) return CALIBRATED_BANDS;
  let best = CALIBRATED_BANDS;
  let bestDist = Infinity;
  for (const [p, b] of map) {
    const d = Math.abs(p - page);
    if (d < bestDist) {
      bestDist = d;
      best = b;
    }
  }
  return best;
}

/* ============================================================
 * TOKEN → COLUMN ASSIGNMENT
 * ========================================================== */

function assignColumn(tok: Token, bands: ColumnBands): ColName {
  const cx = (tok.x0 + tok.x1) / 2;
  for (const col of Object.keys(bands) as (keyof ColumnBands)[]) {
    const [lo, hi] = bands[col];
    if (cx >= lo && cx < hi) return col;
  }
  return "unclassified";
}

/* ============================================================
 * STAGE 4: Block boundaries
 * ========================================================== */

interface BlockBoundary {
  idx: number;
  sectionKind: "wdd" | "zw";
  triggerText: string;
}

function findBlockBoundaries(rows: TokenRow[], role: "bc" | "brand"): BlockBoundary[] {
  const out: BlockBoundary[] = [];
  for (let i = 0; i < rows.length; i++) {
    const t = rows[i].text;
    if (WDD_NUMBER_RE.test(t)) {
      const last = out[out.length - 1];
      if (last?.sectionKind === "wdd" && i - last.idx <= 3) continue;
      out.push({ idx: i, sectionKind: "wdd", triggerText: t });
    } else if (ZW_NUMBER_RE.test(t)) {
      out.push({ idx: i, sectionKind: "zw", triggerText: t });
    }
  }
  if (role === "brand") return out.filter((s) => s.sectionKind === "zw");
  return out;
}

/* ============================================================
 * STAGE 5: Block header extraction
 * ========================================================== */

interface BcHeader {
  wddNumber: string | null;
  warehouseSection: string | null;
  groupName: string | null;
}

function extractBcHeader(allRows: TokenRow[], blockRows: TokenRow[], blockStart: number): BcHeader {
  const headerArea = blockRows.slice(0, Math.min(15, blockRows.length));
  const fullText = headerArea.map((r) => r.text).join(" ");

  const wddM = fullText.match(WDD_NUMBER_RE);
  const warehouseSection = detectWarehouseSection(fullText);

  let groupName: string | null = null;
  const wysylkaRE = /Wysylka\/\d+\/KOM\s+([A-Z0-9_]+)/i;
  const lookback = Math.max(0, blockStart - 20);
  for (let i = blockStart - 1; i >= lookback; i--) {
    const m = allRows[i].text.match(wysylkaRE);
    if (m) {
      groupName = m[1].toUpperCase();
      break;
    }
  }

  return {
    wddNumber: wddM ? `WDD/${wddM[1]}` : null,
    warehouseSection,
    groupName,
  };
}

interface BrandHeader {
  zwNumber: string | null;
  zlNumber: string | null;
  blwkNumber: string | null;
  vin: string | null;
  clientName: string | null;
  warehouseSection: string | null;
}

function extractBrandHeader(
  allRows: TokenRow[],
  blockRows: TokenRow[],
  blockStart: number
): BrandHeader {
  const headerArea = blockRows.slice(0, Math.min(15, blockRows.length));
  const headerFull = headerArea.map((r) => r.text).join(" ");

  const zwM = headerFull.match(ZW_NUMBER_RE);
  const zlM = headerFull.match(/(ZLEC|ZL)\/([^\s]+)/i);
  const vinM = blockRows[0]?.text.match(/\b([A-Z0-9]{17})\b/i);
  const warehouseSection = detectWarehouseSection(headerFull);

  let blwkNumber: string | null = null;
  let clientName: string | null = null;
  const lookback = Math.max(0, blockStart - 10);
  let blwkIdx = -1;

  for (let i = blockStart - 1; i >= lookback; i--) {
    if (/BLWK\s*\/\s*\d+/i.test(allRows[i].text)) {
      blwkIdx = i;
      const bm = allRows[i].text.match(/BLWK\s*\/\s*(\d+)/i)!;
      blwkNumber = `BLWK/${bm[1]}`;
      break;
    }
  }

  if (blwkIdx >= 0) {
    const parts: string[] = [];
    const rawSuffix = allRows[blwkIdx].text.match(/BLWK\s*\/\s*\d+\s*(.*)/i)?.[1]?.trim() ?? "";
    const suf = stripNameBoilerplate(rawSuffix);
    if (suf.length >= 2 && isClientNameLine(suf)) parts.push(suf);

    for (let j = blwkIdx + 1; j < blockStart && parts.length < 3; j++) {
      const cand = stripNameBoilerplate(allRows[j].text.trim());
      if (cand.length >= 2 && isClientNameLine(cand)) parts.push(cand);
      else if (parts.length > 0) break;
    }
    if (parts.length > 0) clientName = parts.join(" ");
  }

  if (!clientName) {
    for (let i = 1; i < headerArea.length; i++) {
      const t = headerArea[i].text.trim();
      if (isClientNameLine(t)) {
        clientName = t;
        if (i + 1 < headerArea.length && isClientNameLine(headerArea[i + 1].text.trim())) {
          clientName = `${clientName} ${headerArea[i + 1].text.trim()}`;
        }
        break;
      }
    }
  }

  return {
    zwNumber: zwM ? `ZW/${zwM[1]}` : null,
    zlNumber: zlM ? `${zlM[1].toUpperCase()}/${zlM[2]}` : null,
    blwkNumber,
    vin: vinM ? vinM[1].toUpperCase() : null,
    clientName,
    warehouseSection,
  };
}

/* ============================================================
 * STAGE 6: Table start detection (geometry-aware)
 * ========================================================== */

function detectTableStart(blockRows: TokenRow[], bands: ColumnBands): number {
  let contentStart = 1;

  for (let i = 1; i < Math.min(40, blockRows.length); i++) {
    const t = blockRows[i].text.trim();

    if (/\bLp\b.*\bNr\s*katalogowy\b/i.test(t)) {
      contentStart = i + 1;
      continue;
    }

    // Anchor row by geometry: code-band contains a valid product code
    const hasCodeToken = blockRows[i].tokens.some((tok) => {
      const cx = (tok.x0 + tok.x1) / 2;
      return (
        cx >= bands.code[0] && cx < bands.code[1] && isProductCode(tok.text.toUpperCase().trim())
      );
    });
    if (hasCodeToken) return i;

    if (
      isTableBoundaryLine(t) ||
      WDD_NUMBER_RE.test(t) ||
      ZW_NUMBER_RE.test(t) ||
      /^99\.\s*Zam[oó]wienie\s+WDD/i.test(t)
    ) {
      contentStart = i + 1;
    }
  }

  return contentStart;
}

/* ============================================================
 * STAGE 7: Table row reconstruction — THE CORE
 * ========================================================== */

interface RawTableRow {
  lpText: string | null;
  codeText: string | null;
  nameFragments: string[];
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  locationFragments: string[];
  idp: number | null;
  opText: string | null;
  pageNumber: number | null;
  rawCells: CellFragment[];
}

function emptyRawRow(): RawTableRow {
  return {
    lpText: null,
    codeText: null,
    nameFragments: [],
    iz: null,
    iw: null,
    ir: null,
    inz: null,
    locationFragments: [],
    idp: null,
    opText: null,
    pageNumber: null,
    rawCells: [],
  };
}

/**
 * Group a TokenRow's tokens by column, build provenance fragments.
 * Returns byCol map and flat CellFragment array.
 */
function collectRowCells(
  row: TokenRow,
  bands: ColumnBands
): { byCol: Map<ColName, Token[]>; fragments: CellFragment[] } {
  const byCol = new Map<ColName, Token[]>();
  const fragments: CellFragment[] = [];

  for (const tok of row.tokens) {
    const s = tok.text.trim();
    if (!s) continue;
    const col = assignColumn(tok, bands);
    const arr = byCol.get(col) ?? [];
    arr.push(tok);
    byCol.set(col, arr);
    fragments.push({ text: s, column: col, x0: tok.x0, x1: tok.x1, y: row.y, page: row.page });
  }

  return { byCol, fragments };
}

function colText(byCol: Map<ColName, Token[]>, col: ColName): string {
  return (byCol.get(col) ?? [])
    .map((t) => t.text.trim())
    .filter(Boolean)
    .join(" ");
}

function colDecimal(byCol: Map<ColName, Token[]>, col: ColName): number | null {
  return lastDecimalInText(colText(byCol, col));
}

/** True if code-band has at least one valid product code token. */
function isAnchorRow(byCol: Map<ColName, Token[]>): boolean {
  return (byCol.get("code") ?? []).some((t) => isProductCode(t.text.toUpperCase().trim()));
}

/**
 * Merge cells from a TokenRow into a RawTableRow.
 * isAnchor=true: populate all columns (first row for this product).
 * isAnchor=false: append only name/location/idp/op (continuation of wrapped name).
 */
function accumulateCells(
  target: RawTableRow,
  byCol: Map<ColName, Token[]>,
  fragments: CellFragment[],
  row: TokenRow,
  isAnchor: boolean
): void {
  target.rawCells.push(...fragments);

  if (isAnchor) {
    target.pageNumber = row.page;

    const lpTxt = colText(byCol, "lp");
    if (lpTxt) target.lpText = lpTxt;

    const codeToken = (byCol.get("code") ?? []).find((t) =>
      isProductCode(t.text.toUpperCase().trim())
    );
    if (codeToken) target.codeText = codeToken.text.toUpperCase().trim();

    target.iz = colDecimal(byCol, "iz");
    target.iw = colDecimal(byCol, "iw");
    target.ir = colDecimal(byCol, "ir");
    target.inz = colDecimal(byCol, "inz");
    target.idp = colDecimal(byCol, "idp");

    const op = colText(byCol, "op");
    if (op) target.opText = op;
  } else {
    // Continuation: update idp/op only if not already set
    if (target.idp === null) {
      const idp = colDecimal(byCol, "idp");
      if (idp !== null) target.idp = idp;
    }
    if (!target.opText) {
      const op = colText(byCol, "op");
      if (op) target.opText = op;
    }
  }

  // Name and location always accumulated (from both anchor and continuation rows)
  const nameFrag = colText(byCol, "name");
  if (nameFrag) target.nameFragments.push(nameFrag);

  const locFrag = colText(byCol, "location");
  if (locFrag) target.locationFragments.push(locFrag);
}

function reconstructTableRows(
  blockRows: TokenRow[],
  tableStart: number,
  bandsMap: Map<number, ColumnBands>
): RawTableRow[] {
  // ─────────────────────────────────────────────────────────────────────────
  // GEOMETRY-FIRST CELL ASSIGNMENT
  //
  // Abandons the streaming anchor+continuation heuristic in favour of an
  // explicit row-band / column-band cell model:
  //
  //   Phase 1 — Collect every eligible token in the table region.
  //   Phase 2 — Identify anchor positions from code-band product codes.
  //   Phase 3 — Partition the page into row bands via inter-anchor midpoints.
  //   Phase 4 — Assign every token to the band whose Y-range contains it.
  //   Phase 5 — Sort tokens within each cell in visual reading order.
  //   Phase 6 — Build RawTableRow from each band's cell contents.
  //
  // Handles ERP layout quirks automatically:
  //  • Name tokens rendered slightly above the anchor baseline — they fall
  //    inside the band (topY extends to the midpoint with the previous anchor).
  //  • Multi-line names — all continuation rows within the band are merged.
  //  • Location tokens at arbitrary Y — captured wherever they land in band.
  //  • Mirror/ZR rows — treated as ordinary anchor rows; op column carries ZR.
  // ─────────────────────────────────────────────────────────────────────────

  // ── Phase 1: collect all eligible tokens ─────────────────────────────────
  interface TblToken {
    tok: Token;
    page: number;
    y: number;
    col: ColName;
  }
  const tblTokens: TblToken[] = [];

  for (let i = tableStart; i < blockRows.length; i++) {
    const row = blockRows[i];
    const t = row.text.trim();
    if (!t) continue;
    if (isFooterLegendLine(t)) break;
    if (
      isTableBoundaryLine(t) ||
      WDD_NUMBER_RE.test(t) ||
      ZW_NUMBER_RE.test(t) ||
      /^99\.\s*Zam[oó]wienie\s+WDD/i.test(t)
    )
      continue;
    // Skip rows whose ENTIRE text is a standalone LP ordinal.
    // Any real LP token co-rendered with a code token will be captured via
    // the anchor row's Y band.
    if (/^\d{1,3}\.?$/.test(t)) {
      const n = parseInt(t.replace(/\.$/, ""), 10);
      if (n >= 1 && n <= 999) continue;
    }
    const bands = bandsForPage(row.page, bandsMap);
    for (const tok of row.tokens) {
      if (!tok.text.trim()) continue;
      const col = assignColumn(tok, bands);
      // Use tok.y1 (baseline) directly — more precise than the 4-pt bucket Y
      tblTokens.push({ tok, page: row.page, y: tok.y1, col });
    }
  }

  if (tblTokens.length === 0) return [];

  // ── Phase 2: identify anchors ─────────────────────────────────────────────
  // An anchor is one unique (page, y-bucket) position in the code band that
  // carries a valid product code.  Use a 6-pt bucket so that a code token
  // split across 2 sub-pixel positions collapses to a single anchor.
  interface Anchor {
    page: number;
    y: number;
    codeText: string;
  }
  const anchorBuckets = new Map<string, Anchor>();

  for (const tt of tblTokens) {
    if (tt.col !== "code") continue;
    const code = tt.tok.text.toUpperCase().trim();
    if (!isProductCode(code)) continue;
    const yb = Math.round(tt.y / 6) * 6;
    const key = `${tt.page}:${yb}`;
    if (!anchorBuckets.has(key)) {
      anchorBuckets.set(key, { page: tt.page, y: tt.y, codeText: code });
    }
  }

  const anchors: Anchor[] = [...anchorBuckets.values()];
  // Sort top-to-bottom: page ASC then Y DESC (higher Y = higher on page)
  anchors.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y));

  if (anchors.length === 0) return [];

  // ── Phase 3: compute row bands via inter-anchor midpoints ─────────────────
  // Band[i].topY    = midpoint to previous same-page anchor (generous PAGE_TOP if first)
  // Band[i].bottomY = midpoint to next same-page anchor (generous PAGE_BOTTOM if last)
  //
  // Condition for token at Y to belong to band b:
  //   band.bottomY < Y ≤ band.topY   (upper-inclusive, lower-exclusive)
  // → midpoint belongs to the later/lower anchor, which is the correct home for
  //   any token that sits exactly between two products.
  const PAGE_TOP = 700; // pt — generous top margin (A4 landscape ≈ 595pt, add slack)
  const PAGE_BOTTOM = 0;

  interface RowBand {
    page: number;
    topY: number;
    bottomY: number;
  }
  const rowBands: RowBand[] = anchors.map((anchor, i) => {
    let prevY: number | null = null;
    for (let j = i - 1; j >= 0; j--) {
      if (anchors[j].page === anchor.page) {
        prevY = anchors[j].y;
        break;
      }
    }
    let nextY: number | null = null;
    for (let j = i + 1; j < anchors.length; j++) {
      if (anchors[j].page === anchor.page) {
        nextY = anchors[j].y;
        break;
      }
    }
    return {
      page: anchor.page,
      topY: prevY !== null ? (prevY + anchor.y) / 2 : PAGE_TOP,
      bottomY: nextY !== null ? (anchor.y + nextY) / 2 : PAGE_BOTTOM,
    };
  });

  // ── Phase 4: assign tokens to bands ──────────────────────────────────────
  const rowCells: Array<Map<ColName, Token[]>> = anchors.map(() => new Map());
  const rowAllFrags: Array<CellFragment[]> = anchors.map(() => []);

  function findBandIdx(page: number, y: number): number {
    for (let b = 0; b < rowBands.length; b++) {
      const bd = rowBands[b];
      if (bd.page === page && y > bd.bottomY && y <= bd.topY) return b;
    }
    return -1;
  }

  for (const tt of tblTokens) {
    const bIdx = findBandIdx(tt.page, tt.y);
    if (bIdx < 0) continue;

    const cells = rowCells[bIdx];
    const arr = cells.get(tt.col) ?? [];
    arr.push(tt.tok);
    cells.set(tt.col, arr);

    rowAllFrags[bIdx].push({
      text: tt.tok.text.trim(),
      column: tt.col,
      x0: tt.tok.x0,
      x1: tt.tok.x1,
      y: tt.y,
      page: tt.page,
    });
  }

  // ── Phase 5: sort tokens in visual reading order ──────────────────────────
  // All cells: Y desc (top→bottom) then X asc (left→right) within same line.
  // A 2-pt Y tolerance merges tokens on the same visual baseline.
  for (const cells of rowCells) {
    for (const [, toks] of cells) {
      toks.sort((a, b) => {
        const dy = b.y1 - a.y1;
        if (Math.abs(dy) > 2) return dy;
        return a.x0 - b.x0;
      });
    }
  }

  // ── Phase 6: build RawTableRows from cell contents ───────────────────────
  function cellText(cells: Map<ColName, Token[]>, col: ColName): string {
    return (cells.get(col) ?? [])
      .map((t) => t.text.trim())
      .filter(Boolean)
      .join(" ")
      .replace(/\s+/g, " ")
      .trim();
  }

  const result: RawTableRow[] = [];

  for (let i = 0; i < anchors.length; i++) {
    const anchor = anchors[i];
    const cells = rowCells[i];
    const frags = rowAllFrags[i];

    const codeToken = (cells.get("code") ?? []).find((t) =>
      isProductCode(t.text.toUpperCase().trim())
    );
    if (!codeToken) continue; // band had no valid product code — skip

    // Name: deduplicate adjacent identical tokens (some ERP PDFs double-render words)
    const nameRaw = (cells.get("name") ?? []).map((t) => t.text.trim()).filter(Boolean);
    const nameFragments: string[] = [];
    for (const part of nameRaw) {
      if (nameFragments.length === 0 || nameFragments[nameFragments.length - 1] !== part) {
        nameFragments.push(part);
      }
    }

    // Location: same dedup
    const locRaw = (cells.get("location") ?? []).map((t) => t.text.trim()).filter(Boolean);
    const locationFragments: string[] = [];
    for (const part of locRaw) {
      if (
        locationFragments.length === 0 ||
        locationFragments[locationFragments.length - 1] !== part
      ) {
        locationFragments.push(part);
      }
    }

    result.push({
      lpText: cellText(cells, "lp") || null,
      codeText: codeToken.text.toUpperCase().trim(),
      nameFragments,
      iz: lastDecimalInText(cellText(cells, "iz")),
      iw: lastDecimalInText(cellText(cells, "iw")),
      ir: lastDecimalInText(cellText(cells, "ir")),
      inz: lastDecimalInText(cellText(cells, "inz")),
      locationFragments,
      idp: lastDecimalInText(cellText(cells, "idp")),
      opText: cellText(cells, "op") || null,
      pageNumber: anchor.page,
      rawCells: frags,
    });
  }

  return result;
}

/* ============================================================
 * STAGE 8: Assemble ParsedLineV2 from RawTableRow[]
 * ========================================================== */

function buildParsedLines(rawRows: RawTableRow[]): ParsedLineV2[] {
  return rawRows.map((raw, idx) => {
    const name = raw.nameFragments.join(" ").replace(/\s+/g, " ").trim() || null;
    const loc = raw.locationFragments.join(" ").replace(/\s+/g, " ").trim() || null;

    // raw_text: every token in the row band in spatial reading order
    // (top→bottom, left→right within each line).  This is a complete
    // representation of the source row — not just the fields we explicitly
    // parsed — making it suitable for debugging and verification.
    const rawText =
      [...raw.rawCells]
        .sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0))
        .map((f) => f.text)
        .filter(Boolean)
        .join(" ") || null;

    return {
      lineNumber: idx + 1,
      productCode: raw.codeText,
      productName: name,
      quantity: raw.idp,
      unit: null,
      location: loc,
      rawText,
      rawNameFragments: [...raw.nameFragments],
      rawLocationFragments: [...raw.locationFragments],
      pageNumber: raw.pageNumber,
      operationCode: raw.opText,
      iz: raw.iz,
      iw: raw.iw,
      ir: raw.ir,
      inz: raw.inz,
      rawCells: raw.rawCells,
    };
  });
}

/* ============================================================
 * STAGE 9: Block assembly — BC file
 * ========================================================== */

function parseBcBlocks(allRows: TokenRow[], bandsMap: Map<number, ColumnBands>): ParsedBlockV2[] {
  const starts = findBlockBoundaries(allRows, "bc");
  const blocks: ParsedBlockV2[] = [];

  for (let b = 0; b < starts.length; b++) {
    const { idx: start, sectionKind, triggerText } = starts[b];
    const end = b + 1 < starts.length ? starts[b + 1].idx : allRows.length;
    const blockRows = allRows.slice(start, end);
    const pageNumber = blockRows[0]?.page ?? null;
    const pageBands = bandsForPage(blockRows[0]?.page ?? 1, bandsMap);

    if (sectionKind === "zw") {
      const tableStart = detectTableStart(blockRows, pageBands);
      const rawRows = reconstructTableRows(blockRows, tableStart, bandsMap);
      const lines = buildParsedLines(rawRows);
      const zwM = triggerText.match(ZW_NUMBER_RE);

      blocks.push({
        blockIndex: b,
        blockType: "direct_order",
        sourceRole: "bc",
        sectionKind: "zw",
        candidateKind: "direct_order",
        isExcluded: false,
        header: triggerText,
        warehouseSection: null,
        warehouseCode: null,
        brandLabel: null,
        pageNumber,
        metadata: {
          bc_internal_zw: true,
          zw_number: zwM ? `ZW/${zwM[1]}` : null,
          parts_count: lines.length,
        },
        lines,
      });
      continue;
    }

    const { wddNumber, warehouseSection, groupName } = extractBcHeader(allRows, blockRows, start);
    const brandLabel = warehouseToBrand(warehouseSection);
    const tableStart = detectTableStart(blockRows, pageBands);
    const rawRows = reconstructTableRows(blockRows, tableStart, bandsMap);
    const lines = buildParsedLines(rawRows);

    blocks.push({
      blockIndex: b,
      blockType: "wdd_reconciliation",
      sourceRole: "bc",
      sectionKind: "wdd",
      candidateKind: "wdd_reconciliation",
      isExcluded: false,
      header: triggerText,
      warehouseSection,
      warehouseCode: warehouseSection,
      brandLabel,
      pageNumber,
      metadata: {
        wdd_number: wddNumber,
        group_name: groupName,
        parts_count: lines.length,
      },
      lines,
    });
  }

  return blocks;
}

/* ============================================================
 * STAGE 9: Block assembly — Brand file
 * ========================================================== */

function parseBrandBlocks(
  allRows: TokenRow[],
  bandsMap: Map<number, ColumnBands>
): ParsedBlockV2[] {
  const starts = findBlockBoundaries(allRows, "brand");
  const blocks: ParsedBlockV2[] = [];

  for (let b = 0; b < starts.length; b++) {
    const { idx: start, triggerText } = starts[b];
    const end = b + 1 < starts.length ? starts[b + 1].idx : allRows.length;
    const blockRows = allRows.slice(start, end);
    const pageNumber = blockRows[0]?.page ?? null;
    const pageBands = bandsForPage(blockRows[0]?.page ?? 1, bandsMap);

    const { zwNumber, zlNumber, blwkNumber, vin, clientName, warehouseSection } =
      extractBrandHeader(allRows, blockRows, start);

    const brandLabel = warehouseToBrand(warehouseSection);
    const candidateKind: ParsedBlockV2["candidateKind"] =
      warehouseSection === "415" ? "mirror" : "brand_order";

    const tableStart = detectTableStart(blockRows, pageBands);
    const rawRows = reconstructTableRows(blockRows, tableStart, bandsMap);
    const lines = buildParsedLines(rawRows);

    blocks.push({
      blockIndex: b,
      blockType: "brand_order",
      sourceRole: "brand",
      sectionKind: "zw",
      candidateKind,
      isExcluded: false,
      header: triggerText,
      warehouseSection,
      warehouseCode: warehouseSection,
      brandLabel,
      pageNumber,
      metadata: {
        zw_number: zwNumber,
        zl_number: zlNumber,
        order_number: blwkNumber,
        vin,
        client_name: clientName,
        parts_count: lines.length,
      },
      lines,
    });
  }

  return blocks;
}

/* ============================================================
 * ENTRY POINT
 * ========================================================== */

export async function parsePdfAutoV2(buffer: ArrayBuffer): Promise<ParseResultV2> {
  const tokens = await extractTokens(buffer);
  const rows = buildTokenRows(tokens);
  const bandsMap = detectColumnBandsMap(rows);

  const fullText = rows.map((r) => r.text).join("\n");
  const wddCount = (fullText.match(/WDD\/\d+/gi) ?? []).length;
  const zwCount = (fullText.match(/ZW\/\d+/gi) ?? []).length;
  const detectedRole: "bc" | "brand" = wddCount >= zwCount ? "bc" : "brand";

  const blocks =
    detectedRole === "bc" ? parseBcBlocks(rows, bandsMap) : parseBrandBlocks(rows, bandsMap);

  return { detectedRole, blocks };
}
