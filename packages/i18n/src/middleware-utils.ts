/**
 * Shared middleware helpers for composing next-intl with custom logic
 * (Supabase session checks, etc.) across apps/web, apps/public-web, and
 * apps/vmi-client. See buildMiddlewareMatcher's doc comment for the specific
 * bug this exists to prevent -- it was independently reintroduced in two
 * apps before being pulled out here as the single source of truth.
 */

/**
 * Strips a leading locale segment from a pathname, if present, returning the
 * path as if that locale weren't there (e.g. "/en/sign-in" -> "/sign-in",
 * "/sign-in" -> "/sign-in", "/en" -> "/").
 */
export function pathnameWithoutLocale(pathname: string, locales: readonly string[]): string {
  const [, maybeLocale, ...rest] = pathname.split("/");
  if (maybeLocale && locales.includes(maybeLocale)) {
    return rest.length > 0 ? `/${rest.join("/")}` : "/";
  }
  return pathname;
}

const DEFAULT_MATCHER_EXCLUDES = [
  "api",
  "_next/static",
  "_next/image",
  "favicon.ico",
  "robots.txt",
  "sitemap.xml",
  "manifest.webmanifest",
];

const DEFAULT_MATCHER_EXTENSION_EXCLUDE = ".*\\.(?:svg|png|jpg|jpeg|gif|webp)$";

/**
 * Computes the `config.matcher` pattern an app composing next-intl with
 * custom logic (e.g. a Supabase session check) needs, gated by
 * `routing.localePrefix === "as-needed"` and a non-English `defaultLocale`.
 *
 * ⚠️ DO NOT call this inside an actual `export const config = { matcher: ... }`.
 * Per Next.js's own docs: "Matcher values must be constants to allow for
 * static analysis at build-time; dynamic values are ignored." A function
 * call there is silently ignored, which reintroduces the exact loop this is
 * meant to prevent (this happened once already -- see git history on
 * apps/web/src/proxy.ts and apps/public-web/src/proxy.ts). Each app's
 * `config.matcher` must stay a literal array of string patterns. Use this
 * function only as a reference/generator to keep that literal in sync across
 * apps/web, apps/public-web, and apps/vmi-client (e.g. call it in a script
 * or the dev console and paste the result), or in tests that assert the
 * literal matches what this would produce.
 *
 * Why the `pl(?:/|$)` exclusion exists at all: with `localePrefix:
 * "as-needed"`, next-intl internally rewrites an unprefixed default-locale
 * request (e.g. "/logowanie") to its underlying route ("/pl/sign-in"). That
 * rewritten URL would also match a naive matcher, so Next.js re-enters the
 * middleware for it. On that second pass, next-intl (correctly, per its own
 * "as-needed" semantics) sees the explicit locale prefix as superfluous and
 * redirects back to the unprefixed form -- which is the exact URL that
 * produced the rewrite, causing an infinite redirect loop (and, if the app's
 * middleware also does an async check like a Supabase session lookup, that
 * check re-running on the second pass can turn the loop into an outright
 * hang).
 *
 * The fix is to exclude the internal rewrite target from the matcher
 * entirely, so Next.js's own `[locale]` route renders it directly instead of
 * re-entering the middleware. A genuine external request to "/pl/..." (e.g.
 * an old bookmark) still renders correctly via the `[locale]` route, just
 * without next-intl's redirect-to-canonical-URL nicety.
 */
export function buildMiddlewareMatcher(options: {
  defaultLocale: string;
  /** Additional path prefixes to exclude, e.g. ["auth"] for a Supabase auth callback route. */
  exclude?: string[];
}): string[] {
  const excludes = [...DEFAULT_MATCHER_EXCLUDES, ...(options.exclude ?? [])];
  const excludePattern = excludes.join("|");
  return [
    `/((?!${excludePattern}|${options.defaultLocale}(?:/|$)|${DEFAULT_MATCHER_EXTENSION_EXCLUDE}).*)`,
  ];
}
