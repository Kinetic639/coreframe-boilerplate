const STRICT_PRODUCT_CODE_RE = /^([0-9][0-9A-Z]{4,}|[A-Z]{1,4}[0-9][0-9A-Z]{3,})$/;
const ACCEPTED_CATALOG_TOKEN_RE = /^[A-ZĄĆĘŁŃÓŚŹŻ][A-ZĄĆĘŁŃÓŚŹŻ0-9_/-]{7,}$/i;
const CODE_CANDIDATE_RE = /^[A-ZĄĆĘŁŃÓŚŹŻ0-9_./-]{8,}$/i;
const VIN_RE = /\b([A-HJ-NPR-Z0-9]{17})\b/i;
const WDD_NUMBER_RE = /\bWDD\/(\d+(?:\/\d+\/\d+)*)\b/i;
const ZW_NUMBER_RE = /\bZW\/(\d+(?:\/\d+\/\d+)*)\b/i;
const ZL_NUMBER_RE = /\b(ZLEC|ZL)\/([^\s]+)/i;
const BLWK_RE = /\bBLWK\/(\d+)\b/i;
const DECIMAL_RE = /-?\d{1,8}[,.]\d{1,6}/g;
const WAREHOUSE_MAP = {
  "115": "VW",
  "315": "Skoda",
  "415": "Mirror",
  "515": "Seat"
};
const DEFAULT_BANDS = {
  lp: [18, 48],
  code: [48, 130],
  name: [130, 285],
  iz: [285, 322],
  iw: [322, 354],
  ir: [354, 390],
  inz: [390, 432],
  location: [432, 520],
  idp: [520, 562],
  op: [562, 900]
};
function normalizeText(value) {
  return value.replace(/\s+/g, " ").trim();
}
function isVin(value) {
  return VIN_RE.test(value.trim().toUpperCase());
}
function classifyProductCode(value) {
  const raw = value.trim();
  const token = raw.toUpperCase();
  if (!token || isVin(token)) return null;
  if (STRICT_PRODUCT_CODE_RE.test(token)) return "strict_product_code";
  if (raw === token && ACCEPTED_CATALOG_TOKEN_RE.test(token)) return "accepted_catalog_token";
  if (raw === token && CODE_CANDIDATE_RE.test(token) && /[A-ZĄĆĘŁŃÓŚŹŻ]/i.test(token)) {
    return "unrecognized_code_candidate";
  }
  return null;
}
function isProductCode(value) {
  return classifyProductCode(value) !== null;
}
function isDecimalToken(text) {
  const v = text.trim();
  return /^[-–+]?[\d]+[.,][\d]+$/.test(v) || /^[-–+]$/.test(v);
}
function extractLastDecimal(value) {
  const matches = value.match(DECIMAL_RE);
  if (!matches?.length) return null;
  const raw = matches[matches.length - 1].replace(",", ".");
  const parsed = Number.parseFloat(raw);
  return Number.isFinite(parsed) ? parsed : null;
}
function formatDecimal(value) {
  if (value === null || !Number.isFinite(value)) return "";
  return value.toFixed(2).replace(".", ",");
}
function parseLp(text) {
  if (!text) return null;
  const n = Number.parseInt(text.trim(), 10);
  return Number.isFinite(n) && n > 0 ? n : null;
}
function detectWarehouseSection(text) {
  const match = text.match(/\b(115|315|415|515)\b/);
  return match ? match[1] : null;
}
function warehouseToBrand(section) {
  return section ? WAREHOUSE_MAP[section] ?? null : null;
}
function isPageFooterRow(text) {
  return /^Strona\b/i.test(text);
}
function isDateStampRow(text) {
  return /^[A-Z]\d{3,4}\s*-\s*\d{2}\.\d{2}\.\d{4}/i.test(text);
}
function isTableHeaderRow(text) {
  return /\bNr\s*katalogowy\b/i.test(text) || /\bLp\b.*\bNr\s*katalogowy\b/i.test(text);
}
function isLegendRow(text) {
  return /^L\s*-\s*Stan realizacji/i.test(text) || /^-\s*Brak towaru/i.test(text) || /^-\s*Czesc zam[oó]wionego/i.test(text) || /^-\s*Caly zam[oó]wiony/i.test(text) || /^(IZ|IW|IR|ILI|ILG|INZ|IDP|IK|AP|ZR|ZL)\s*-\s*/i.test(text);
}
function isTimestampLine(text) {
  return /^[A-Z]\d{3,4}\s*[-–]\s*\d{2}\.\d{2}\.\d{4}/i.test(text);
}
function isWarehouseInfoRow(text) {
  return /^Dealer\b/i.test(text) || /^Body\s*Center\b/i.test(text) || /^Magazyn\b/i.test(text) || /\bMagazyn\s+\d{3}\b/i.test(text);
}
function isDepartmentCodeRow(text) {
  return /^(31\s+VWO|32\s+Seat|33\s+Skoda|31\s+Audi_BC)\b/i.test(text) || /^\d{2}\s+[A-Z_]{3,}$/i.test(text);
}
function isBlockTitleLine(text) {
  return /^2\.\s*Zam[oó]wienie/i.test(text) || /^99\.\s*Zam[oó]wienie/i.test(text) || /^Blacharnia\s+D\d+\b/i.test(text);
}
function isVinZwHeaderRow(text) {
  return ZW_NUMBER_RE.test(text) || WDD_NUMBER_RE.test(text) || VIN_RE.test(text) && ZL_NUMBER_RE.test(text);
}
function isStructuralHeaderRow(text) {
  return /^99\.\s*Zam[oó]wienie\s+WDD/i.test(text) || /^2\.\s*Zam[oó]wienie/i.test(text) || /^Wysylka\//i.test(text) || /^Telefony\s*:/i.test(text) || /^(Body\s*Center|Dealer|Magazyn)\b/i.test(text) || /^Audi_BC$/i.test(text) || /^31\s+Audi_BC$/i.test(text) || /^31\s+VWO$/i.test(text) || /^32\s+Seat$/i.test(text) || /^33\s+Skoda$/i.test(text) || /^BRA_SKO\b/i.test(text) || /^WAJ_SEA\b/i.test(text) || // Note: ^VGP\b intentionally omitted — VGP is a client org abbreviation
  /^NIE ZMIENIAC\b/i.test(text) || isDateStampRow(text) || isPageFooterRow(text) || isLegendRow(text);
}
function cleanGroupName(text) {
  const normalized = normalizeText(text).replace(/\s*-\s*NIE ZMIENIAC.*$/i, "").replace(/\(\d+\)\s*$/i, "").trim();
  return normalized || null;
}
function extractSignedIdp(raw) {
  const trimmed = raw.trim();
  if (!trimmed) return { raw: trimmed, value: null, abs: null };
  const splitMatch = trimmed.match(/^([-–+])\s+([\d]+[,.][\d]+)$/);
  if (splitMatch) {
    const sign = splitMatch[1] === "+" ? 1 : -1;
    const absVal = Number.parseFloat(splitMatch[2].replace(",", "."));
    if (Number.isFinite(absVal)) {
      return { raw: trimmed, value: sign * absVal, abs: absVal };
    }
  }
  const directMatch = trimmed.match(/^([-–+]?)([\d]+[,.][\d]+)$/);
  if (directMatch) {
    const sign = directMatch[1] === "-" || directMatch[1] === "\u2013" ? -1 : 1;
    const absVal = Number.parseFloat(directMatch[2].replace(",", "."));
    if (Number.isFinite(absVal)) {
      return { raw: trimmed, value: sign * absVal, abs: absVal };
    }
  }
  const decimalMatches = trimmed.match(DECIMAL_RE);
  if (decimalMatches?.length) {
    const lastDecStr = decimalMatches[decimalMatches.length - 1];
    const parsed = Number.parseFloat(lastDecStr.replace(",", "."));
    if (Number.isFinite(parsed)) {
      const beforeDec = trimmed.substring(0, trimmed.lastIndexOf(lastDecStr));
      const hasLeadingMinus = /[-–]/.test(beforeDec) && !decimalMatches.some((m) => m.startsWith("-"));
      const value = hasLeadingMinus && parsed >= 0 ? -parsed : parsed;
      return { raw: trimmed, value, abs: Math.abs(value) };
    }
  }
  return { raw: trimmed, value: null, abs: null };
}
function computeMovementDirection(idpValue) {
  if (idpValue === null) return null;
  return idpValue < 0 ? "correction" : "in";
}
function isLikelyOperationCode(text) {
  const value = text.trim().toUpperCase();
  return /^(ZR|ZW|OP|K|IK|AP|ZL|L)$/.test(value);
}
function isLikelyLocationToken(text) {
  const value = text.trim();
  if (!value) return false;
  if (/^[A-Z]\d{1,3}[A-Z]?$/i.test(value)) return true;
  if (/^[A-Z]+\d+[A-Z0-9]*$/i.test(value)) return true;
  if (/^\d+[A-Z]+$/i.test(value)) return true;
  return false;
}
function detectSuspiciousLocationReason(location) {
  if (!location) return null;
  const normalized = normalizeText(location);
  if (!normalized) return null;
  if (/^\d{1,2}$/.test(normalized)) return "location_is_lone_digit";
  if (/^[A-Z]$/i.test(normalized)) return "location_is_single_letter";
  return null;
}
function detectTruncatedName(nameFragments) {
  const name = normalizeText(nameFragments.join(" "));
  if (!name) return false;
  const lastToken = name.split(/\s+/).pop() ?? "";
  if (/^(ws|dl|przyczepn\.)$/i.test(lastToken)) return true;
  return false;
}
function isNameConnectorToken(text) {
  return /^[-–/'"(),.]$/.test(text.trim());
}
function isNameNumericPrefixToken(text) {
  const value = text.trim();
  return /^\d+$/.test(value) || /^\d+[-–]$/.test(value);
}
function stripTrailingDepartmentMarker(fragments) {
  const result = [...fragments];
  const departmentNames = /^(Audi_BC|VWO|Seat|Skoda)$/i;
  while (result.length >= 2) {
    const last = result[result.length - 1];
    const previous = result[result.length - 2];
    if (departmentNames.test(last) && /^\d{2}$/.test(previous)) {
      result.pop();
      result.pop();
      continue;
    }
    break;
  }
  return result;
}
function buildNameFragments(cells) {
  const merged = [];
  for (let index = 0; index < cells.length; index += 1) {
    const value = cells[index].text.trim();
    if (!value) continue;
    if (isNameConnectorToken(value)) {
      const prev = merged[merged.length - 1];
      if (!prev) continue;
      if (/^[-–]$/.test(value)) {
        if (/\d$/.test(prev)) {
          merged[merged.length - 1] = `${prev}${value}`;
        } else {
          merged.push(value);
        }
      } else {
        merged[merged.length - 1] = `${prev}${value}`;
      }
      continue;
    }
    if (isNameNumericPrefixToken(value)) {
      const next = cells[index + 1]?.text.trim() ?? "";
      if (/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(next)) merged.push(value);
      continue;
    }
    if (merged.length > 0 && (/[/'"(]$/.test(merged[merged.length - 1]) || /\d[-–]$/.test(merged[merged.length - 1]))) {
      merged[merged.length - 1] = `${merged[merged.length - 1]}${value}`;
      continue;
    }
    if (merged[merged.length - 1] === "-" || merged[merged.length - 1] === "\u2013") {
      merged.push(value);
      continue;
    }
    merged.push(value);
  }
  const deduped = [];
  for (const value of merged) {
    if (!value) continue;
    if (deduped[deduped.length - 1] !== value) deduped.push(value);
  }
  return stripTrailingDepartmentMarker(deduped);
}
function extractWddGroupFields(rows) {
  let shipmentRaw = null;
  let shipmentCode = null;
  let groupSourceLabel = null;
  let groupNameNormalized = null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const text = normalizeText(rows[index].text);
    if (!shipmentRaw && /^Wysylka\/\d+\/\S+/i.test(text)) {
      shipmentRaw = text;
      const match = text.match(/^Wysylka\/(.+)$/i);
      shipmentCode = match ? match[1] : null;
    }
    if (!groupSourceLabel && /^(BRA_SKO|WAJ_SEA)\b/i.test(text)) {
      groupSourceLabel = text;
      groupNameNormalized = cleanGroupName(text);
    }
  }
  return {
    groupNameNormalized,
    groupSourceLabel,
    shipmentCode,
    shipmentRaw
  };
}
function detectDocumentBrand(rows) {
  for (const row of rows.slice(0, 20)) {
    if (/Dealer\s+Seat/i.test(row.text)) return "Seat";
    if (/Dealer\s+VW/i.test(row.text)) return "VW";
    if (/Dealer\s+Skoda/i.test(row.text)) return "Skoda";
    if (/Body\s*Center/i.test(row.text)) return "BC";
  }
  return "unknown";
}
function extractWarehouseSectionInfo(rows) {
  for (const row of rows) {
    const full = row.text.match(/Magazyn\s+(\d+)\s*\(([^)]+)\)/i);
    if (full) return { code: full[1], label: full[2].trim().toLowerCase() };
    const codeOnly = row.text.match(/Magazyn\s+(\d{3})\b/i);
    if (codeOnly) {
      return {
        code: codeOnly[1],
        label: WAREHOUSE_MAP[codeOnly[1]] ?? null
      };
    }
    for (const token of row.tokens) {
      const code = detectWarehouseSection(token.text);
      if (code) return { code, label: WAREHOUSE_MAP[code] ?? null };
    }
  }
  return { code: null, label: null };
}
function computeLogicalOrderFamily(sectionKind, warehouseCode, sourceRole) {
  if (sectionKind === "wdd") return "wdd";
  if (warehouseCode === "415") return "mirror";
  if (sourceRole === "bc") return "bc_direct";
  return "standard";
}
function normalizeBlockHeader(raw) {
  if (!raw) return null;
  const normalized = raw.replace(/^\d+\.?\s+(?=WDD\/|ZW\/)/i, "").trim();
  return normalized || raw;
}
function clamp01(value) {
  return Math.max(0, Math.min(1, value));
}
function validationSummary(status, reasons) {
  if (status === "trusted") return "Clean extraction; all hard automation checks passed.";
  if (status === "failed") return `Extraction failed hard checks: ${reasons.join(", ")}.`;
  return `Extraction requires review: ${reasons.join(", ")}.`;
}
function tokenCoverage(totalCollectedTokens, totalAssignedTokens) {
  const unassignedTokens = Math.max(0, totalCollectedTokens - totalAssignedTokens);
  return {
    totalCollectedTokens,
    totalAssignedTokens,
    unassignedTokens,
    coverageRatio: totalCollectedTokens > 0 ? totalAssignedTokens / totalCollectedTokens : 1
  };
}
async function extractTokens(buffer) {
  const pdfjsLib = await import("pdfjs-dist/legacy/build/pdf.mjs");
  const doc = await pdfjsLib.getDocument({
    data: new Uint8Array(buffer),
    disableWorker: true,
    useSystemFonts: true,
    isEvalSupported: false
  }).promise;
  const tokens = [];
  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent({ disableNormalization: false });
    for (const item of content.items) {
      if (!("str" in item) || !item.str?.trim()) continue;
      const transform = item.transform;
      const x0 = transform[4];
      const y1 = transform[5];
      const width = item.width ?? 0;
      const height = item.height ?? 10;
      tokens.push({
        text: item.str,
        page: pageNumber,
        x0,
        x1: x0 + width,
        y0: y1 - height,
        y1,
        width,
        height
      });
    }
  }
  return tokens;
}
function buildRows(tokens) {
  const buckets = /* @__PURE__ */ new Map();
  for (const token of tokens) {
    const yBucket = Math.round(token.y1 / 2) * 2;
    const key = `${token.page}:${yBucket}`;
    const items = buckets.get(key) ?? [];
    items.push(token);
    buckets.set(key, items);
  }
  const rows = [];
  for (const [key, bucketTokens] of buckets) {
    const sorted = bucketTokens.sort((a, b) => a.x0 - b.x0);
    const fragments = [];
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
      text: normalized
    });
  }
  rows.sort((a, b) => a.page !== b.page ? a.page - b.page : b.y - a.y);
  return rows;
}
function detectBandsFromHeaderRow(row) {
  const findToken = (matcher) => row.tokens.find((token) => matcher.test(token.text.trim()));
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
    op: [opX - 4, 900]
  };
}
function detectBandsByPage(rows) {
  const result = /* @__PURE__ */ new Map();
  for (const row of rows) {
    if (!result.has(row.page) && isTableHeaderRow(row.text)) {
      result.set(row.page, detectBandsFromHeaderRow(row));
    }
  }
  return result;
}
function bandsForPage(page, bandMap) {
  if (bandMap.has(page)) return bandMap.get(page);
  if (bandMap.size === 0) return DEFAULT_BANDS;
  let best = DEFAULT_BANDS;
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
function assignColumn(token, bands) {
  const centerX = (token.x0 + token.x1) / 2;
  for (const column of Object.keys(bands)) {
    const [from, to] = bands[column];
    if (centerX >= from && centerX < to) return column;
  }
  return "unclassified";
}
function detectRole(rows) {
  const fullText = rows.map((row) => row.text).join("\n");
  const wddCount = (fullText.match(/WDD\/\d+/gi) ?? []).length;
  const zwCount = (fullText.match(/ZW\/\d+/gi) ?? []).length;
  if (wddCount > zwCount) return "bc";
  if (zwCount > wddCount) return "brand";
  if (/Body\s*Center/i.test(fullText)) return "bc";
  return "brand";
}
function findBlockStarts(rows, role) {
  const starts = [];
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
function splitBlockRegions(blockRows) {
  for (let idx = 0; idx < Math.min(blockRows.length, 30); idx += 1) {
    if (isTableHeaderRow(blockRows[idx].text)) {
      return {
        headerRows: blockRows.slice(0, idx),
        tableHeaderRow: blockRows[idx],
        tableBodyRows: blockRows.slice(idx + 1)
      };
    }
  }
  return { headerRows: blockRows, tableHeaderRow: null, tableBodyRows: [] };
}
function findPreHeaderRows(rows, blockStartIdx, prevBlockStartIdx) {
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
function buildBlockHeader(triggerRow, preHeaderRows, postTriggerRows) {
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
function extractHeaderValue(rows, matcher) {
  for (const row of rows) {
    const match = row.text.match(matcher);
    if (match) return match[0].toUpperCase();
  }
  return null;
}
function extractVin(rows) {
  for (const row of rows) {
    const match = row.text.match(VIN_RE);
    if (match) return match[1].toUpperCase();
  }
  return null;
}
function extractWarehouse(rows) {
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
function extractBlwk(rows) {
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const match = rows[index].text.match(BLWK_RE);
    if (match) return `BLWK/${match[1]}`;
  }
  return null;
}
function extractZl(rows) {
  for (const row of rows) {
    const match = row.text.match(ZL_NUMBER_RE);
    if (match) return `${match[1].toUpperCase()}/${match[2]}`;
  }
  return null;
}
function extractWddGroupName(rows) {
  let wysylka = null;
  let source = null;
  for (let index = rows.length - 1; index >= 0; index -= 1) {
    const text = normalizeText(rows[index].text);
    if (!wysylka && /^Wysylka\/\d+\/\S+/i.test(text)) {
      wysylka = text;
    }
    if (!source && /^(BRA_SKO|WAJ_SEA)\b/i.test(text)) {
      source = text;
    }
  }
  if (source && wysylka) return `${source} | ${wysylka}`;
  return source ?? wysylka;
}
function extractClientLineFromHeaderRows(headerRows) {
  const parts = [];
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
  return normalizeText(parts.join(" ")).replace(/\s+Blacharnia\s+D\d+\b.*$/i, "").replace(/\s+2\.\s*Zam[oó]wienie.*$/i, "").trim() || null;
}
function buildRawTableRowsV4(tableBodyRows, bandMap, hadTableHeader) {
  const collected = [];
  for (const row of tableBodyRows) {
    const text = row.text;
    if (!text) continue;
    if (isTableHeaderRow(text)) continue;
    if (BLWK_RE.test(text)) break;
    if (WDD_NUMBER_RE.test(text) || ZW_NUMBER_RE.test(text)) continue;
    if (isBlockTitleLine(text) || isTimestampLine(text)) continue;
    if (isStructuralHeaderRow(text)) continue;
    const bands = bandsForPage(row.page, bandMap);
    for (const token of row.tokens) {
      const value = token.text.trim();
      if (!value) continue;
      const column = assignColumn(token, bands);
      collected.push({
        token,
        page: row.page,
        y: token.y1,
        column,
        originalColumn: column,
        correctionRule: null,
        corrected: false
      });
    }
  }
  const totalCollected = collected.length;
  if (!collected.length) {
    return {
      rows: [],
      hadTableHeader,
      correctionCount: 0,
      totalCollected: 0,
      totalAssigned: 0,
      orphanTokenCount: 0,
      reconciliationCount: 0
    };
  }
  let correctionCount = 0;
  for (const entry of collected) {
    if (entry.column !== "inz") continue;
    const v = entry.token.text.trim();
    if (!v || isDecimalToken(v)) continue;
    const bands = bandsForPage(entry.page, bandMap);
    const inzMid = (bands.inz[0] + bands.inz[1]) / 2;
    if (entry.token.x0 >= inzMid) {
      entry.column = "location";
      entry.correctionRule = "inz_to_location_by_midpoint";
      entry.corrected = true;
      correctionCount += 1;
    }
  }
  const anchorBuckets = /* @__PURE__ */ new Map();
  const hasSameVisualRowIdp = (candidate) => collected.some(
    (entry) => entry.page === candidate.page && Math.abs(entry.y - candidate.y) <= 3 && entry.column === "idp" && extractSignedIdp(entry.token.text.trim()).value !== null
  );
  for (const entry of collected) {
    if (entry.column !== "code") continue;
    const rawCode = entry.token.text.trim();
    const codeKind = classifyProductCode(rawCode);
    if (!codeKind) continue;
    if (codeKind !== "strict_product_code" && !hasSameVisualRowIdp(entry)) continue;
    const code = rawCode.toUpperCase();
    const bucketY = Math.round(entry.y / 4) * 4;
    const key = `${entry.page}:${bucketY}`;
    if (!anchorBuckets.has(key)) {
      anchorBuckets.set(key, { page: entry.page, y: entry.y, code, codeKind });
    }
  }
  const anchors = [...anchorBuckets.values()].sort(
    (a, b) => a.page !== b.page ? a.page - b.page : b.y - a.y
  );
  if (!anchors.length) {
    return {
      rows: [],
      hadTableHeader,
      correctionCount,
      totalCollected,
      totalAssigned: 0,
      orphanTokenCount: 0,
      reconciliationCount: 0
    };
  }
  const rowBands = anchors.map((anchor, index) => {
    let previousY = null;
    for (let p = index - 1; p >= 0; p -= 1) {
      if (anchors[p].page === anchor.page) {
        previousY = anchors[p].y;
        break;
      }
    }
    let nextY = null;
    for (let p = index + 1; p < anchors.length; p += 1) {
      if (anchors[p].page === anchor.page) {
        nextY = anchors[p].y;
        break;
      }
    }
    return {
      page: anchor.page,
      topY: previousY == null ? anchor.y + 30 : (previousY + anchor.y) / 2,
      bottomY: nextY == null ? anchor.y - 30 : (anchor.y + nextY) / 2
    };
  });
  const rowCells = anchors.map(() => /* @__PURE__ */ new Map());
  const assignedCells = anchors.map(() => []);
  const allBandCells = anchors.map(() => []);
  const orphanCells = anchors.map(() => []);
  const corrections = anchors.map(() => []);
  function findBandIndex(page, y) {
    for (let i = 0; i < rowBands.length; i += 1) {
      const band = rowBands[i];
      if (band.page === page && y > band.bottomY && y <= band.topY) return i;
    }
    return -1;
  }
  function findNearestBandIndex(page, y) {
    let bestIndex = -1;
    let bestDistance = Number.POSITIVE_INFINITY;
    for (let i = 0; i < rowBands.length; i += 1) {
      const band = rowBands[i];
      if (band.page !== page) continue;
      const distance = y > band.topY ? y - band.topY : y < band.bottomY ? band.bottomY - y : 0;
      if (distance < bestDistance) {
        bestDistance = distance;
        bestIndex = i;
      }
    }
    return bestIndex;
  }
  const correctedBandIndices = /* @__PURE__ */ new Set();
  let totalAssigned = 0;
  let orphanTokenCount = 0;
  for (const entry of collected) {
    const bandIndex = findBandIndex(entry.page, entry.y);
    const fragment = {
      text: entry.token.text.trim(),
      column: entry.column,
      x0: entry.token.x0,
      x1: entry.token.x1,
      y: entry.y,
      page: entry.page
    };
    if (bandIndex >= 0) {
      allBandCells[bandIndex].push(fragment);
      if (entry.column !== "unclassified") {
        totalAssigned += 1;
        const byColumn = rowCells[bandIndex];
        const items = byColumn.get(entry.column) ?? [];
        items.push(entry.token);
        byColumn.set(entry.column, items);
        assignedCells[bandIndex].push(fragment);
      }
      if (entry.corrected) {
        correctedBandIndices.add(bandIndex);
        if (entry.correctionRule) {
          corrections[bandIndex].push({
            rule: entry.correctionRule,
            originalColumn: entry.originalColumn,
            correctedColumn: entry.column,
            text: entry.token.text.trim(),
            page: entry.page,
            x0: entry.token.x0,
            x1: entry.token.x1,
            y: entry.y
          });
        }
      }
      continue;
    }
    const nearestBandIndex = findNearestBandIndex(entry.page, entry.y);
    if (nearestBandIndex >= 0) {
      orphanTokenCount += 1;
      orphanCells[nearestBandIndex].push(fragment);
    }
  }
  function sortCellTokens(tokens) {
    return [...tokens].sort((a, b) => Math.abs(b.y1 - a.y1) > 2 ? b.y1 - a.y1 : a.x0 - b.x0);
  }
  function cellText(cells, column) {
    return normalizeText(
      sortCellTokens(cells.get(column) ?? []).map((t) => t.text.trim()).join(" ")
    );
  }
  function dedupFragments(values) {
    const output = [];
    for (const value of values) {
      if (!value) continue;
      if (output[output.length - 1] !== value) output.push(value);
    }
    return output;
  }
  const NAME_ZONE_COLS = /* @__PURE__ */ new Set(["code", "name", "unclassified", "op"]);
  const rows = [];
  for (let index = 0; index < anchors.length; index += 1) {
    const cells = rowCells[index];
    const codeToken = sortCellTokens(cells.get("code") ?? []).find(
      (t) => classifyProductCode(t.text) !== null
    );
    if (!codeToken) continue;
    const codeKind = classifyProductCode(codeToken.text);
    const nameZoneCells = [...allBandCells[index], ...orphanCells[index]].filter((cell) => {
      if (!NAME_ZONE_COLS.has(cell.column)) return false;
      const v = cell.text.trim();
      if (v.length === 0) return false;
      if (isProductCode(v)) return false;
      if (isLikelyOperationCode(v)) return false;
      if (isLikelyLocationToken(v)) return false;
      if (!/[A-Za-zĄĆĘŁŃÓŚŹŻąćęłńóśźż]/.test(v) && !isNameConnectorToken(v) && !isNameNumericPrefixToken(v)) {
        return false;
      }
      return true;
    }).sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0);
    const nameFragments = buildNameFragments(nameZoneCells);
    const hasCodeBandInName = nameZoneCells.some((c) => c.column === "code");
    const nameSource = nameFragments.length === 0 ? "empty" : hasCodeBandInName ? "name_zone" : "name_col_only";
    const warnings = [];
    if (hasCodeBandInName) warnings.push("name_includes_code_band_tokens");
    if (correctedBandIndices.has(index)) warnings.push("location_corrected_from_inz");
    if (orphanCells[index].length > 0) warnings.push("orphan_tokens_near_row");
    let locationFragments = dedupFragments(
      sortCellTokens(cells.get("location") ?? []).map((t) => t.text.trim()).filter(Boolean)
    );
    const suspiciousLocationReason = detectSuspiciousLocationReason(
      normalizeText(locationFragments.join(" ")) || null
    );
    if (suspiciousLocationReason === "location_is_lone_digit") {
      locationFragments = [];
      warnings.push("ambiguous_location_dropped");
    }
    const nameLooksTruncated = detectTruncatedName(nameFragments);
    if (suspiciousLocationReason) warnings.push(suspiciousLocationReason);
    if (nameLooksTruncated) warnings.push("name_may_be_truncated");
    const idpRawText = cellText(cells, "idp");
    rows.push({
      codeText: codeToken.text.trim().toUpperCase(),
      codeKind,
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
      assignedCells: assignedCells[index],
      allBandCells: allBandCells[index],
      orphanCells: orphanCells[index],
      rawCells: allBandCells[index],
      corrections: corrections[index],
      nameSource,
      nameLooksTruncated,
      suspiciousLocationReason,
      warnings
    });
  }
  return {
    rows,
    hadTableHeader,
    correctionCount,
    totalCollected,
    totalAssigned,
    orphanTokenCount,
    reconciliationCount: 0
  };
}
function buildParsedLinesV4(rawRows) {
  function toRawTokens(cells) {
    return [...cells].sort((a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0).map((cell) => ({
      text: cell.text,
      x: cell.x0,
      y: cell.y,
      column: cell.column
    }));
  }
  function computeRowConfidence(row, idpValue) {
    let score = 1;
    if (!row.codeText) score -= 0.45;
    if (row.codeKind === "unrecognized_code_candidate") score -= 0.12;
    if (row.nameFragments.length === 0) score -= 0.35;
    if (row.orphanCells.length > 0) {
      score -= Math.min(0.25, row.orphanCells.length * 0.06);
    }
    if (row.nameSource === "empty") score -= 0.2;
    if (row.nameSource === "name_zone") score -= 0.05;
    if (row.nameLooksTruncated) score -= 0.12;
    if (row.suspiciousLocationReason) score -= 0.1;
    if (row.warnings.length > 0) score -= Math.min(0.15, row.warnings.length * 0.04);
    if (row.idpRawText && idpValue === null) score -= 0.2;
    return clamp01(score);
  }
  return rawRows.map((row, index) => {
    const colMap = /* @__PURE__ */ new Map();
    const sortedAssignedCells = [...row.assignedCells].sort(
      (a, b) => Math.abs(b.y - a.y) > 2 ? b.y - a.y : a.x0 - b.x0
    );
    for (const cell of sortedAssignedCells) {
      const items = colMap.get(cell.column) ?? [];
      items.push(cell.text);
      colMap.set(cell.column, items);
    }
    const getCellText = (col) => (colMap.get(col) ?? []).join(" ");
    const rawText = [
      `lp=${getCellText("lp")}`,
      `code=${row.codeText ?? ""}`,
      `name=${row.nameFragments.join(" ")}`,
      `iz=${formatDecimal(row.iz)}`,
      `iw=${formatDecimal(row.iw)}`,
      `ir=${formatDecimal(row.ir)}`,
      `inz=${formatDecimal(row.inz)}`,
      `location=${row.locationFragments.join(" ")}`,
      `idp=${row.idpRawText}`,
      `op=${getCellText("op")}`
    ].join(" | ");
    const assignedRawTokens = toRawTokens(row.assignedCells);
    const allRowTokensInBand = toRawTokens(row.allBandCells);
    const assignedRawRowText = assignedRawTokens.map((token) => token.text).join(" ");
    const allRowTextInBand = allRowTokensInBand.map((token) => token.text).join(" ");
    const idp = extractSignedIdp(row.idpRawText);
    const rowConfidence = computeRowConfidence(row, idp.value);
    const line = {
      lineNumber: index + 1,
      lp: parseLp(row.lpText),
      productCode: row.codeText,
      productCodeKind: row.codeKind,
      productName: normalizeText(row.nameFragments.join(" ")) || null,
      quantity: idp.abs,
      quantityAbs: idp.abs,
      quantitySigned: idp.value,
      unit: null,
      location: normalizeText(row.locationFragments.join(" ")) || null,
      rawText,
      rawRowText: allRowTextInBand,
      rawTokens: allRowTokensInBand,
      assignedRawTokens,
      allRowTokensInBand,
      assignedRawRowText,
      allRowTextInBand,
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
      corrections: row.corrections,
      nameSource: row.nameSource,
      rowConfidence,
      hasOrphanTokens: row.orphanCells.length > 0,
      unassignedTokensNearRow: row.orphanCells.length,
      nameLooksTruncated: row.nameLooksTruncated,
      hasSuspiciousLocation: row.suspiciousLocationReason !== null,
      suspiciousLocationReason: row.suspiciousLocationReason,
      wasDuplicateReconciled: false,
      reconciledFromBlockIndex: null,
      reconciledFromBlockHeader: null,
      reconciledFromPageNumber: null,
      reconciledFromLogicalOrderFamily: null,
      reconciledFromOperationCode: null,
      lineValidation: {
        status: "trusted",
        confidenceScore: 1,
        reasons: [],
        humanSummary: ""
      },
      warnings: row.warnings
    };
    return withLineValidation(line);
  });
}
function computeLineValidation(line) {
  const hardReasons = [];
  const reviewReasons = [];
  let score = 1;
  if (!line.productCode) hardReasons.push("missing_product_code");
  else if (!line.productCodeKind) hardReasons.push("malformed_product_code");
  if (line.quantityAbs === null) hardReasons.push("missing_quantity");
  if (line.idpRaw && line.idpValue === null) hardReasons.push("quantity_parse_failed");
  if (line.productCodeKind === "accepted_catalog_token") {
    reviewReasons.push("accepted_catalog_token");
  }
  if (line.productCodeKind === "unrecognized_code_candidate") {
    reviewReasons.push("unrecognized_code_candidate");
  }
  if (!line.productName) reviewReasons.push("missing_product_name");
  if (line.nameLooksTruncated) reviewReasons.push("name_truncated");
  if (line.hasOrphanTokens) reviewReasons.push("orphan_tokens_near_row");
  if (line.hasSuspiciousLocation) reviewReasons.push(line.suspiciousLocationReason ?? "suspicious_location");
  if (line.wasDuplicateReconciled) reviewReasons.push("duplicate_reconciliation_applied");
  for (const correctionRule of new Set(line.corrections.map((correction) => correction.rule))) {
    reviewReasons.push(`column_correction_${correctionRule}`);
  }
  if (line.rowConfidence < 0.75) reviewReasons.push("low_row_confidence");
  if (line.operationCode && !isLikelyOperationCode(line.operationCode)) {
    reviewReasons.push("unknown_operation_code");
  }
  score -= Math.min(0.35, hardReasons.length * 0.2);
  score -= Math.min(0.25, reviewReasons.length * 0.04);
  score = clamp01(score);
  const status = hardReasons.length > 0 ? "failed" : reviewReasons.length > 0 || score < 0.97 ? "review" : "trusted";
  const reasons = [...hardReasons, ...reviewReasons];
  return {
    status,
    confidenceScore: score,
    reasons,
    humanSummary: validationSummary(status, reasons)
  };
}
function withLineValidation(line) {
  return {
    ...line,
    lineValidation: computeLineValidation(line)
  };
}
function metadataString(metadata, key) {
  const value = metadata[key];
  return typeof value === "string" && value.trim() ? value.trim() : null;
}
function buildLogicalOrderKey(blockType, metadata) {
  const vin = metadataString(metadata, "vin");
  const zl = metadataString(metadata, "zl_number");
  const zw = metadataString(metadata, "zw_number");
  const order = metadataString(metadata, "order_number");
  const wdd = metadataString(metadata, "wdd_number");
  if (blockType === "wdd_reconciliation" || blockType === "wdd_source") {
    return wdd ? `wdd:${wdd}` : null;
  }
  if (vin && zl && order) return `order:${vin}|${zl}|${order}`;
  if (vin && zw && order) return `order:${vin}|${zw}|${order}`;
  if (zw && order) return `order:${zw}|${order}`;
  if (zw) return `order:${zw}`;
  return null;
}
function blockLogicalOrderKey(block) {
  return block.logicalOrderKey ?? buildLogicalOrderKey(block.blockType, block.metadata);
}
function rewriteLineRawText(line) {
  return [
    `lp=${line.lp ?? ""}`,
    `code=${line.productCode ?? ""}`,
    `name=${line.rawNameFragments.join(" ")}`,
    `iz=${formatDecimal(line.iz)}`,
    `iw=${formatDecimal(line.iw)}`,
    `ir=${formatDecimal(line.ir)}`,
    `inz=${formatDecimal(line.inz)}`,
    `location=${line.rawLocationFragments.join(" ")}`,
    `idp=${line.idpRaw}`,
    `op=${line.operationCode ?? ""}`
  ].join(" | ");
}
function formatSignedDecimal(value) {
  if (value === null) return "";
  const abs = Math.abs(value).toFixed(2).replace(".", ",");
  return value < 0 ? `- ${abs}` : abs;
}
function reconcileDuplicateBrandOrder(blockDraft, lines, priorBlocks) {
  if (blockDraft.logicalOrderFamily !== "standard") {
    return { lines, reconciliationCount: 0 };
  }
  const key = buildLogicalOrderKey("brand_order", blockDraft.metadata);
  if (!key) return { lines, reconciliationCount: 0 };
  const priorMirrorBlocks = priorBlocks.filter((block) => {
    return blockLogicalOrderKey(block) === key && block.logicalOrderFamily === "mirror" && block.lines.some((line) => (line.quantitySigned ?? 0) < 0);
  });
  if (priorMirrorBlocks.length === 0) return { lines, reconciliationCount: 0 };
  const negativeByCode = /* @__PURE__ */ new Map();
  for (const block of priorMirrorBlocks) {
    for (const line of block.lines) {
      if (!line.productCode || line.quantitySigned === null || line.quantitySigned >= 0) continue;
      if (line.movementDirection !== "correction" && (line.operationCode ?? "").toUpperCase() !== "ZR") {
        continue;
      }
      if (!negativeByCode.has(line.productCode)) negativeByCode.set(line.productCode, line);
    }
  }
  let reconciliationCount = 0;
  const reconciledLines = lines.map((line) => {
    if (!line.productCode || line.quantitySigned === null || line.quantitySigned < 0) return line;
    const priorNegative = negativeByCode.get(line.productCode);
    if (!priorNegative) return line;
    if (priorNegative.quantityAbs !== line.quantityAbs) return line;
    if (line.operationCode) return line;
    reconciliationCount += 1;
    const nextWarnings = [...line.warnings];
    if (!nextWarnings.includes("sign_reconciled_from_duplicate_mirror_block")) {
      nextWarnings.push("sign_reconciled_from_duplicate_mirror_block");
    }
    const suspiciousLoneDigit = line.suspiciousLocationReason === "location_is_lone_digit";
    const nextLocationFragments = suspiciousLoneDigit ? [] : line.rawLocationFragments;
    const sourceBlock = priorMirrorBlocks.find(
      (block) => block.lines.some(
        (candidate) => candidate.productCode === priorNegative.productCode && candidate.quantitySigned === priorNegative.quantitySigned && candidate.idpRaw === priorNegative.idpRaw
      )
    );
    const nextLine = {
      ...line,
      quantitySigned: priorNegative.quantitySigned,
      idpValue: priorNegative.idpValue,
      quantity: priorNegative.quantityAbs,
      quantityAbs: priorNegative.quantityAbs,
      idpAbs: priorNegative.idpAbs,
      idpRaw: priorNegative.idpRaw || formatSignedDecimal(priorNegative.quantitySigned),
      movementDirection: "correction",
      operationCode: priorNegative.operationCode ?? "ZR",
      location: suspiciousLoneDigit ? null : line.location,
      rawLocationFragments: nextLocationFragments,
      hasSuspiciousLocation: false,
      suspiciousLocationReason: null,
      wasDuplicateReconciled: true,
      reconciledFromBlockIndex: sourceBlock?.blockIndex ?? null,
      reconciledFromBlockHeader: sourceBlock?.header ?? null,
      reconciledFromPageNumber: sourceBlock?.pageNumber ?? priorNegative.pageNumber,
      reconciledFromLogicalOrderFamily: sourceBlock?.logicalOrderFamily ?? "mirror",
      reconciledFromOperationCode: priorNegative.operationCode ?? "ZR",
      warnings: nextWarnings.filter((warning) => warning !== "location_is_lone_digit"),
      rowConfidence: clamp01(line.rowConfidence + (suspiciousLoneDigit ? 0.14 : 0.08))
    };
    nextLine.rawText = rewriteLineRawText(nextLine);
    return withLineValidation(nextLine);
  });
  return { lines: reconciledLines, reconciliationCount };
}
function computeBlockParserQuality(rows, opts) {
  const detectedRows = rows.length;
  const blockUnassignedRatio = opts.totalCollected > 0 ? (opts.totalCollected - opts.totalAssigned) / opts.totalCollected : 0;
  const incompleteRowCount = rows.filter(
    (r) => !r.productCode || !r.productName || r.idpRaw && r.idpValue === null
  ).length;
  const lpNumbers = rows.map((r) => r.lp).filter((lp) => lp !== null);
  const lpSet = new Set(lpNumbers);
  const duplicateLpCount = lpNumbers.length - lpSet.size;
  let lpGapCount = 0;
  if (lpNumbers.length > 1) {
    const sorted = [...lpNumbers].sort((a, b) => a - b);
    for (let i = 1; i < sorted.length; i += 1) {
      if (sorted[i] - sorted[i - 1] > 1) lpGapCount += 1;
    }
  }
  const negativeIdpParseFailures = rows.filter(
    (r) => /[-–]/.test(r.idpRaw) && r.idpValue === null
  ).length;
  const orphanTokenCount = rows.reduce((sum, row) => sum + row.unassignedTokensNearRow, 0);
  const truncatedNameCount = rows.filter((row) => row.nameLooksTruncated).length;
  const suspiciousLocationCount = rows.filter((row) => row.hasSuspiciousLocation).length;
  let score = 1;
  score -= blockUnassignedRatio * 0.35;
  score -= incompleteRowCount / Math.max(1, detectedRows) * 0.25;
  score -= Math.min(0.2, duplicateLpCount * 0.05);
  score -= Math.min(0.2, orphanTokenCount * 0.02);
  score -= Math.min(0.15, negativeIdpParseFailures * 0.1);
  score -= Math.min(0.2, truncatedNameCount * 0.06);
  score -= Math.min(0.15, suspiciousLocationCount * 0.07);
  score -= Math.min(0.15, opts.headerIssues.length * 0.05);
  score += Math.min(0.08, opts.reconciliationCount * 0.04);
  score = clamp01(score);
  const warnings = [];
  if (opts.hadTableHeader && detectedRows === 0) warnings.push("table_header_but_zero_rows");
  if (blockUnassignedRatio > 0.2) warnings.push("high_unassigned_token_ratio");
  if (incompleteRowCount > 0) warnings.push("incomplete_rows_detected");
  if (duplicateLpCount > 0) warnings.push("duplicate_lp_numbers");
  if (lpGapCount > 0 && (orphanTokenCount > 0 || incompleteRowCount > 0)) {
    warnings.push("lp_sequence_gaps_with_parse_risk");
  }
  if (negativeIdpParseFailures > 0) warnings.push("negative_idp_parse_failures");
  if (opts.correctionCount > 0) warnings.push("column_corrections_applied");
  if (opts.reconciliationCount > 0) warnings.push("duplicate_order_reconciled");
  if (orphanTokenCount > 0) warnings.push("orphan_tokens_detected");
  if (truncatedNameCount > 0) warnings.push("truncated_names_detected");
  if (suspiciousLocationCount > 0) warnings.push("suspicious_locations_detected");
  warnings.push(...opts.headerIssues);
  return {
    confidenceScore: score,
    detectedRows,
    blockCollectedTokens: opts.totalCollected,
    blockAssignedTokens: opts.totalAssigned,
    blockUnassignedRatio,
    orphanTokenCount,
    correctionCount: opts.correctionCount,
    incompleteRowCount,
    duplicateLpCount,
    lpGapCount,
    negativeIdpParseFailures,
    warnings,
    stats: {
      detectedRows,
      blockCollectedTokens: opts.totalCollected,
      blockAssignedTokens: opts.totalAssigned,
      orphanTokenCount,
      correctionCount: opts.correctionCount,
      incompleteRowCount,
      duplicateLpCount,
      lpGapCount
    }
  };
}
function computeBlockParserStatus(quality) {
  const materialWarnings = quality.warnings.filter(
    (warning) => ![
      "column_corrections_applied",
      "duplicate_order_reconciled",
      "truncated_names_detected"
    ].includes(warning)
  );
  if (quality.warnings.includes("table_header_but_zero_rows")) return "error";
  if (quality.negativeIdpParseFailures > 0) return "error";
  if (quality.blockUnassignedRatio > 0.25) return "error";
  if (quality.confidenceScore < 0.5) return "error";
  if (quality.confidenceScore < 0.8 || materialWarnings.length > 0) return "warning";
  return "ok";
}
function computeParserQuality(blocks, totalCollected, totalAssigned, correctionCount) {
  const rows = blocks.flatMap((block) => block.lines);
  const detectedRows = rows.length;
  const unassignedRatio = totalCollected > 0 ? (totalCollected - totalAssigned) / totalCollected : 0;
  const incompleteRowCount = rows.filter((r) => !r.productCode || !r.productName).length;
  const duplicateLpCount = blocks.reduce(
    (sum, block) => sum + block.parserQuality.duplicateLpCount,
    0
  );
  const lpGapCount = blocks.reduce((sum, block) => sum + block.parserQuality.lpGapCount, 0);
  const blocksWithDuplicateLp = blocks.filter(
    (block) => block.parserQuality.duplicateLpCount > 0
  ).length;
  const blocksWithLpGaps = blocks.filter((block) => block.parserQuality.lpGapCount > 0).length;
  const negativeIdpParseFailures = rows.filter(
    (r) => /[-–]/.test(r.idpRaw) && r.idpValue === null
  ).length;
  const truncatedNameCount = rows.filter((row) => row.nameLooksTruncated).length;
  const suspiciousLocationCount = rows.filter((row) => row.hasSuspiciousLocation).length;
  let score = 1;
  score -= unassignedRatio * 0.3;
  score -= incompleteRowCount / Math.max(1, detectedRows) * 0.2;
  score -= Math.min(0.15, negativeIdpParseFailures * 0.1);
  score -= Math.min(0.2, truncatedNameCount * 0.05);
  score -= Math.min(0.15, suspiciousLocationCount * 0.06);
  score = Math.max(0, Math.min(1, score));
  const warnings = [];
  if (unassignedRatio > 0.2) warnings.push("high_unassigned_token_ratio");
  if (incompleteRowCount > 0) warnings.push("incomplete_rows_detected");
  if (blocksWithDuplicateLp > 0) warnings.push("blocks_with_duplicate_lp_numbers");
  if (blocksWithLpGaps > 0 && (incompleteRowCount > 0 || unassignedRatio > 0.1)) {
    warnings.push("blocks_with_lp_sequence_gaps_with_parse_risk");
  }
  if (negativeIdpParseFailures > 0) warnings.push("negative_idp_parse_failures");
  if (correctionCount > 0) warnings.push("column_corrections_applied");
  if (truncatedNameCount > 0) warnings.push("truncated_names_detected");
  if (suspiciousLocationCount > 0) warnings.push("suspicious_locations_detected");
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
      blocksWithDuplicateLp,
      blocksWithLpGaps
    }
  };
}
function computeParserStatus(quality) {
  const benignWarnings = /* @__PURE__ */ new Set(["blocks_with_duplicate_lp_numbers"]);
  const materialWarnings = quality.warnings.filter((warning) => !benignWarnings.has(warning));
  if (quality.negativeIdpParseFailures > 0) return "error";
  if (quality.detectedRows === 0 && quality.totalCollectedTokens > 20) return "error";
  if (quality.unassignedRatio > 0.25) return "error";
  if (quality.confidenceScore < 0.5) return "error";
  if (quality.confidenceScore < 0.8 || materialWarnings.length > 0) return "warning";
  return "ok";
}
function computeBlockValidation(args) {
  const hardReasons = /* @__PURE__ */ new Set();
  const reviewReasons = /* @__PURE__ */ new Set();
  if (!args.logicalOrderKey) hardReasons.add("missing_logical_order_key");
  if (args.lines.length === 0) hardReasons.add("zero_lines");
  if (args.parserStatus === "error") hardReasons.add("parser_status_error");
  if (args.parserQuality.warnings.includes("table_header_but_zero_rows")) {
    hardReasons.add("table_header_but_zero_rows");
  }
  if (args.lines.length > 0 && args.lines.every((line) => !line.productCode)) {
    hardReasons.add("all_lines_missing_product_code");
  }
  if (args.lines.some((line) => line.lineValidation.status === "failed")) {
    hardReasons.add("line_validation_failed");
  }
  for (const issue of args.headerIssues) reviewReasons.add(issue);
  if (args.parserStatus === "warning") reviewReasons.add("parser_status_warning");
  if (args.parserQuality.blockUnassignedRatio > 0) reviewReasons.add("unassigned_tokens_present");
  if (args.parserQuality.orphanTokenCount > 0) reviewReasons.add("orphan_tokens_present");
  if (args.parserQuality.correctionCount > 0) reviewReasons.add("column_corrections_applied");
  if (args.parserQuality.incompleteRowCount > 0) reviewReasons.add("incomplete_rows_detected");
  if (args.parserQuality.duplicateLpCount > 0) reviewReasons.add("duplicate_lp_numbers");
  if (args.parserQuality.negativeIdpParseFailures > 0) reviewReasons.add("negative_idp_parse_failures");
  if (args.parserQuality.warnings.includes("truncated_names_detected") || args.lines.some((line) => line.nameLooksTruncated)) {
    reviewReasons.add("truncated_names_detected");
  }
  if (args.lines.some((line) => line.corrections.length > 0)) {
    reviewReasons.add("structured_column_corrections_present");
  }
  if (args.parserQuality.warnings.includes("duplicate_order_reconciled")) {
    reviewReasons.add("duplicate_order_reconciled");
  }
  if (args.lines.some((line) => line.lineValidation.status === "review")) {
    reviewReasons.add("line_validation_review");
  }
  const lineScores = args.lines.map((line) => line.lineValidation.confidenceScore);
  const avgLineScore = lineScores.length > 0 ? lineScores.reduce((sum, score2) => sum + score2, 0) / lineScores.length : 0;
  let score = Math.min(args.parserQuality.confidenceScore, avgLineScore || 0);
  score -= Math.min(0.25, hardReasons.size * 0.15);
  score -= Math.min(0.2, reviewReasons.size * 0.025);
  score = clamp01(score);
  const reasons = [...hardReasons, ...reviewReasons];
  const status = hardReasons.size > 0 ? "failed" : reviewReasons.size > 0 || score < 0.97 ? "review" : "trusted";
  return {
    status,
    confidenceScore: score,
    reasons,
    humanSummary: validationSummary(status, reasons)
  };
}
function buildReconstructionSources(lines) {
  const seen = /* @__PURE__ */ new Set();
  const sources = [];
  for (const line of lines) {
    if (!line.wasDuplicateReconciled) continue;
    const key = [
      line.reconciledFromBlockIndex ?? "",
      line.reconciledFromPageNumber ?? "",
      line.reconciledFromBlockHeader ?? "",
      line.reconciledFromLogicalOrderFamily ?? ""
    ].join("|");
    if (seen.has(key)) continue;
    seen.add(key);
    sources.push({
      pageNumber: line.reconciledFromPageNumber,
      sourceBlockIndex: line.reconciledFromBlockIndex,
      sourceHeader: line.reconciledFromBlockHeader,
      sourceLogicalOrderFamily: line.reconciledFromLogicalOrderFamily
    });
  }
  return sources;
}
function manualReviewReasonsFromValidation(validation) {
  const reasons = /* @__PURE__ */ new Set();
  if (validation.status !== "trusted") reasons.add(`validation_${validation.status}`);
  for (const reason of validation.reasons) reasons.add(reason);
  return [...reasons];
}
function computeFileValidation(blocks, parserQuality, parserStatus, coverage) {
  const trustedBlocks = blocks.filter((block) => block.blockValidation.status === "trusted").length;
  const reviewBlocks = blocks.filter((block) => block.blockValidation.status === "review").length;
  const failedBlocks = blocks.filter((block) => block.blockValidation.status === "failed").length;
  const reasons = /* @__PURE__ */ new Set();
  const benignFileWarnings = /* @__PURE__ */ new Set(["blocks_with_duplicate_lp_numbers"]);
  const materialFileWarnings = parserQuality.warnings.filter(
    (warning) => !benignFileWarnings.has(warning)
  );
  if (parserStatus === "error") reasons.add("parser_status_error");
  if (parserStatus === "warning" && materialFileWarnings.length > 0) {
    reasons.add("parser_status_warning");
  }
  if (coverage.unassignedTokens > 0) reasons.add("file_unassigned_tokens_present");
  if (failedBlocks > 0) reasons.add("failed_blocks_present");
  if (reviewBlocks > 0) reasons.add("review_blocks_present");
  for (const warning of materialFileWarnings) reasons.add(warning);
  const status = failedBlocks > 0 || parserStatus === "error" ? "failed" : reviewBlocks > 0 || materialFileWarnings.length > 0 || coverage.unassignedTokens > 0 ? "review" : "trusted";
  const blockScores = blocks.map((block) => block.blockValidation.confidenceScore);
  const avgBlockScore = blockScores.length > 0 ? blockScores.reduce((sum, score) => sum + score, 0) / blockScores.length : 0;
  const confidenceScore = clamp01(Math.min(avgBlockScore || 0, coverage.coverageRatio));
  const reasonList = [...reasons];
  return {
    status,
    confidenceScore,
    reasons: reasonList,
    humanSummary: validationSummary(status, reasonList),
    totalBlocks: blocks.length,
    trustedBlocks,
    reviewBlocks,
    failedBlocks,
    tokenCoverage: coverage
  };
}
function parseBcBlockV4(rows, blockStart, blockRows, bandMap, blockIndex, prevBlockStartIdx) {
  const { headerRows, tableHeaderRow, tableBodyRows } = splitBlockRegions(blockRows);
  const preHeaderRows = findPreHeaderRows(rows, blockStart.idx, prevBlockStartIdx);
  const allHeaderRows = [...preHeaderRows, ...headerRows];
  const warehouseInfo = extractWarehouseSectionInfo(allHeaderRows);
  const warehouseCode = warehouseInfo.code ?? extractWarehouse(allHeaderRows);
  const warehouseFamilyAlias = warehouseToBrand(warehouseCode);
  const documentBrand = detectDocumentBrand(allHeaderRows);
  const tableResult = buildRawTableRowsV4(tableBodyRows, bandMap, tableHeaderRow !== null);
  const lines = buildParsedLinesV4(tableResult.rows);
  if (blockStart.sectionKind === "zw") {
    const triggerRow = rows[blockStart.idx];
    const postTriggerNeighbors = headerRows.slice(1, 5);
    const headerRaw2 = buildBlockHeader(triggerRow, preHeaderRows, postTriggerNeighbors);
    const headerNormalized2 = normalizeBlockHeader(headerRaw2);
    const vinSearchRows = [triggerRow, ...postTriggerNeighbors, ...preHeaderRows.slice(-4)];
    const metadata2 = {
      bc_internal_zw: true,
      zw_number: extractHeaderValue(vinSearchRows, ZW_NUMBER_RE) ?? blockStart.markerValue,
      order_number: extractBlwk(preHeaderRows),
      vin: extractVin(vinSearchRows),
      zl_number: extractZl(vinSearchRows),
      client_name: extractClientLineFromHeaderRows(allHeaderRows),
      parts_count: lines.length
    };
    const headerIssues2 = [];
    if (!metadata2.zw_number) headerIssues2.push("missing_zw_number");
    if (!metadata2.order_number) headerIssues2.push("missing_order_number");
    if (!metadata2.vin) headerIssues2.push("missing_vin");
    if (!metadata2.zl_number) headerIssues2.push("missing_zl_number");
    if (!metadata2.client_name) headerIssues2.push("missing_client_name");
    const parserQuality2 = computeBlockParserQuality(lines, {
      hadTableHeader: tableResult.hadTableHeader,
      totalCollected: tableResult.totalCollected,
      totalAssigned: tableResult.totalAssigned,
      correctionCount: tableResult.correctionCount,
      reconciliationCount: tableResult.reconciliationCount,
      headerIssues: headerIssues2
    });
    const parserStatus2 = computeBlockParserStatus(parserQuality2);
    const logicalOrderFamily2 = computeLogicalOrderFamily("zw", warehouseCode, "bc");
    const logicalOrderKey2 = buildLogicalOrderKey("direct_order", metadata2);
    const blockValidation2 = computeBlockValidation({
      blockType: "direct_order",
      logicalOrderKey: logicalOrderKey2,
      parserStatus: parserStatus2,
      parserQuality: parserQuality2,
      lines,
      headerIssues: headerIssues2
    });
    const reconstructionSources2 = buildReconstructionSources(lines);
    const reconstructedBlock2 = reconstructionSources2.length > 0;
    const baseMetadata2 = {
      ...metadata2,
      header_raw: headerRaw2,
      header_normalized: headerNormalized2,
      warehouse_code: warehouseCode,
      warehouse_section_label: warehouseInfo.label,
      warehouse_family_alias: warehouseFamilyAlias,
      document_brand: documentBrand,
      logical_order_key: logicalOrderKey2,
      reconstructed_block: reconstructedBlock2,
      reconstruction_sources: reconstructionSources2,
      parser_quality: parserQuality2,
      parser_status: parserStatus2,
      block_validation: blockValidation2
    };
    const manualReviewReasons2 = manualReviewReasonsFromValidation(blockValidation2);
    const block2 = {
      blockIndex,
      blockType: "direct_order",
      sourceRole: "bc",
      sectionKind: "zw",
      candidateKind: "direct_order",
      isExcluded: false,
      header: headerNormalized2,
      headerRaw: headerRaw2,
      headerNormalized: headerNormalized2,
      warehouseSection: warehouseCode,
      warehouseCode,
      warehouseSectionCode: warehouseCode,
      warehouseSectionLabel: warehouseInfo.label,
      warehouseFamilyAlias,
      documentBrand,
      logicalOrderFamily: logicalOrderFamily2,
      groupNameNormalized: null,
      shipmentCode: null,
      groupSourceLabel: null,
      pageNumber: blockRows[0]?.page ?? null,
      parserQuality: parserQuality2,
      parserStatus: parserStatus2,
      blockValidation: blockValidation2,
      logicalOrderKey: logicalOrderKey2,
      reconstructedBlock: reconstructedBlock2,
      reconstructionSources: reconstructionSources2,
      requiresManualReview: manualReviewReasons2.length > 0,
      manualReviewReasons: manualReviewReasons2,
      metadata: {
        ...baseMetadata2,
        requires_manual_review: manualReviewReasons2.length > 0,
        manual_review_reasons: manualReviewReasons2
      },
      lines
    };
    return { block: block2, tableResult };
  }
  const beforeRows = rows.slice(Math.max(0, blockStart.idx - 8), blockStart.idx);
  const headerRaw = blockStart.triggerText;
  const headerNormalized = normalizeBlockHeader(headerRaw);
  const groupFields = extractWddGroupFields([...beforeRows, ...allHeaderRows]);
  const metadata = {
    wdd_number: extractHeaderValue(allHeaderRows, WDD_NUMBER_RE),
    group_name: extractWddGroupName([...beforeRows, ...allHeaderRows]),
    group_name_normalized: groupFields.groupNameNormalized,
    group_source_label: groupFields.groupSourceLabel,
    shipment_code: groupFields.shipmentCode,
    shipment_raw: groupFields.shipmentRaw,
    parts_count: lines.length
  };
  const headerIssues = [];
  if (!metadata.wdd_number) headerIssues.push("missing_wdd_number");
  if (!metadata.group_name) headerIssues.push("missing_group_name");
  const parserQuality = computeBlockParserQuality(lines, {
    hadTableHeader: tableResult.hadTableHeader,
    totalCollected: tableResult.totalCollected,
    totalAssigned: tableResult.totalAssigned,
    correctionCount: tableResult.correctionCount,
    reconciliationCount: tableResult.reconciliationCount,
    headerIssues
  });
  const parserStatus = computeBlockParserStatus(parserQuality);
  const logicalOrderFamily = computeLogicalOrderFamily("wdd", warehouseCode, "bc");
  const logicalOrderKey = buildLogicalOrderKey("wdd_reconciliation", metadata);
  const blockValidation = computeBlockValidation({
    blockType: "wdd_reconciliation",
    logicalOrderKey,
    parserStatus,
    parserQuality,
    lines,
    headerIssues
  });
  const reconstructionSources = buildReconstructionSources(lines);
  const reconstructedBlock = reconstructionSources.length > 0;
  const baseMetadata = {
    ...metadata,
    header_raw: headerRaw,
    header_normalized: headerNormalized,
    warehouse_code: warehouseCode,
    warehouse_section_label: warehouseInfo.label,
    warehouse_family_alias: warehouseFamilyAlias,
    document_brand: documentBrand,
    logical_order_key: logicalOrderKey,
    reconstructed_block: reconstructedBlock,
    reconstruction_sources: reconstructionSources,
    parser_quality: parserQuality,
    parser_status: parserStatus,
    block_validation: blockValidation
  };
  const manualReviewReasons = manualReviewReasonsFromValidation(blockValidation);
  const block = {
    blockIndex,
    blockType: "wdd_reconciliation",
    sourceRole: "bc",
    sectionKind: "wdd",
    candidateKind: "wdd_reconciliation",
    isExcluded: false,
    header: headerNormalized,
    headerRaw,
    headerNormalized,
    warehouseSection: warehouseCode,
    warehouseCode,
    warehouseSectionCode: warehouseCode,
    warehouseSectionLabel: warehouseInfo.label,
    warehouseFamilyAlias,
    documentBrand,
    logicalOrderFamily,
    groupNameNormalized: groupFields.groupNameNormalized,
    shipmentCode: groupFields.shipmentCode,
    groupSourceLabel: groupFields.groupSourceLabel,
    pageNumber: blockRows[0]?.page ?? null,
    parserQuality,
    parserStatus,
    blockValidation,
    logicalOrderKey,
    reconstructedBlock,
    reconstructionSources,
    requiresManualReview: manualReviewReasons.length > 0,
    manualReviewReasons,
    metadata: {
      ...baseMetadata,
      requires_manual_review: manualReviewReasons.length > 0,
      manual_review_reasons: manualReviewReasons
    },
    lines
  };
  return { block, tableResult };
}
function parseBrandBlockV4(rows, blockStart, blockRows, bandMap, blockIndex, prevBlockStartIdx, priorBlocks) {
  const preHeaderRows = findPreHeaderRows(rows, blockStart.idx, prevBlockStartIdx);
  const { headerRows: postTriggerHeaderRows, tableHeaderRow, tableBodyRows } = splitBlockRegions(blockRows);
  const allHeaderRows = [...preHeaderRows, ...postTriggerHeaderRows];
  const warehouseInfo = extractWarehouseSectionInfo(allHeaderRows);
  const warehouseCode = warehouseInfo.code ?? extractWarehouse(allHeaderRows);
  const warehouseFamilyAlias = warehouseToBrand(warehouseCode);
  const documentBrand = detectDocumentBrand(allHeaderRows);
  const candidateKind = warehouseCode === "415" ? "mirror" : "brand_order";
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
  const tableResult = buildRawTableRowsV4(tableBodyRows, bandMap, tableHeaderRow !== null);
  const parsedLines = buildParsedLinesV4(tableResult.rows);
  const brandDraft = {
    blockIndex,
    blockType: "brand_order",
    sourceRole: "brand",
    sectionKind: "zw",
    candidateKind,
    isExcluded: false,
    header: headerNormalized,
    headerRaw,
    headerNormalized,
    warehouseSection: warehouseCode,
    warehouseCode,
    warehouseSectionCode: warehouseCode,
    warehouseSectionLabel: warehouseInfo.label,
    warehouseFamilyAlias,
    documentBrand,
    logicalOrderFamily: computeLogicalOrderFamily("zw", warehouseCode, "brand"),
    groupNameNormalized: null,
    shipmentCode: null,
    groupSourceLabel: null,
    pageNumber: blockRows[0]?.page ?? null,
    metadata: {
      zw_number,
      zl_number,
      order_number,
      vin,
      client_name
    },
    lines: parsedLines
  };
  const reconciliation = reconcileDuplicateBrandOrder(brandDraft, parsedLines, priorBlocks);
  const lines = reconciliation.lines;
  tableResult.reconciliationCount = reconciliation.reconciliationCount;
  const headerIssues = [];
  if (!zw_number) headerIssues.push("missing_zw_number");
  if (!vin) headerIssues.push("missing_vin");
  if (!zl_number) headerIssues.push("missing_zl_number");
  if (!order_number) headerIssues.push("missing_order_number");
  if (!client_name) headerIssues.push("missing_client_name");
  const logicalOrderFamily = computeLogicalOrderFamily("zw", warehouseCode, "brand");
  const logicalOrderKey = buildLogicalOrderKey("brand_order", {
    zw_number,
    zl_number,
    order_number,
    vin,
    client_name
  });
  const parserQuality = computeBlockParserQuality(lines, {
    hadTableHeader: tableResult.hadTableHeader,
    totalCollected: tableResult.totalCollected,
    totalAssigned: tableResult.totalAssigned,
    correctionCount: tableResult.correctionCount,
    reconciliationCount: tableResult.reconciliationCount,
    headerIssues
  });
  const parserStatus = computeBlockParserStatus(parserQuality);
  const blockValidation = computeBlockValidation({
    blockType: "brand_order",
    logicalOrderKey,
    parserStatus,
    parserQuality,
    lines,
    headerIssues
  });
  const reconstructionSources = buildReconstructionSources(lines);
  const reconstructedBlock = reconstructionSources.length > 0;
  const baseMetadata = {
    zw_number,
    zl_number,
    order_number,
    vin,
    client_name,
    parts_count: lines.length,
    duplicate_order_reconciliation_count: tableResult.reconciliationCount,
    header_raw: headerRaw,
    header_normalized: headerNormalized,
    warehouse_code: warehouseCode,
    warehouse_section_label: warehouseInfo.label,
    warehouse_family_alias: warehouseFamilyAlias,
    document_brand: documentBrand,
    logical_order_key: logicalOrderKey,
    reconstructed_block: reconstructedBlock,
    reconstruction_sources: reconstructionSources,
    parser_quality: parserQuality,
    parser_status: parserStatus,
    block_validation: blockValidation,
    duplicate_order_reconciliation_sources: tableResult.reconciliationCount > 0 ? lines.filter((line) => line.wasDuplicateReconciled).map((line) => ({
      product_code: line.productCode,
      source_block_index: line.reconciledFromBlockIndex,
      source_header: line.reconciledFromBlockHeader,
      source_page_number: line.reconciledFromPageNumber,
      source_logical_order_family: line.reconciledFromLogicalOrderFamily,
      source_operation_code: line.reconciledFromOperationCode
    })) : []
  };
  const manualReviewReasons = manualReviewReasonsFromValidation(blockValidation);
  const block = {
    blockIndex,
    blockType: "brand_order",
    sourceRole: "brand",
    sectionKind: "zw",
    candidateKind,
    isExcluded: false,
    header: headerNormalized,
    headerRaw,
    headerNormalized,
    warehouseSection: warehouseCode,
    warehouseCode,
    warehouseSectionCode: warehouseCode,
    warehouseSectionLabel: warehouseInfo.label,
    warehouseFamilyAlias,
    documentBrand,
    logicalOrderFamily,
    groupNameNormalized: null,
    shipmentCode: null,
    groupSourceLabel: null,
    pageNumber: blockRows[0]?.page ?? null,
    parserQuality,
    parserStatus,
    blockValidation,
    logicalOrderKey,
    reconstructedBlock,
    reconstructionSources,
    requiresManualReview: manualReviewReasons.length > 0,
    manualReviewReasons,
    metadata: {
      ...baseMetadata,
      requires_manual_review: manualReviewReasons.length > 0,
      manual_review_reasons: manualReviewReasons
    },
    lines
  };
  return { block, tableResult };
}
async function parsePdfAutoV4(buffer) {
  const tokens = await extractTokens(buffer);
  const rows = buildRows(tokens);
  const bandMap = detectBandsByPage(rows);
  const detectedRole = detectRole(rows);
  const starts = findBlockStarts(rows, detectedRole);
  let totalCollected = 0;
  let totalAssigned = 0;
  let totalCorrected = 0;
  const blocks = [];
  for (let index = 0; index < starts.length; index += 1) {
    const start = starts[index];
    const prevBlockStartIdx = index > 0 ? starts[index - 1].idx : 0;
    const end = index + 1 < starts.length ? starts[index + 1].idx : rows.length;
    const blockRows = rows.slice(start.idx, end);
    if (!blockRows.length) continue;
    const { block, tableResult } = detectedRole === "bc" ? parseBcBlockV4(rows, start, blockRows, bandMap, index, prevBlockStartIdx) : parseBrandBlockV4(rows, start, blockRows, bandMap, index, prevBlockStartIdx, blocks);
    blocks.push(block);
    totalCollected += tableResult.totalCollected;
    totalAssigned += tableResult.totalAssigned;
    totalCorrected += tableResult.correctionCount + tableResult.reconciliationCount;
  }
  const parserQuality = computeParserQuality(blocks, totalCollected, totalAssigned, totalCorrected);
  const parserStatus = computeParserStatus(parserQuality);
  const coverage = tokenCoverage(totalCollected, totalAssigned);
  const fileValidation = computeFileValidation(blocks, parserQuality, parserStatus, coverage);
  return { detectedRole, blocks, parserQuality, parserStatus, fileValidation };
}
export {
  parsePdfAutoV4
};
