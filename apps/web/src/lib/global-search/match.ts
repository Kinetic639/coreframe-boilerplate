/**
 * Text matching for the global search palette.
 *
 * Pure functions: lower-case + diacritics-insensitive ("przyjecie" finds
 * "Przyjęcie"), word-prefix aware ("now zl" finds "Nowe zlecenie").
 */

/** Lower-cases and strips Polish (and other) diacritics */
export function normalizeSearchText(value: string): string {
  return value
    .toLowerCase()
    .replace(/ł/g, "l")
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function words(value: string): string[] {
  return value.split(/[\s/›>·,.:;()-]+/).filter(Boolean);
}

/** Whether every character of `needle` appears in `haystack` in order */
function isSubsequence(needle: string, haystack: string): boolean {
  let i = 0;
  for (const ch of haystack) {
    if (ch === needle[i]) i += 1;
    if (i === needle.length) return true;
  }
  return needle.length === 0;
}

function scoreToken(
  token: string,
  label: string,
  labelWords: string[],
  keywords: string[]
): number {
  if (labelWords.some((w) => w === token)) return 10;
  if (labelWords.some((w) => w.startsWith(token))) return 8;
  if (label.includes(token)) return 6;
  for (const keyword of keywords) {
    if (keyword === token) return 7;
    if (words(keyword).some((w) => w.startsWith(token))) return 5;
    if (keyword.includes(token)) return 4;
  }
  if (token.length >= 3 && isSubsequence(token, label)) return 1;
  return 0;
}

/**
 * Scores how well `query` matches an entry. 0 = no match. Every query word must
 * match the label or a keyword; a whole-label prefix match ranks highest.
 */
export function scoreSearchMatch(query: string, label: string, keywords: string[] = []): number {
  const q = normalizeSearchText(query);
  if (!q) return 1;
  const normalizedLabel = normalizeSearchText(label);
  const normalizedKeywords = keywords.map(normalizeSearchText);
  const labelWords = words(normalizedLabel);

  let total = 0;
  for (const token of words(q)) {
    const score = scoreToken(token, normalizedLabel, labelWords, normalizedKeywords);
    if (score === 0) return 0;
    total += score;
  }
  if (normalizedLabel.startsWith(q)) total += 20;
  return total;
}
