import type { SidebarItem } from "@/lib/types/v2/sidebar";

/**
 * Global search (Ctrl+K) entry types.
 *
 * Pure, JSON-serializable data: entries are resolved server-side with the same
 * visibility rules as the sidebar (permissions + entitlements) and handed to the
 * client palette as props. NO React components, NO client-only imports.
 */

/** Section a static entry is listed under in the palette */
export type SearchEntrySection =
  | "warehouse"
  | "workshop"
  | "helpDesk"
  | "planning"
  | "crm"
  | "organization"
  | "analytics"
  | "tools"
  | "account"
  | "general";

/**
 * Client-side commands an action entry can run. Navigation actions use `href`
 * instead; a command is only needed when an action does more than navigate.
 */
export type SearchCommandId = "theme.toggle" | "colorTheme.pick" | "locale.toggle" | "auth.signOut";

/**
 * A page or action the palette can show without a database query.
 *
 * Extends SidebarItem so the sidebar resolver filters it with the very same
 * visibility rules. Entries are flat: `children` is never used.
 */
export interface SearchEntry extends SidebarItem {
  kind: "page" | "action";
  section: SearchEntrySection;
  /** Extra words the entry is found by (synonyms, Polish and English) */
  keywords?: string[];
  /** Client command run instead of navigating */
  command?: SearchCommandId;
  /** Shortcut hint shown on the row (display only) */
  shortcut?: string;
  /** Parent page title key, shown as the row subtitle ("Magazyn › Ruchy") */
  parentTitleKey?: string;
  parentTitle?: string;
}
