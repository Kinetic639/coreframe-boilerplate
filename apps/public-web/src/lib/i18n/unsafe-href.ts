/**
 * Converts a dynamic string href to next-intl's expected typed route type.
 *
 * next-intl's Link component (from createNavigation with typed routes) only accepts
 * statically-known route paths. Sidebar registry hrefs are dynamic strings defined
 * in the nav registry and cannot be statically typed to match the route union.
 *
 * This helper centralizes the unsafe cast so call sites stay clean.
 * The cast is intentional and safe: the registry hrefs are always valid app paths.
 */

export function toUnsafeI18nHref(href: string): any {
  return href as any;
}
