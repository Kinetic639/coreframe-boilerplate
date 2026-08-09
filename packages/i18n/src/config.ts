/**
 * Single source of truth for the locale/routing settings shared by every app
 * in this monorepo (apps/web, apps/public-web, apps/vmi-client). Each app's
 * own `i18n/routing.ts` spreads `baseRoutingConfig` and adds its own
 * `pathnames` map on top -- the scalar settings below (which locales exist,
 * which one is default, how prefixing works, whether to trust
 * Accept-Language) must never diverge between apps, or the three sites will
 * behave inconsistently for the same visitor.
 */

export const LOCALES = ["en", "pl"] as const;
export type Locale = (typeof LOCALES)[number];

export const DEFAULT_LOCALE: Locale = "pl";

export const baseRoutingConfig = {
  locales: LOCALES,
  defaultLocale: DEFAULT_LOCALE,
  localePrefix: "as-needed",
  // Explicit URLs must always win over browser-language guessing: a visitor
  // who types/bookmarks/clicks an unprefixed pl URL should see Polish even if
  // their browser's Accept-Language prefers English. Without this, next-intl's
  // default detection redirects any cookie-less request to the negotiated-
  // from-Accept-Language locale regardless of which locale's URL was actually
  // requested. See apps/web/src/proxy.ts for the related middleware-matcher
  // fix this pairs with.
  localeDetection: false,
  localeCookie: {
    domain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
    sameSite: "lax" as const,
  },
} as const;
