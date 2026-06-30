export type CaseNormalization = "none" | "upper" | "lower" | "title";
export type SkuWhitespaceNormalization = "keep" | "remove" | "replace";
export type SkuSpecialCharacterNormalization = "keep" | "remove_selected" | "remove_all";

export function parseCsvLine(line: string) {
  const cells: string[] = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];
    if (char === '"' && quoted && next === '"') {
      cell += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === "," && !quoted) {
      cells.push(cell);
      cell = "";
    } else {
      cell += char;
    }
  }
  cells.push(cell);
  return cells;
}

export function parseCsvText(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;

  for (let index = 0; index < text.length; index += 1) {
    const char = text[index];
    const next = text[index + 1];
    if (char === '"' && inQuotes && next === '"') {
      cell += '"';
      index += 1;
      continue;
    }
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === "," && !inQuotes) {
      row.push(cell);
      cell = "";
      continue;
    }
    if ((char === "\n" || char === "\r") && !inQuotes) {
      if (char === "\r" && next === "\n") index += 1;
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
      continue;
    }
    cell += char;
  }

  row.push(cell);
  if (row.some((value) => value.trim())) rows.push(row);
  return rows;
}

export function csvCell(value: string) {
  return /[",\n\r]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

export function csvEscape(value: unknown) {
  const text = String(value ?? "");
  return csvCell(text);
}

export function csvLines(csv: string) {
  return csv
    .replace(/^\uFEFF/, "")
    .split(/\r?\n/)
    .filter((line) => line.trim().length > 0);
}

export function numberOrNull(value: string | undefined) {
  if (!value?.trim()) return null;
  const number = Number(value.replace(",", "."));
  return Number.isFinite(number) ? number : null;
}

export function safeSplitTokens(value: string) {
  return value
    .split(/[|,\n]/)
    .map((item) => item.trim())
    .filter(Boolean);
}

export function normalizeCaseValue(value: string, mode: CaseNormalization) {
  const text = value.trim();
  if (mode === "upper") return text.toUpperCase();
  if (mode === "lower") return text.toLowerCase();
  if (mode === "title") {
    return text
      .toLowerCase()
      .replace(/\p{L}[\p{L}\p{M}'-]*/gu, (word) => word[0].toUpperCase() + word.slice(1));
  }
  return text;
}

export function normalizeSkuValue(
  value: string,
  caseMode: CaseNormalization,
  whitespaceMode: SkuWhitespaceNormalization,
  replacement: string,
  specialMode: SkuSpecialCharacterNormalization,
  specialCharacters: string
) {
  let sku = normalizeCaseValue(value, caseMode);
  if (whitespaceMode === "remove") sku = sku.replace(/\s+/g, "");
  if (whitespaceMode === "replace") sku = sku.replace(/\s+/g, replacement || "-");
  if (specialMode === "remove_selected" && specialCharacters) {
    const escaped = specialCharacters.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    sku = sku.replace(new RegExp(`[${escaped}]`, "g"), "");
  }
  if (specialMode === "remove_all") {
    sku = sku.replace(/[^\p{L}\p{N}]/gu, "");
  }
  return sku;
}

export function skuCollisionFingerprint(value: string | null | undefined) {
  return (value ?? "")
    .trim()
    .toUpperCase()
    .replace(/[^\p{L}\p{N}]/gu, "");
}

export function normalizeImportToken(value: string | null | undefined) {
  return (value ?? "").trim().toLowerCase();
}

export function normalizeImportedSku(value: string | null | undefined) {
  return normalizeSkuValue(value ?? "", "upper", "remove", "-", "keep", "");
}

export function normalizeImportedProductName(value: string | null | undefined) {
  return (value ?? "").trim().replace(/\s+/g, " ");
}

export function normalizeImportedUnitCode(value: string | null | undefined) {
  return normalizeImportedSku(value).slice(0, 20);
}

export function parseTokenString(value: string) {
  return value
    .split(",")
    .map((token) => token.trim())
    .filter(Boolean);
}

export function formatTokenString(tokens: string[]) {
  return tokens.join(", ");
}

export function slugKey(value: string) {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

export function mergeById<T extends { id: string }>(current: T[], incoming: T[]) {
  const merged = new Map<string, T>();
  current.forEach((item) => merged.set(item.id, item));
  incoming.forEach((item) => merged.set(item.id, item));
  return Array.from(merged.values());
}

export function sameIdsInOrder<T extends { id: string }>(left: T[], right: T[]) {
  return left.length === right.length && left.every((item, index) => item.id === right[index]?.id);
}
