/**
 * SVWMS WDD Matcher — PDF Parser (Geometry-Aware, Lossless)
 *
 * 9-stage pipeline:
 *   Stage 1  Token extraction       — pdfjs items → Token[] with full x/y geometry
 *   Stage 2  Visual line recon      — group tokens by Y-bucket → VisualLine[]
 *   Stage 3  Page layout profiling  — detect column bands from "Lp / Nr katalogowy" header row
 *   Stage 4  Block boundary         — scan VisualLines for WDD/NNN + ZW/NNN triggers
 *   Stage 5  Block header           — extract metadata (WDD#, ZW#, BLWK, VIN, client name)
 *   Stage 6  Table region isolation — advance past header area to first product row
 *   Stage 7  Row reconstruction     — anchor rows + continuation attribution by column band
 *   Stage 8  Post-row normalization — strip boilerplate, merge name/location fragments
 *   Stage 9  Classification         — set blockType / candidateKind / sectionKind
 *
 * PDF library: pdfjs-dist/legacy/build/pdf.mjs
 *   LEGACY build required — main build uses DOMMatrix (browser-only API).
 *   disableWorker: true — runs synchronously in-process, no worker file needed.
 *   item.transform[4] = X (left edge of token), item.transform[5] = Y (baseline).
 *
 * Lossless principle:
 *   isExcluded is ALWAYS false on every emitted block.
 *   No blocks are discarded at parse time.
 *   Downstream matching uses candidateKind ("direct_order", "mirror") for filtering.
 */

/* ============================================================
 * STAGE 1 + 2 TYPES: Token, VisualLine
 * ========================================================== */

/** A single text fragment from pdfjs with full bounding-box geometry. */
export interface Token {
  text: string;
  page: number;
  x0: number; // left edge (transform[4])
  x1: number; // right edge (x0 + item.width)
  y0: number; // approximate top  (y1 - item.height)
  y1: number; // baseline (transform[5])
  width: number;
  height: number;
}

/**
 * One visual row on the page, built by grouping tokens with the same Y-bucket.
 * Tokens are sorted left-to-right; gaps > 25pt produce an extra space in `text`.
 */
export interface VisualLine {
  page: number;
  y: number; // bucketed baseline Y (round to nearest 4pt)
  tokens: Token[];
  text: string; // gap-aware space-joined token texts
  x0: number; // leftmost token x0
  x1: number; // rightmost token x1
}

/* ============================================================
 * STAGE 3 TYPE: PageLayout
 * ========================================================== */

/**
 * Detected column bands for one page.
 * Each band is [xMin, xMax] in page coordinate units.
 * null when no header row was found for that page.
 */
export interface PageLayout {
  lpBand: [number, number] | null;
  codeBand: [number, number] | null;
  nameBand: [number, number] | null;
  qtyBand: [number, number] | null; // covers IZ / IW / IR / INZ columns
  locationBand: [number, number] | null;
  idpBand: [number, number] | null;
}

/* ============================================================
 * PUBLIC OUTPUT TYPES
 * ========================================================== */

export interface ParsedLine {
  lineNumber: number;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  /** Separated warehouse shelf / location code (e.g. "A1-01-3", "KOMI-B2"). */
  location: string | null;
  rawText: string | null;
  /** Individual name-band text fragments before joining. */
  rawNameFragments: string[];
  /** Individual location-band text fragments before joining. */
  rawLocationFragments: string[];
  pageNumber: number | null;
}

