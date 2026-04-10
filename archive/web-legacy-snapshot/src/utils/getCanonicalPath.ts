import { routing } from "@/i18n/routing";

// Znajdź kanoniczny klucz ścieżki, np. "/dashboard/warehouse/products/materials"
export function getCanonicalPath(localizedPath: string): string | null {
  const map = routing.pathnames as Record<string, string | Record<string, string>>;

  for (const canonical in map) {
    const value = map[canonical];

    if (typeof value === "string") {
      if (value === localizedPath) return canonical;
    } else {
      for (const locale in value) {
        if (value[locale] === localizedPath) return canonical;
      }
    }
  }

  return null;
}
