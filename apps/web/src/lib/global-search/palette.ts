import { scoreSearchMatch } from "./match";
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
  /** Query text without the mode prefix */
  text: string;
}

export const ACTIONS_PREFIX = ">";

const EMPTY_QUICK_ACTIONS = 4;
const EMPTY_PAGES = 6;
const RESULT_PAGES = 8;
const RESULT_ACTIONS = 5;

export function parsePaletteQuery(raw: string): PaletteQuery {
  const trimmed = raw.trimStart();
  if (trimmed.startsWith(ACTIONS_PREFIX)) {
    return { actionsMode: true, text: trimmed.slice(ACTIONS_PREFIX.length).trim() };
  }
  return { actionsMode: false, text: trimmed.trim() };
}

function rank(items: PaletteItem[], text: string): PaletteItem[] {
  return items
    .map((item, index) => ({
      item,
      index,
      score: scoreSearchMatch(text, item.label, item.keywords),
    }))
    .filter((row) => row.score > 0)
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
export function buildPaletteGroups(rawQuery: string, items: PaletteItem[]): PaletteGroup[] {
  const { actionsMode, text } = parsePaletteQuery(rawQuery);
  const pages = items.filter((item) => item.kind === "page");
  const actions = items.filter((item) => item.kind === "action");

  if (actionsMode) {
    return bySection(text ? rank(actions, text) : actions);
  }

  if (!text) {
    const groups: PaletteGroup[] = [
      {
        id: "quickActions",
        items: actions.filter((item) => item.section !== "general").slice(0, EMPTY_QUICK_ACTIONS),
      },
      { id: "goTo", items: pages.slice(0, EMPTY_PAGES) },
    ];
    return groups.filter((group) => group.items.length > 0);
  }

  const groups: PaletteGroup[] = [
    { id: "pages", items: rank(pages, text).slice(0, RESULT_PAGES) },
    { id: "actions", items: rank(actions, text).slice(0, RESULT_ACTIONS) },
  ];
  return groups.filter((group) => group.items.length > 0);
}
