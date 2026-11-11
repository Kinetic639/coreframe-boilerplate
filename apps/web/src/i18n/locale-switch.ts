import { getPathname } from "./navigation";
import { routing, type Locale } from "./routing";

export function getLocaleSwitchHref({
  pathname,
  params,
  locale,
  query = "",
  hash = "",
}: {
  pathname: string;
  params: Record<string, string | string[]>;
  locale: Locale;
  query?: string;
  hash?: string;
}) {
  // Both values describe the same current route, including dynamic parameters.
  const href = { pathname, params } as Parameters<typeof getPathname>[0]["href"];
  return getPathname({ href, locale }) + (query ? `?${query}` : "") + hash;
}

type LocaleCookieOptions = {
  name?: string;
  path?: string;
  domain?: string;
  sameSite?: boolean | "lax" | "strict" | "none";
  secure?: boolean;
  maxAge?: number;
};
export function getLocaleCookie(
  locale: Locale,
  options: LocaleCookieOptions = typeof routing.localeCookie === "object"
    ? routing.localeCookie
    : {}
) {
  return (
    `${options.name ?? "NEXT_LOCALE"}=${encodeURIComponent(locale)}; Path=${options.path ?? "/"}; SameSite=${options.sameSite === true ? "strict" : options.sameSite || "lax"}` +
    (options.domain ? `; Domain=${options.domain}` : "") +
    (options.secure ? "; Secure" : "") +
    (options.maxAge !== undefined ? `; Max-Age=${options.maxAge}` : "")
  );
}

export function navigateToLocale(locale: Locale, href: string) {
  document.cookie = getLocaleCookie(locale);
  // next-intl's router forces a prefix on locale changes. The default-locale
  // prefix is deliberately excluded from this app's middleware to avoid its
  // rewrite loop, so navigate to the canonical URL as a fresh document instead.
  window.location.replace(href);
}
