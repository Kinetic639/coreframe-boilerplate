"use client";

import { usePathname } from "@/i18n/navigation";

/**
 * Custom hook to get the current pathname in a consistent way
 * Uses next-intl's usePathname which returns locale-agnostic pathname
 */
export function useCurrentPath(): string {
  return usePathname();
}
