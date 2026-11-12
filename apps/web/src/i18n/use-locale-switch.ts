"use client";

import { useCallback } from "react";
import { useParams } from "next/navigation";
import { hasLocale } from "next-intl";
import { usePathname } from "./navigation";
import { routing } from "./routing";
import { getLocaleSwitchHref, navigateToLocale } from "./locale-switch";

export function useLocaleSwitch() {
  const pathname = usePathname(),
    params = useParams();
  return useCallback(
    (locale: string) => {
      if (!hasLocale(routing.locales, locale)) return;
      const href = getLocaleSwitchHref({
        pathname,
        params,
        locale,
        query: window.location.search.slice(1),
        hash: window.location.hash,
      });
      navigateToLocale(locale, href);
    },
    [pathname, params]
  );
}
