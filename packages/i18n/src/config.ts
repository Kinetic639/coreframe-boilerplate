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
  // Locale detection is intentionally ON: a first-time visitor with no cookie
  // yet should see their browser's preferred language (Accept-Language), and
  // once they explicitly switch locale in any of the three apps, that choice
  // must follow them to the other two -- they're one product split across
  // subdomains (app./www./vmi.ambra-system.com), not three unrelated sites.
  // The `localeCookie.domain` below (shared across all three apps in
  // production) is what makes the second half possible.
  //
  // Trade-off this accepts: an unprefixed URL like "/logowanie" is NOT
  // treated as "explicitly Polish" by next-intl -- it's just "no locale
  // prefix", so a visitor whose cookie/browser prefers English still gets
  // redirected to "/en/sign-in" even though the URL they typed looks Polish.
  // That's inherent to how localeDetection + localePrefix: "as-needed"
  // resolve unprefixed paths (see next-intl's resolveLocale: prefix > cookie
  // > accept-language > default), and is the correct trade-off given the
  // shared-preference requirement above. It does NOT reintroduce the
  // redirect-loop bug this pairs with a fix for -- see the `pl(?:/|$)`
  // matcher exclusion in each app's src/proxy.ts, which is orthogonal (it
  // stops the middleware from re-entering itself on next-intl's internal
  // rewrite target, regardless of what localeDetection is set to).
  localeDetection: true,
  localeCookie: {
    // Leave unset for local dev (all three apps run on 127.0.0.1 on
    // different ports; cookies aren't port-scoped, so a host-only cookie
    // already shares fine there). Set to ".ambra-system.com" via each app's
    // production env (Vercel project settings) so the cookie actually
    // spans app./www./vmi.ambra-system.com.
    domain: process.env.NEXT_PUBLIC_LOCALE_COOKIE_DOMAIN,
    sameSite: "lax" as const,
  },
} as const;
