import { scoreSearchMatch } from "./match";
import { SEARCH_SCOPES, type SearchSourceId } from "./sources";
import type { SearchEntrySection } from "./types";

/** A palette row with its label already translated */
export interface PaletteItem {
  id: string;
  kind: "page" | "action";
  section: SearchEntrySection;
  label: string;
  subtitle?: string;
  keywords?: string[];
}

export type PaletteGroupId = "quickActions" | "goTo" | "pages" | "actions" | SearchEntrySection;

export interface PaletteGroup {
  id: PaletteGroupId;
  items: PaletteItem[];
}

export interface PaletteQuery {
  /** `>` prefix: actions only */
  actionsMode: boolean;
  /** Scope prefix (`zl:`, `cz:`, `@`, …): one data source only, no pages or actions */
  scope?: SearchSourceId;
  /** The prefix as typed, for the scope badge and Backspace */
  prefix?: string;
  /** Query text without the mode prefix */
  text: string;
}

export const ACTIONS_PREFIX = ">";

const EMPTY_QUICK_ACTIONS = 4;
const EMPTY_PAGES = 6;
const RESULT_PAGES = 8;
const RESULT_ACTIONS = 5;

/**
 * Splits the mode prefix off the query. `allowedScopes` limits which scope
 * prefixes are recognized (the user's searchable sources); others stay text.
 */
export function parsePaletteQuery(
  raw: string,
  allowedScopes?: readonly SearchSourceId[]
): PaletteQuery {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(ACTIONS_PREFIX)) {
    return {
      actionsMode: true,
      prefix: ACTIONS_PREFIX,
      text: trimmed.slice(ACTIONS_PREFIX.length).trim(),
    };
  }
  const lower = trimmed.toLowerCase();
  for (const { source, prefix } of SEARCH_SCOPES) {
    if (allowedScopes && !allowedScopes.includes(source)) continue;
    if (lower.startsWith(prefix)) {
      return {
        actionsMode: false,
        scope: source,
        prefix,
        text: trimmed.slice(prefix.length).trim(),
      };
    }
  }
  return { actionsMode: false, text: trimmed.trim() };
}

/** Rebuilds the query with another mode prefix, keeping the typed text */
export function withPalettePrefix(raw: string, prefix: string | null): string {
  const { text } = parsePaletteQuery(raw);
  return prefix ? `${prefix} ${text}` : text;
}

/** Usage score per item id (frecency); 0 when never opened */
export type PaletteUsage = (id: string) => number;

const NO_USAGE: PaletteUsage = () => 0;
/** How much one usage point weighs against text relevance */
const USAGE_WEIGHT = 2;

function rank(items: PaletteItem[], text: string, usage: PaletteUsage): PaletteItem[] {
  return items
    .map((item, index) => {
      const relevance = scoreSearchMatch(text, item.label, item.keywords);
      // Usage only reorders matches, it never makes a non-match appear
      return { item, index, score: relevance > 0 ? relevance + usage(item.id) * USAGE_WEIGHT : 0 };
    })
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

/** Most used first; registry order among equally used items */
function byUsage(items: PaletteItem[], usage: PaletteUsage): PaletteItem[] {
  return items
    .map((item, index) => ({ item, index, score: usage(item.id) }))
    .sort((a, b) => b.score - a.score || a.index - b.index)
    .map((row) => row.item);
}

function bySection(items: PaletteItem[]): PaletteGroup[] {
  const groups = new Map<SearchEntrySection, PaletteItem[]>();
  for (const item of items) {
    const list = groups.get(item.section) ?? [];
    list.push(item);
    groups.set(item.section, list);
  }
  return [...groups.entries()].map(([id, list]) => ({ id, items: list }));
}

/**
 * Builds the palette groups for a query.
 *
 * - Empty query: a few quick actions (module actions, not theme/sign-out) and pages.
 * - `>` mode: every matching action, grouped by module section.
 * - Text: best pages, then best actions.
 *
 * `items` keep their registry order; it breaks ties between equal scores.
 */
export function buildPaletteGroups(
  rawQuery: string,
  items: PaletteItem[],
  allowedScopes?: readonly SearchSourceId[],
  usage: PaletteUsage = NO_USAGE
): PaletteGroup[] {
  const { actionsMode, scope, text } = parsePaletteQuery(rawQuery, allowedScopes);
  const pages = items.filter((item) => item.kind === "page");
  const actions = items.filter((item) => item.kind === "action");

  // A scope prefix searches one data source only: no pages or actions
  if (scope) return [];

  if (actionsMode) {
    return bySection(text ? rank(actions, text, usage) : byUsage(actions, usage));
  }

  if (!text) {
    const groups: PaletteGroup[] = [
      {
        id: "quickActions",
        items: byUsage(
          actions.filter((item) => item.section !== "general"),
          usage
        ).slice(0, EMPTY_QUICK_ACTIONS),
      },
      { id: "goTo", items: byUsage(pages, usage).slice(0, EMPTY_PAGES) },
    ];
    return groups.filter((group) => group.items.length > 0);
  }

  const groups: PaletteGroup[] = [
    { id: "pages", items: rank(pages, text, usage).slice(0, RESULT_PAGES) },
    { id: "actions", items: rank(actions, text, usage).slice(0, RESULT_ACTIONS) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
