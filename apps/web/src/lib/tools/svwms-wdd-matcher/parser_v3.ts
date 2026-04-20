/**
 * SVWMS WDD Matcher — Block Template Parser V3
 *
 * This parser treats the PDFs as a generated document family with a fixed
 * grammar instead of trying to salvage free text after the fact.
 *
 * Core principles:
 * - detect logical blocks first (`WDD/...`, `ZW/...`)
 * - parse headers from nearby structured lines
 * - detect table headers explicitly
 * - reconstruct rows from column ownership + anchor product codes
 * - keep lossless per-row cell provenance for debugging
 */

export interface TokenV3 {
  text: string;
  page: number;
  x0: number;
  x1: number;
  y0: number;
  y1: number;
  width: number;
  height: number;
}

interface VisualRow {
  page: number;
  y: number;
  tokens: TokenV3[];
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

export interface CellFragmentV3 {
  text: string;
  column: ColumnName;
  x0: number;
  x1: number;
  y: number;
  page: number;
}

export interface ParsedLineV3 {
  lineNumber: number;
  productCode: string | null;
  productName: string | null;
  quantity: number | null;
  unit: string | null;
  location: string | null;
  rawText: string | null;
  rawNameFragments: string[];
  rawLocationFragments: string[];
  pageNumber: number | null;
  operationCode: string | null;
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  rawCells: CellFragmentV3[];
}

export interface ParsedBlockV3 {
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
  metadata: Record<string, unknown>;
  lines: ParsedLineV3[];
}

export interface ParseResultV3 {
  detectedRole: "bc" | "brand";
  blocks: ParsedBlockV3[];
}

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

interface RawTableRow {
  codeText: string | null;
  lpText: string | null;
  nameFragments: string[];
  locationFragments: string[];
  iz: number | null;
  iw: number | null;
  ir: number | null;
  inz: number | null;
  idp: number | null;
  opText: string | null;
  pageNumber: number | null;
  rawCells: CellFragmentV3[];
}

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

function normalizeText(value: string): string {
  return value.replace(/\s+/g, " ").trim();
}

function detectWarehouseSection(text: string): string | null {
  const match = text.match(/\b(115|315|415|515)\b/);
  return match ? match[1] : null;
}

function warehouseToBrand(section: string | null): string | null {
  return section ? (WAREHOUSE_MAP[section] ?? null) : null;
}

function isVin(value: string): boolean {
  return VIN_RE.test(value.trim().toUpperCase());
}

function isProductCode(value: string): boolean {
  const token = value.trim().toUpperCase();
  return PRODUCT_CODE_RE.test(token) && !isVin(token);
}

function extractLastDecimal(value: string): number | null {
  const matches = value.match(DECIMAL_RE);
  if (!matches?.length) return null;
  const raw = matches[matches.length - 1].replace(",", ".");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}

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
    /^VGP\b/i.test(text) ||
    /^NIE ZMIENIAC\b/i.test(text) ||
    isDateStampRow(text) ||
    isPageFooterRow(text) ||
    isLegendRow(text)
  );
}

function isLikelyClientLine(text: string): boolean {
  if (text.length < 3) return false;
  if (isStructuralHeaderRow(text)) return false;
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

async function extractTokens(buffer: ArrayBuffer): Promise<TokenV3[]> {
  const pdfjsLib = (await import("pdfjs-dist/legacy/build/pdf.mjs")) as any;
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false,
  }).promise;

  const tokens: TokenV3[] = [];

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

function buildRows(tokens: TokenV3[]): VisualRow[] {
  const buckets = new Map<string, TokenV3[]>();

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
    const distance = Math.abs(bandPage - page);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = bands;
    }
  }
  return best;
}

function assignColumn(token: TokenV3, bands: ColumnBands): ColumnName {
  const centerX = (token.x0 + token.x1) / 2;
  for (const column of Object.keys(bands) as (keyof ColumnBands)[]) {
    const [from, to] = bands[column];
    if (centerX >= from && centerX < to) return column;
  }
  return "unclassified";
}

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

  return role === "brand" ? starts.filter((start) => start.sectionKind === "zw") : starts;
}

function sliceContext(rows: VisualRow[], start: number, radius: number): VisualRow[] {
  return rows.slice(Math.max(0, start - radius), Math.min(rows.length, start + radius + 1));
}

function findNearestBackward(
  rows: VisualRow[],
  start: number,
  radius: number,
  matcher: (row: VisualRow) => boolean
): { row: VisualRow; index: number } | null {
  for (let index = start - 1; index >= Math.max(0, start - radius); index -= 1) {
    if (matcher(rows[index])) return { row: rows[index], index };
  }
  return null;
}

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

