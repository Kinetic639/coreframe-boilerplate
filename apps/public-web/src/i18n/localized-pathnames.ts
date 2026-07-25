import { routing } from "./routing";

type LocalizedPathname = string | { en: string; pl: string };

// `routing.pathnames` keys are the internal (English-ish) path used across the app;
// values are either a shared string or a per-locale slug map (see src/i18n/routing.ts).
export function resolveLocalizedPathnames(pathnameKey: string): { en: string; pl: string } {
  const entry = (routing.pathnames as Record<string, LocalizedPathname>)[pathnameKey];
  if (!entry) return { en: pathnameKey, pl: pathnameKey };
  if (typeof entry === "string") return { en: entry, pl: entry };
  return entry;
}
