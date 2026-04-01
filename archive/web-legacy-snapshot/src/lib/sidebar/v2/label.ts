import type { SidebarItem } from "@/lib/types/v2/sidebar";

/**
 * Resolves the display label for a sidebar item.
 *
 * Uses `titleKey` + the provided translator when the key exists AND is present
 * in the message catalogue (translator.has returns true).
 * Falls back to `item.title` for items without a key, with an empty key, or
 * when the key is missing from the message files — preventing runtime crashes.
 *
 * Pure function — no React, no next-intl imports.
 * The translator object is injected so this remains testable without mocking hooks.
 */
export function resolveSidebarLabel(
  item: SidebarItem,
  translator: { t: (key: string) => string; has: (key: string) => boolean }
): string {
  const key = item.titleKey;
  if (key && translator.has(key)) return translator.t(key);
  return item.title;
}