export interface BlockMetadata {
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

export interface ParsedBlock {
  blockIndex: number;
  blockType: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source";
  /** Which file type produced this block. */
  sourceRole: "bc" | "brand";
  /** What document-structure marker opened this block. */
  sectionKind: "wdd" | "zw" | "unknown";
  /**
   * Parser's provisional classification — used by downstream matching
   * instead of isExcluded.
   *   "wdd_reconciliation" — BC physical delivery block (WDD/NNN)
   *   "direct_order"       — BC-internal ZW block (previously excluded)
   *   "brand_order"        — Normal brand ORDER block (ZW/NNN, non-415)
   *   "mirror"             — Warehouse 415 mirror section (previously excluded)
   *   "wdd_source"         — WDD source file block
   */
  candidateKind: "wdd_reconciliation" | "direct_order" | "brand_order" | "wdd_source" | "mirror";
  /** Always false — parser never excludes blocks. */
  isExcluded: false;
  /** Text of the trigger line (WDD/NNN or ZW/NNN). */
  header: string | null;
  /** Numeric warehouse section code ("115", "315", "415", "515"). */
  warehouseSection: string | null;
  /** Same as warehouseSection (explicit alias for column mapping). */
  warehouseCode: string | null;
  brandLabel: string | null;
  pageNumber: number | null;
  metadata: BlockMetadata;
  lines: ParsedLine[];
}

export interface ParseResult {
  detectedRole: "bc" | "brand";
  blocks: ParsedBlock[];
}

/* ============================================================
 * REGEX CONSTANTS
 * ========================================================== */

/**
 * Valid product code:
 *   Digit-start:  5+ alphanumeric chars starting with a digit  (e.g. 565000279, 5Q0711049F)
 *   Letter-start: 1–4 uppercase letters + a digit + 3+ chars  (e.g. D378500A2, WHT006944)
 */
const PRODUCT_CODE_RE = /^([0-9][0-9A-Z]{4,}|[A-Z]{1,4}[0-9][0-9A-Z]{3,})$/;

const WDD_NUMBER_RE = /\bWDD\/(\d+)\b/i;
const ZW_NUMBER_RE = /\bZW\/(\d+)\b/i;

/** Informational WDD reconciliation header in BC files. */
const WDD_RECONCILIATION_RE = /\b99\.\s*Zam[óo]wienie\s+WDD[\s_]+KOM[\s_]?BC/i;

/** At least 4 consecutive decimal values — marks a numeric-columns row. */
const NUMERIC_COLS_RE = /(\d+[,.]\d+)(\s+\d+[,.]\d+){3,}/;

const WAREHOUSE_MAP: Record<string, string> = {
  "115": "VW",
  "315": "Skoda",
  "415": "Mirror",
  "515": "Seat",
};

const BRAND_LABELS = new Set(["VW", "Skoda", "Seat", "Audi", "Mirror", "Volkswagen"]);

/* ============================================================
 * HELPER FUNCTIONS
 * ========================================================== */

function isProbableVin(s: string): boolean {
  return /^[A-HJ-NPR-Z0-9]{17}$/.test(s.toUpperCase().trim());
}

function isProductCode(s: string): boolean {
  const t = s.toUpperCase().trim();
  if (!PRODUCT_CODE_RE.test(t)) return false;
  if (isProbableVin(t)) return false;
  return true;
}

function isFooterLegendLine(t: string): boolean {
  return (
    /^L\s*-\s*Stan realizacji/i.test(t) ||
    /^-\s*Brak towaru/i.test(t) ||
    /^-\s*Czesc zam[oó]wionego/i.test(t) ||
    /^-\s*Caly zam[oó]wiony/i.test(t) ||
    /^IZ\s*-\s*Ilosc zam[oó]wiona/i.test(t) ||
    /^IW\s*-\s*Ilosc wydana/i.test(t) ||
    /^IR\s*-\s*Ilosc zarezerwowana/i.test(t) ||
    /^ILI\s*-\s*Ilosc w lokalizacji/i.test(t) ||
    /^ILG\s*-\s*Ilosc w lokalizacji/i.test(t) ||
    /^INZ\s*-\s*Ilosc niezrealizowana/i.test(t) ||
    /^IDP\s*-\s*Ilosc do przeniesienia/i.test(t) ||
    /^IK\s*-\s*Ilosc ksiegowa/i.test(t) ||
    /^AP\s*-\s*Anulowanie pozycji/i.test(t) ||
    /^ZR\s*-\s*Zmiana rezerwacji/i.test(t) ||
    /^ZL\s*-\s*Zmiana lokalizacji/i.test(t)
  );
}

function isStructuralHeaderLine(t: string): boolean {
  return (
    /^(Strona|Data|Body\s*Center|Magazyn|Dealer)\b/i.test(t) ||
    /\bLp\b.*\bNr\s*katalogowy\b/i.test(t) ||
    /^Telefony\s*:/i.test(t) ||
    /^[A-Z]\d{3,4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}/i.test(t) ||
    /^Wysylka\//i.test(t) ||
    /^(BRA_SKO|WAJ_SEA)/i.test(t) ||
    /^W[ÓO]ZEK/i.test(t) ||
    /^NIE ZMIENIAC/i.test(t) ||
    /^\d+\.\s*Zam[oó]wienie/i.test(t) ||
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

function extractLastDecimal(text: string): number | null {
  const matches = [...text.matchAll(/(\d{1,8})[,.](\d{1,6})/g)];
  if (matches.length === 0) return null;
  const last = matches[matches.length - 1];
  return parseFloat(`${last[1]}.${last[2]}`);
}

function isClientNameLine(t: string): boolean {
  if (t.length < 3) return false;
  if (/^(ZW|BLWK|ZL|ZLEC|VIN|WDD|Magazyn|Strona|Data|Dealer|Body\s*Center|Telefony)\b/i.test(t))
    return false;
  if (BRAND_LABELS.has(t.trim())) return false;
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

/**
 * Returns true when a short text fragment looks like a warehouse shelf code.
 * Examples: "A1-01", "KOMI-B2", "R12-3", "S01A", "SB12", "kn04"
 * These appear in the location column between INZ and IDP.
 */
function isLocationLike(s: string): boolean {
  const t = s.trim().toUpperCase();
  if (t.length === 0 || t.length > 25) return false;
  // Must be mostly alphanumeric with optional hyphens/slashes, no long words
  return /^[A-Z0-9]{1,10}([-/][A-Z0-9]{1,10}){0,4}$/.test(t);
}

/* ============================================================
 * STAGE 1: Token extraction
 * ========================================================== */

async function extractTokens(buffer: ArrayBuffer): Promise<Token[]> {
  if (typeof (globalThis as any).DOMMatrix === "undefined") {
    (globalThis as any).DOMMatrix = class DOMMatrix {};
  }
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  pdfjsLib.GlobalWorkerOptions.workerSrc = "";
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const tokens: Token[] = [];

  for (let pageNum = 1; pageNum <= doc.numPages; pageNum++) {
    const page = await doc.getPage(pageNum);
    const content = await page.getTextContent({ disableNormalization: false });

    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const transform = item.transform as number[];
      const x0 = transform[4];
      const y1 = transform[5]; // baseline
      const w = (item.width as number) ?? 0;
      const h = (item.height as number) ?? 10;
      tokens.push({
        text: item.str,
        page: pageNum,
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
 * STAGE 2: Visual line reconstruction
 * ========================================================== */

function buildVisualLines(tokens: Token[]): VisualLine[] {
  // Group tokens by (page, Y-bucket).
  // Bucket size 4pt: slightly wider than exact Y so tokens printed at
  // fractionally different baselines land in the same visual row.
  const buckets = new Map<string, Token[]>();

  for (const token of tokens) {
    const yBucket = Math.round(token.y1 / 4) * 4;
    const key = `${token.page}:${yBucket}`;
    const list = buckets.get(key) ?? [];
    list.push(token);
    buckets.set(key, list);
  }

  const lines: VisualLine[] = [];

  for (const [key, tokenList] of buckets) {
    const sorted = tokenList.sort((a, b) => a.x0 - b.x0);

    // Reconstruct text with gap-aware spacing
    let text = "";
    let prevX1: number | null = null;
    for (const t of sorted) {
      const s = t.text.trim();
      if (!s) continue;
      if (!text) {
        text = s;
      } else {
        const gap = prevX1 !== null ? t.x0 - prevX1 : 0;
        // Large horizontal gap = separate columns → pad with two spaces
        text += gap > 25 ? "  " : " ";
        text += s;
      }
      prevX1 = t.x1;
    }
    text = text.replace(/\s+/g, " ").trim();
    if (!text) continue;

    const [pageStr, yStr] = key.split(":");
    lines.push({
      page: parseInt(pageStr, 10),
      y: parseInt(yStr, 10),
      tokens: sorted,
      text,
      x0: sorted[0]?.x0 ?? 0,
      x1: sorted[sorted.length - 1]?.x1 ?? 0,
    });
  }

  // Sort: page ascending, Y descending (PDF Y is bottom-up so higher Y = closer to top)
  lines.sort((a, b) => (a.page !== b.page ? a.page - b.page : b.y - a.y));

  return lines;
}

/* ============================================================
 * STAGE 3: Page layout profiling
 * ========================================================== */

/** Build band definitions from a detected "Lp / Nr katalogowy" header row. */
function layoutFromHeaderLine(hl: VisualLine): PageLayout {
  const findTok = (re: RegExp) => hl.tokens.find((t) => re.test(t.text.trim()));

  const lpTok = findTok(/^Lp$/i);
  const nrTok = findTok(/^Nr$/i) ?? findTok(/^katalogowy$/i);
  const opisTok = findTok(/^Opis$/i) ?? findTok(/^Nazwa$/i);
  const inzTok = findTok(/^INZ$/i);
  const lokTok = findTok(/^(Lok|L)$/i);
  const idpTok = findTok(/^IDP$/i);

  // X-anchors with safe defaults (landscape A4 coordinate space ~30–810pt)
  const lpX = lpTok?.x0 ?? 25;
  const codeX = nrTok?.x0 ?? 55;
  const nameX = opisTok?.x0 ?? 130;
  const qtyX = inzTok?.x0 ?? 370;
  const locX = lokTok?.x0 ?? (idpTok ? idpTok.x0 - 65 : 510);
  const idpX = idpTok?.x0 ?? 575;
  const right = (hl.x1 ?? idpX) + 60;

  return {
    lpBand: [lpX - 5, codeX - 2],
    codeBand: [codeX - 2, nameX - 2],
    nameBand: [nameX - 2, qtyX - 5],
    qtyBand: [qtyX - 5, locX - 5],
    locationBand: [locX - 5, idpX - 5],
    idpBand: [idpX - 5, right],
  };
}

/**
 * Returns a map from page number → PageLayout.
 * Pages without a detected header row are not in the map.
 */
function detectPageLayouts(lines: VisualLine[]): Map<number, PageLayout> {
  const layouts = new Map<number, PageLayout>();
  for (const vl of lines) {
    if (!layouts.has(vl.page) && /\bLp\b.*\bNr\s*katalogowy\b/i.test(vl.text)) {
      layouts.set(vl.page, layoutFromHeaderLine(vl));
    }
  }
  return layouts;
}

/**
 * Find the nearest layout for a given page by scanning forward then backward.
 * Returns null if no layouts exist at all.
 */
function layoutForPage(page: number, layouts: Map<number, PageLayout>): PageLayout | null {
  if (layouts.size === 0) return null;
  if (layouts.has(page)) return layouts.get(page)!;
  // Search nearest page
  let best: PageLayout | null = null;
  let bestDist = Infinity;
  for (const [p, layout] of layouts) {
    const d = Math.abs(p - page);
    if (d < bestDist) {
      bestDist = d;
      best = layout;
    }
  }
  return best;
}

/* ============================================================
 * STAGE 4 helper: Block boundary finding
 * ========================================================== */

interface BlockStart {
  idx: number;
  sectionKind: "wdd" | "zw";
  triggerText: string;
}

function findBlockStarts(lines: VisualLine[], role: "bc" | "brand"): BlockStart[] {
  const starts: BlockStart[] = [];

  for (let i = 0; i < lines.length; i++) {
    const t = lines[i].text;

    if (WDD_NUMBER_RE.test(t)) {
      // Debounce: skip consecutive WDD lines from the same header cluster
      const last = starts[starts.length - 1];
      if (last && last.sectionKind === "wdd" && i - last.idx <= 3) continue;
      starts.push({ idx: i, sectionKind: "wdd", triggerText: t });
    } else if (ZW_NUMBER_RE.test(t)) {
      starts.push({ idx: i, sectionKind: "zw", triggerText: t });
    }
  }

  // BC files mix both WDD and ZW. Brand files have only ZW.
  // If this is a BC file, keep all starts.
  // If brand file, keep only ZW starts (WDD shouldn't appear, but guard anyway).
  if (role === "brand") {
    return starts.filter((s) => s.sectionKind === "zw");
  }
  return starts;
}

/* ============================================================
 * STAGE 5: Block header extraction helpers
 * ========================================================== */

interface BcBlockHeader {
  wddNumber: string | null;
  warehouseSection: string | null;
  groupName: string | null;
}

function extractBcHeader(
  allLines: VisualLine[],
  blockLines: VisualLine[],
  blockStart: number
): BcBlockHeader {
  const headerArea = blockLines.slice(0, Math.min(15, blockLines.length));
  const fullText = headerArea.map((l) => l.text).join(" ");

  const wddM = fullText.match(WDD_NUMBER_RE);
  const wddNumber = wddM ? `WDD/${wddM[1]}` : null;

  const warehouseSection = detectWarehouseSection(fullText);

  // Group name lives in the Wysylka/N/KOM {GROUP} line BEFORE the WDD trigger
  let groupName: string | null = null;
  const wysylkaRE = /Wysylka\/\d+\/KOM\s+([A-Z0-9_]+)/i;
  const lookbackStart = Math.max(0, blockStart - 20);
  for (let gi = blockStart - 1; gi >= lookbackStart; gi--) {
    const m = allLines[gi].text.match(wysylkaRE);
    if (m) {
      groupName = m[1].toUpperCase();
      break;
    }
  }

  return { wddNumber, warehouseSection, groupName };
}

interface BrandBlockHeader {
  zwNumber: string | null;
  zlNumber: string | null;
  blwkNumber: string | null;
  vin: string | null;
  clientName: string | null;
  warehouseSection: string | null;
}

function extractBrandHeader(
  allLines: VisualLine[],
  blockLines: VisualLine[],
  blockStart: number
): BrandBlockHeader {
  const headerArea = blockLines.slice(0, Math.min(15, blockLines.length));
  const headerFull = headerArea.map((l) => l.text).join(" ");

  const zwM = headerFull.match(ZW_NUMBER_RE);
  const zwNumber = zwM ? `ZW/${zwM[1]}` : null;

  const zlM = headerFull.match(/(ZLEC|ZL)\/([^\s]+)/i);
  const zlNumber = zlM ? `${zlM[1].toUpperCase()}/${zlM[2]}` : null;

  const vinM = blockLines[0]?.text.match(/\b([A-Z0-9]{17})\b/i);
  const vin = vinM ? vinM[1].toUpperCase() : null;

  const warehouseSection = detectWarehouseSection(headerFull);

  // BLWK lookback + multi-line client name
  let blwkNumber: string | null = null;
  let clientName: string | null = null;
  const lookbackStart = Math.max(0, blockStart - 10);
  let blwkIdx = -1;

  for (let i = blockStart - 1; i >= lookbackStart; i--) {
    if (/BLWK\s*\/\s*\d+/i.test(allLines[i].text)) {
      blwkIdx = i;
      const blwkM = allLines[i].text.match(/BLWK\s*\/\s*(\d+)/i)!;
      blwkNumber = `BLWK/${blwkM[1]}`;
      break;
    }
  }

  if (blwkIdx >= 0) {
    const nameParts: string[] = [];
    const rawSuffix = allLines[blwkIdx].text.match(/BLWK\s*\/\s*\d+\s*(.*)/i)?.[1]?.trim() ?? "";
    const suffix = stripNameBoilerplate(rawSuffix);
    if (suffix.length >= 2 && isClientNameLine(suffix)) nameParts.push(suffix);

    for (let j = blwkIdx + 1; j < blockStart && nameParts.length < 3; j++) {
      const candidate = stripNameBoilerplate(allLines[j].text.trim());
      if (candidate.length >= 2 && isClientNameLine(candidate)) {
        nameParts.push(candidate);
      } else if (nameParts.length > 0) {
        break;
      }
    }
    if (nameParts.length > 0) clientName = nameParts.join(" ");
  }

  // Fallback: scan header area inside the block
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

  return { zwNumber, zlNumber, blwkNumber, vin, clientName, warehouseSection };
}

/* ============================================================
 * STAGE 6: Table region isolation
 * ========================================================== */

/** Find the index within blockLines where the product table starts. */
function detectTableStart(blockLines: VisualLine[]): number {
  let contentStart = 1;

  for (let i = 1; i < Math.min(40, blockLines.length); i++) {
    const t = blockLines[i].text
      .trim()
      .replace(/^[■●•▪◾◼▮◆◇○◻◼]+\s*/, "")
      .trim();
    const parts = t.split(/\s+/);

    // Lp + code on same line → table starts here
    if (/^\d{1,3}\.?$/.test(parts[0] ?? "") && parts[1] && isProductCode(parts[1].toUpperCase())) {
      return i;
    }

    // Standalone Lp followed by code on next line
    if (/^\d{1,3}\.?$/.test(t) && i + 1 < blockLines.length) {
      const nextFirst =
        blockLines[i + 1].text
          .trim()
          .replace(/^[■●•▪◾◼▮◆◇○◻◼]+\s*/, "")
          .trim()
          .split(/\s+/)[0] ?? "";
      if (isProductCode(nextFirst.toUpperCase())) return i;
    }

    // Code as first token → table starts here
    if (parts[0] && isProductCode(parts[0].toUpperCase())) return i;

    // Known table header line → content begins on next line
    if (/\bLp\b.*\bNr\s*katalogowy\b/i.test(t)) {
      contentStart = i + 1;
      continue;
    }

    if (
      isStructuralHeaderLine(t) ||
      WDD_RECONCILIATION_RE.test(t) ||
      (WDD_NUMBER_RE.test(t) && i > 0)
    ) {
      contentStart = i + 1;
    }
  }

  return contentStart;
}

/* ============================================================
 * STAGE 7: Row reconstruction
 * ========================================================== */

/** Extract name, location, quantity from a VisualLine using column band geometry. */
function extractFromLineGeometry(
  vl: VisualLine,
  layout: PageLayout
): { nameFragments: string[]; locationFragments: string[]; quantity: number | null } {
  const inBand = (t: Token, band: [number, number] | null): boolean => {
    if (!band) return false;
    const cx = (t.x0 + t.x1) / 2;
    return cx >= band[0] && cx < band[1];
  };

  const nameTokens = vl.tokens.filter((t) => inBand(t, layout.nameBand));
  const locTokens = vl.tokens.filter((t) => inBand(t, layout.locationBand));
  const idpTokens = vl.tokens.filter((t) => inBand(t, layout.idpBand));

  const nameFragments = nameTokens.map((t) => t.text.trim()).filter(Boolean);
  const locationFragments = locTokens.map((t) => t.text.trim()).filter(Boolean);
  const idpText = idpTokens.map((t) => t.text.trim()).join(" ");
  const quantity = extractLastDecimal(idpText);

  return { nameFragments, locationFragments, quantity };
}

/**
 * Text-based row extraction (fallback when no PageLayout is available).
 *
 * Row format: [{Lp}] {code} [{name…}] {IZ} {IW} {IR} {INZ} [{location}] {IDP} [{op}]
 * Location = non-numeric text between INZ (4th decimal) and IDP (last decimal).
 */
function extractFromLineText(rowText: string): {
  code: string | null;
  nameFragments: string[];
  locationFragments: string[];
  quantity: number | null;
} {
  const t = rowText.trim();
  if (!t) return { code: null, nameFragments: [], locationFragments: [], quantity: null };

  // Extract product code, possibly preceded by Lp number
  const codeMatch = t.match(/^(?:\d{1,3}\.?\s+)?([A-Z0-9]{5,})\b([\s\S]*)/i);
  if (!codeMatch) return { code: null, nameFragments: [], locationFragments: [], quantity: null };

  const candidate = codeMatch[1].toUpperCase();
  if (!isProductCode(candidate))
    return { code: null, nameFragments: [], locationFragments: [], quantity: null };

  const rest = (codeMatch[2] ?? "").trim();
  const decimals = [...rest.matchAll(/\d+[,.]\d+/g)];

  if (decimals.length === 0) {
    return {
      code: candidate,
      nameFragments: rest ? [rest] : [],
      locationFragments: [],
      quantity: null,
    };
  }

  // Name = text before the first decimal
  const firstDecStart = decimals[0].index!;
  const nameText = rest.slice(0, firstDecStart).trim();

  // IDP = last decimal
  const lastDec = decimals[decimals.length - 1];
  const qty = parseFloat(lastDec[0].replace(",", "."));

  // Location = non-numeric text between INZ (decimals[3]) and IDP (last decimal)
  let locationFragments: string[] = [];
  if (decimals.length >= 5) {
    const inzDec = decimals[3];
    const inzEnd = inzDec.index! + inzDec[0].length;
    const idpStart = lastDec.index!;
    if (inzEnd < idpStart) {
      const locText = rest.slice(inzEnd, idpStart).trim();
      if (locText) locationFragments = [locText];
    }
  }

  return {
    code: candidate,
    nameFragments: nameText ? [nameText] : [],
    locationFragments,
    quantity: Number.isFinite(qty) ? qty : null,
  };
}

/**
 * Detect the product code token at the start of a VisualLine.
 * Returns the code string or null if this line does not start an anchor row.
 */
function detectAnchorCode(vl: VisualLine, layout: PageLayout | null): string | null {
  const baseText = vl.text
    .trim()
    .replace(/^[■●•▪◾◼▮◆◇○◻◼]+\s*/, "")
    .trim();

  if (layout?.codeBand) {
    // Geometry: find first token in the code band
    const [lo, hi] = layout.codeBand;
    for (const tok of vl.tokens) {
      const cx = (tok.x0 + tok.x1) / 2;
      if (cx >= lo && cx < hi) {
        const c = tok.text.toUpperCase().trim();
        if (isProductCode(c)) return c;
        break; // first code-band token is not a product code → not an anchor
      }
    }
    // Also check lpBand followed by codeBand
    if (layout.lpBand) {
      const [lpLo, lpHi] = layout.lpBand;
      const [cdLo, cdHi] = layout.codeBand;
      const hasLp = vl.tokens.some((t) => {
        const cx = (t.x0 + t.x1) / 2;
        return cx >= lpLo && cx < lpHi && /^\d{1,3}$/.test(t.text.trim());
      });
      if (hasLp) {
        const codeInBand = vl.tokens.find((t) => {
          const cx = (t.x0 + t.x1) / 2;
          return cx >= cdLo && cx < cdHi && isProductCode(t.text.toUpperCase().trim());
        });
        if (codeInBand) return codeInBand.text.toUpperCase().trim();
      }
    }
    return null;
  }

  // Text-based anchor detection
  const m = baseText.match(/^(?:\d{1,3}\.?\s+)?([A-Z0-9]{5,})\b/i);
  if (m && isProductCode(m[1].toUpperCase())) return m[1].toUpperCase();
  return null;
}

/**
 * Reconstruct product rows from a block's table region.
 * Each anchor row starts a new ParsedLine; continuation rows append fragments.
 */
function reconstructBlockRows(
  blockLines: VisualLine[],
  tableStart: number,
  layouts: Map<number, PageLayout>
): ParsedLine[] {
  const result: ParsedLine[] = [];
  let lineCounter = 0;

  let currentCode: string | null = null;
  let currentNameFragments: string[] = [];
  let currentLocFragments: string[] = [];
  let currentQuantity: number | null = null;
  let currentRawParts: string[] = [];
  let currentPage: number | null = null;

  function flush() {
    if (!currentCode) return;
    lineCounter++;
    const name = currentNameFragments.join(" ").replace(/\s+/g, " ").trim();
    const loc = currentLocFragments.join(" ").replace(/\s+/g, " ").trim();
    result.push({
      lineNumber: lineCounter,
      productCode: currentCode,
      productName: name || null,
      quantity: currentQuantity,
      unit: null,
      location: loc || null,
      rawText: currentRawParts.join(" ").replace(/\s+/g, " ").trim(),
      rawNameFragments: [...currentNameFragments],
      rawLocationFragments: [...currentLocFragments],
      pageNumber: currentPage,
    });
    currentCode = null;
    currentNameFragments = [];
    currentLocFragments = [];
    currentQuantity = null;
    currentRawParts = [];
    currentPage = null;
  }

  for (let i = tableStart; i < blockLines.length; i++) {
    const vl = blockLines[i];
    const base = vl.text
      .trim()
      .replace(/^[■●•▪◾◼▮◆◇○◻◼]+\s*/, "")
      .trim();
    if (!base) continue;

    // Block boundaries, legend lines, structural headers → flush + skip
    if (
      isStructuralHeaderLine(base) ||
      WDD_NUMBER_RE.test(base) ||
      ZW_NUMBER_RE.test(base) ||
      WDD_RECONCILIATION_RE.test(base) ||
      /^(BLWK|ZL|ZLEC|VIN)[/\s]/i.test(base)
    ) {
      if (isFooterLegendLine(base)) flush();
      continue;
    }

    // Standalone Lp — skip, handled implicitly by next line's anchor detection
    if (/^\d{1,3}\.?$/.test(base)) {
      const lpVal = parseInt(base.replace(/\.$/, ""), 10);
      if (lpVal >= 1 && lpVal <= 999) continue;
    }

    const layout = layoutForPage(vl.page, layouts);
    const anchorCode = detectAnchorCode(vl, layout);

    if (anchorCode) {
      flush();
      currentCode = anchorCode;
      currentPage = vl.page;
      currentRawParts = [base];

      if (layout) {
        const geo = extractFromLineGeometry(vl, layout);
        currentNameFragments = geo.nameFragments;
        currentLocFragments = geo.locationFragments;
        currentQuantity = geo.quantity;
      } else {
        const txt = extractFromLineText(base);
        currentNameFragments = txt.nameFragments;
        currentLocFragments = txt.locationFragments;
        currentQuantity = txt.quantity;
      }
    } else if (currentCode) {
      // Continuation line — append fragments to current anchor
      currentRawParts.push(base);

      if (layout) {
        const geo = extractFromLineGeometry(vl, layout);
        if (geo.nameFragments.length > 0) currentNameFragments.push(...geo.nameFragments);
        if (geo.locationFragments.length > 0) currentLocFragments.push(...geo.locationFragments);
        if (currentQuantity === null && geo.quantity !== null) currentQuantity = geo.quantity;
      } else {
        // Text fallback for continuations:
        // lines with 4+ decimal columns are full rows that leaked in — extract location only
        if (NUMERIC_COLS_RE.test(base)) {
          const locText = extractLocationFromDecimalRow(base);
          if (locText) currentLocFragments.push(locText);
          // Update quantity from this row if we still don't have one
          if (currentQuantity === null) {
            const q = extractLastDecimal(base);
            if (q !== null) currentQuantity = q;
          }
        } else if (isLocationLike(base)) {
          currentLocFragments.push(base);
        } else if (!/^\d+[,.]\d+$/.test(base)) {
          // Pure text continuation → name fragment
          currentNameFragments.push(base);
        }
      }
    }
    // else: text before first anchor in this block — skip
  }

  flush();
  return result;
}

/** Extract location text from a row that has decimal columns. */
function extractLocationFromDecimalRow(rowText: string): string | null {
  const decimals = [...rowText.matchAll(/\d+[,.]\d+/g)];
  if (decimals.length < 5) return null;
  const inzDec = decimals[3];
  const lastDec = decimals[decimals.length - 1];
  const inzEnd = inzDec.index! + inzDec[0].length;
  const idpStart = lastDec.index!;
  if (inzEnd >= idpStart) return null;
  const locText = rowText.slice(inzEnd, idpStart).trim();
  return locText || null;
}

/* ============================================================
 * STAGE 8: Post-row normalization
 * ========================================================== */

function normalizeRows(rows: ParsedLine[]): ParsedLine[] {
  return rows.map((row) => {
    let name = row.productName;
    if (name) {
      name =
        name
          .replace(/\b(BRA_SKO|WAJ_SEA)\b.*$/i, "")
          .replace(/\bNIE ZMIENIAC\b.*$/i, "")
          .replace(/\bW[ÓO]ZEK\s+WYJASNIENIA\b.*$/i, "")
          .replace(/\b(31\s+Audi_BC|31\s+VWO|33\s+Skoda)\b.*$/i, "")
          .replace(/\b(REGAL\s+[A-Z0-9]+|S\d+[A-Z0-9]*|R\d+[A-Z0-9]*|SB\d+[A-Z0-9]*|kn\d+)\b/gi, "")
          .replace(/^\d+[,.]\d+\s+/, "")
          .replace(/\s+/g, " ")
          .replace(/^[-–:,;]+\s*/, "")
          .trim() || null;
    }

    const loc = row.location ? row.location.replace(/\s+/g, " ").trim() || null : null;

    const rawText = row.rawText ? row.rawText.replace(/\s+/g, " ").trim() : null;

    return { ...row, productName: name, location: loc, rawText };
  });
}

/* ============================================================
 * STAGE 9: Block assembly — BC file
 * ========================================================== */

function parseBcBlocks(allLines: VisualLine[], layouts: Map<number, PageLayout>): ParsedBlock[] {
  const starts = findBlockStarts(allLines, "bc");
  const blocks: ParsedBlock[] = [];

  for (let b = 0; b < starts.length; b++) {
    const { idx: start, sectionKind, triggerText } = starts[b];
    const end = b + 1 < starts.length ? starts[b + 1].idx : allLines.length;
    const blockLines = allLines.slice(start, end);
    const pageNumber = blockLines[0]?.page ?? null;

    if (sectionKind === "zw") {
      // Direct order block — parse its lines; mark as direct_order but NOT excluded
      const tableStart = detectTableStart(blockLines);
      const rawLines = reconstructBlockRows(blockLines, tableStart, layouts);
      const lines = normalizeRows(rawLines);

      const zwM = triggerText.match(ZW_NUMBER_RE);
      const zwNumber = zwM ? `ZW/${zwM[1]}` : null;

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
          zw_number: zwNumber,
          parts_count: lines.length,
        },
        lines,
      });
      continue;
    }

    // WDD reconciliation block
    const { wddNumber, warehouseSection, groupName } = extractBcHeader(allLines, blockLines, start);

    const brandLabel = warehouseToBrand(warehouseSection);
    const tableStart = detectTableStart(blockLines);
    const rawLines = reconstructBlockRows(blockLines, tableStart, layouts);
    const lines = normalizeRows(rawLines);

    // Debug logging for hard-to-match WDD blocks
    const DEBUG_WDD = ["WDD/969", "WDD/1003", "WDD/1036"];
    if (wddNumber && DEBUG_WDD.some((d) => wddNumber.startsWith(d))) {
      console.log(
        `[WDD-DEBUG] ${wddNumber}: tableStart=${tableStart}, blockLines=${blockLines.length}, rows=${lines.length}, group=${groupName}`
      );
      blockLines
        .slice(0, 25)
        .forEach((l, i) => console.log(`  blockLine[${i}] y=${l.y}: "${l.text}"`));
      lines.forEach((r) =>
        console.log(`  row: code=${r.productCode} qty=${r.quantity} loc=${r.location}`)
      );
    }

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
 * STAGE 9: Block assembly — Brand (ORDER) file
 * ========================================================== */

function parseBrandBlocks(allLines: VisualLine[], layouts: Map<number, PageLayout>): ParsedBlock[] {
  const starts = findBlockStarts(allLines, "brand");
  const blocks: ParsedBlock[] = [];

  for (let b = 0; b < starts.length; b++) {
    const { idx: start, triggerText } = starts[b];
    const end = b + 1 < starts.length ? starts[b + 1].idx : allLines.length;
    const blockLines = allLines.slice(start, end);
    const pageNumber = blockLines[0]?.page ?? null;

    const { zwNumber, zlNumber, blwkNumber, vin, clientName, warehouseSection } =
      extractBrandHeader(allLines, blockLines, start);

    const brandLabel = warehouseToBrand(warehouseSection);

    // 415 = mirror section — previously excluded, now emitted with candidateKind="mirror"
    const candidateKind: ParsedBlock["candidateKind"] =
      warehouseSection === "415" ? "mirror" : "brand_order";

    const tableStart = detectTableStart(blockLines);
    const rawLines = reconstructBlockRows(blockLines, tableStart, layouts);
    const lines = normalizeRows(rawLines);

    // Debug logging for ORDER blocks targeted by failing WDD blocks
    const DEBUG_ZW = ["ZW/267", "ZW/429", "ZW/284"];
    if (zwNumber && DEBUG_ZW.some((d) => zwNumber.startsWith(d))) {
      console.log(
        `[ZW-DEBUG] ${zwNumber}: candidateKind=${candidateKind}, warehouseSection=${warehouseSection}, rows=${lines.length}, client=${clientName}`
      );
      lines.forEach((r) =>
        console.log(`  row: code=${r.productCode} qty=${r.quantity} loc=${r.location}`)
      );
    }

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
 * MAIN ENTRY POINT
 * ========================================================== */

export async function parsePdfAuto(buffer: ArrayBuffer): Promise<ParseResult> {
  // Stage 1 + 2: extract tokens → visual lines
  const tokens = await extractTokens(buffer);
  const visualLines = buildVisualLines(tokens);

  // Stage 3: page layout profiling
  const layouts = detectPageLayouts(visualLines);

  // Detect file role from WDD vs ZW trigger count
  const fullText = visualLines.map((l) => l.text).join("\n");
  const wddCount = (fullText.match(/WDD\/\d+/gi) ?? []).length;
  const zwCount = (fullText.match(/ZW\/\d+/gi) ?? []).length;
  const detectedRole: "bc" | "brand" = wddCount >= zwCount ? "bc" : "brand";

  // Stages 4–9: block assembly
  const blocks =
    detectedRole === "bc"
      ? parseBcBlocks(visualLines, layouts)
      : parseBrandBlocks(visualLines, layouts);

  return { detectedRole, blocks };
}