function extractClientName(contextRows: VisualRow[]): string | null {
  const parts: string[] = [];

  for (const row of contextRows) {
    const text = row.text;
    if (!isLikelyClientLine(text)) continue;
    parts.push(text);
    if (parts.length >= 2) break;
  }

  if (!parts.length) return null;
  return normalizeText(parts.join(" "))
    .replace(/\s+Blacharnia\s+D\d+\b.*$/i, "")
    .replace(/\s+2\.\s*Zam[oó]wienie.*$/i, "")
    .trim();
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

function findTableHeaderIndex(blockRows: VisualRow[]): number {
  for (let index = 0; index < Math.min(blockRows.length, 30); index += 1) {
    if (isTableHeaderRow(blockRows[index].text)) return index;
  }
  return -1;
}

function buildRawTableRows(
  blockRows: VisualRow[],
  bandMap: Map<number, ColumnBands>
): RawTableRow[] {
  const headerIndex = findTableHeaderIndex(blockRows);
  if (headerIndex < 0) return [];

  const tableRows = blockRows.slice(headerIndex + 1);
  const collected: Array<{ token: TokenV3; page: number; y: number; column: ColumnName }> = [];

  for (const row of tableRows) {
    const text = row.text;
    if (!text) continue;
    if (isTableHeaderRow(text)) continue;
    if (WDD_NUMBER_RE.test(text) || ZW_NUMBER_RE.test(text)) continue;
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
      });
    }
  }

  if (!collected.length) return [];

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
  if (!anchors.length) return [];

  const rowBands: RowBand[] = anchors.map((anchor, index) => {
    let previousY: number | null = null;
    for (let pointer = index - 1; pointer >= 0; pointer -= 1) {
      if (anchors[pointer].page === anchor.page) {
        previousY = anchors[pointer].y;
        break;
      }
    }

    let nextY: number | null = null;
    for (let pointer = index + 1; pointer < anchors.length; pointer += 1) {
      if (anchors[pointer].page === anchor.page) {
        nextY = anchors[pointer].y;
        break;
      }
    }

    return {
      page: anchor.page,
      topY: previousY == null ? anchor.y + 24 : (previousY + anchor.y) / 2,
      bottomY: nextY == null ? anchor.y - 24 : (anchor.y + nextY) / 2,
    };
  });

  const rowCells = anchors.map(() => new Map<ColumnName, TokenV3[]>());
  const rawCells = anchors.map(() => [] as CellFragmentV3[]);

  function findBandIndex(page: number, y: number): number {
    for (let index = 0; index < rowBands.length; index += 1) {
      const band = rowBands[index];
      if (band.page === page && y > band.bottomY && y <= band.topY) return index;
    }
    return -1;
  }

  for (const entry of collected) {
    const bandIndex = findBandIndex(entry.page, entry.y);
    if (bandIndex < 0) continue;
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
  }

  function sortCellTokens(tokens: TokenV3[]): TokenV3[] {
    return [...tokens].sort((a, b) => (Math.abs(b.y1 - a.y1) > 2 ? b.y1 - a.y1 : a.x0 - b.x0));
  }

  function cellText(cells: Map<ColumnName, TokenV3[]>, column: ColumnName): string {
    return normalizeText(
      sortCellTokens(cells.get(column) ?? [])
        .map((token) => token.text.trim())
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

  const rows: RawTableRow[] = [];

  for (let index = 0; index < anchors.length; index += 1) {
    const cells = rowCells[index];
    const codeToken = sortCellTokens(cells.get("code") ?? []).find((token) =>
      isProductCode(token.text.toUpperCase())
    );
    if (!codeToken) continue;

    const nameFragments = dedupFragments(
      sortCellTokens(cells.get("name") ?? [])
        .map((token) => token.text.trim())
        .filter(Boolean)
    );
    const locationFragments = dedupFragments(
      sortCellTokens(cells.get("location") ?? [])
        .map((token) => token.text.trim())
        .filter(Boolean)
    );

    rows.push({
      codeText: codeToken.text.trim().toUpperCase(),
      lpText: cellText(cells, "lp") || null,
      nameFragments,
      locationFragments,
      iz: extractLastDecimal(cellText(cells, "iz")),
      iw: extractLastDecimal(cellText(cells, "iw")),
      ir: extractLastDecimal(cellText(cells, "ir")),
      inz: extractLastDecimal(cellText(cells, "inz")),
      idp: extractLastDecimal(cellText(cells, "idp")),
      opText: cellText(cells, "op") || null,
      pageNumber: anchors[index].page,
      rawCells: rawCells[index],
    });
  }

  return rows;
}

function buildParsedLines(rawRows: RawTableRow[]): ParsedLineV3[] {
  return rawRows.map((row, index) => ({
    lineNumber: index + 1,
    productCode: row.codeText,
    productName: normalizeText(row.nameFragments.join(" ")) || null,
    quantity: row.idp,
    unit: null,
    location: normalizeText(row.locationFragments.join(" ")) || null,
    rawText:
      normalizeText(
        [...row.rawCells]
          .sort((a, b) => (Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0))
          .map((cell) => cell.text)
          .join(" ")
      ) || null,
    rawNameFragments: [...row.nameFragments],
    rawLocationFragments: [...row.locationFragments],
    pageNumber: row.pageNumber,
    operationCode: row.opText,
    iz: row.iz,
    iw: row.iw,
    ir: row.ir,
    inz: row.inz,
    rawCells: row.rawCells,
  }));
}

function parseBcBlock(
  rows: VisualRow[],
  blockStart: BlockStart,
  blockRows: VisualRow[],
  bandMap: Map<number, ColumnBands>,
  blockIndex: number
): ParsedBlockV3 {
  const beforeRows = rows.slice(Math.max(0, blockStart.idx - 8), blockStart.idx);
  const nearbyRows = [...beforeRows, ...blockRows.slice(0, 12)];
  const warehouseSection = extractWarehouse(nearbyRows);
  const brandLabel = warehouseToBrand(warehouseSection);
  const lines = buildParsedLines(buildRawTableRows(blockRows, bandMap));

  if (blockStart.sectionKind === "zw") {
    return {
      blockIndex,
      blockType: "direct_order",
      sourceRole: "bc",
      sectionKind: "zw",
      candidateKind: "direct_order",
      isExcluded: false,
      header: blockStart.triggerText,
      warehouseSection,
      warehouseCode: warehouseSection,
      brandLabel,
      pageNumber: blockRows[0]?.page ?? null,
      metadata: {
        bc_internal_zw: true,
        zw_number: extractHeaderValue(nearbyRows, ZW_NUMBER_RE),
        order_number: extractBlwk(beforeRows),
        vin: extractVin(nearbyRows),
        zl_number: extractZl(nearbyRows),
        client_name: extractClientName(nearbyRows),
        parts_count: lines.length,
      },
      lines,
    };
  }

  return {
    blockIndex,
    blockType: "wdd_reconciliation",
    sourceRole: "bc",
    sectionKind: "wdd",
    candidateKind: "wdd_reconciliation",
    isExcluded: false,
    header: blockStart.triggerText,
    warehouseSection,
    warehouseCode: warehouseSection,
    brandLabel,
    pageNumber: blockRows[0]?.page ?? null,
    metadata: {
      wdd_number: extractHeaderValue(nearbyRows, WDD_NUMBER_RE),
      group_name: extractGroupName(beforeRows),
      parts_count: lines.length,
    },
    lines,
  };
}

function parseBrandBlock(
  rows: VisualRow[],
  blockStart: BlockStart,
  blockRows: VisualRow[],
  bandMap: Map<number, ColumnBands>,
  blockIndex: number
): ParsedBlockV3 {
  const beforeRows = rows.slice(Math.max(0, blockStart.idx - 12), blockStart.idx);
  const nearbyRows = [...beforeRows, ...blockRows.slice(0, 12)];
  const warehouseSection = extractWarehouse(nearbyRows);
  const brandLabel = warehouseToBrand(warehouseSection);
  const lines = buildParsedLines(buildRawTableRows(blockRows, bandMap));
  const candidateKind: ParsedBlockV3["candidateKind"] =
    warehouseSection === "415" ? "mirror" : "brand_order";

  const blwkSource = findNearestBackward(rows, blockStart.idx, 12, (row) => BLWK_RE.test(row.text));
  const clientWindow = rows.slice(
    blwkSource ? blwkSource.index : Math.max(0, blockStart.idx - 6),
    Math.min(rows.length, blockStart.idx + 8)
  );

  return {
    blockIndex,
    blockType: "brand_order",
    sourceRole: "brand",
    sectionKind: "zw",
    candidateKind,
    isExcluded: false,
    header: blockStart.triggerText,
    warehouseSection,
    warehouseCode: warehouseSection,
    brandLabel,
    pageNumber: blockRows[0]?.page ?? null,
    metadata: {
      zw_number: extractHeaderValue(nearbyRows, ZW_NUMBER_RE),
      zl_number: extractZl(nearbyRows),
      order_number: extractBlwk(beforeRows),
      vin: extractVin(nearbyRows),
      client_name: extractClientName(clientWindow),
      parts_count: lines.length,
    },
    lines,
  };
}

export async function parsePdfAutoV3(buffer: ArrayBuffer): Promise<ParseResultV3> {
  const tokens = await extractTokens(buffer);
  const rows = buildRows(tokens);
  const bandMap = detectBandsByPage(rows);
  const detectedRole = detectRole(rows);
  const starts = findBlockStarts(rows, detectedRole);

  const blocks: ParsedBlockV3[] = [];

  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const end = index + 1 < starts.length ? starts[index + 1].idx : rows.length;
    const blockRows = rows.slice(start.idx, end);
    if (!blockRows.length) continue;

    blocks.push(
      detectedRole === "bc"
        ? parseBcBlock(rows, start, blockRows, bandMap, index)
        : parseBrandBlock(rows, start, blockRows, bandMap, index)
    );
  }

  return { detectedRole, blocks };
}
