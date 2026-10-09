import { resolveSidebarModel } from "@/lib/sidebar/v2/resolver";
import type { SidebarItem, SidebarModel, SidebarResolverInput } from "@/lib/types/v2/sidebar";
import {
  SEARCH_ACTIONS,
  SEARCH_EXCLUDED_HREFS,
  SEARCH_EXTRA_PAGES,
  SIDEBAR_SEARCH_KEYWORDS,
} from "./registry";
import type { SearchEntry, SearchEntrySection } from "./types";

const SECTION_BY_ROOT_ID: Record<string, SearchEntrySection> = {
  warehouse: "warehouse",
  workshop: "workshop",
  "help-desk": "helpDesk",
  planning: "planning",
  crm: "crm",
  organization: "organization",
  analytics: "analytics",
  tools: "tools",
};

function sectionFor(rootId: string): SearchEntrySection {
  return SECTION_BY_ROOT_ID[rootId] ?? "general";
}

/**
 * Flattens the already resolved sidebar model into page entries. Groups without
 * an href, disabled items and placeholder pages are skipped; the nearest parent
 * becomes the row subtitle.
 */
function pagesFromSidebar(model: SidebarModel): SearchEntry[] {
  const out: SearchEntry[] = [];
  const seen = new Set<string>();

  const walk = (items: SidebarItem[], rootId: string | null, parent: SidebarItem | null) => {
    for (const item of items) {
      const root = rootId ?? item.id;
      if (
        item.href &&
        !item.disabledReason &&
        !SEARCH_EXCLUDED_HREFS.has(item.href) &&
        !seen.has(item.href)
      ) {
        seen.add(item.href);
        out.push({
          id: item.id,
          kind: "page",
          section: sectionFor(root),
          title: item.title,
          titleKey: item.titleKey,
          iconKey: item.iconKey,
          href: item.href,
          keywords: SIDEBAR_SEARCH_KEYWORDS[item.id],
          parentTitle: parent?.title,
          parentTitleKey: parent?.titleKey,
        });
      }
      if (item.children?.length) walk(item.children, root, item);
    }
  };

  walk(model.main, null, null);
  walk(model.footer, null, null);
  return out;
}

/** Applies the sidebar visibility rules to flat registry entries */
function resolveEntries(entries: SearchEntry[], input: SidebarResolverInput): SearchEntry[] {
  const resolved = resolveSidebarModel(input, { main: entries, footer: [] }).main as SearchEntry[];
  return resolved
    .filter((entry) => !entry.disabledReason)
    .map(({ visibility: _visibility, ...entry }) => entry);
}

/**
 * Builds the static part of the global search: every page and action the user
 * may open, filtered with the same permissions + entitlements as the sidebar.
 *
 * Pure and deterministic — called server-side from the dashboard layout with the
 * resolved sidebar model, the result is passed to the client palette as props.
 */
export function buildSearchEntries(
  sidebarModel: SidebarModel,
  input: SidebarResolverInput
): SearchEntry[] {
  const sidebarPages = pagesFromSidebar(sidebarModel);
  const sidebarHrefs = new Set(sidebarPages.map((entry) => entry.href));
  const extraPages = resolveEntries(SEARCH_EXTRA_PAGES, input).filter(
    (entry) => !sidebarHrefs.has(entry.href)
  );
  const actions = resolveEntries(SEARCH_ACTIONS, input);
  return [...sidebarPages, ...extraPages, ...actions];
}
