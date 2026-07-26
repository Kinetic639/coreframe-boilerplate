import type { MetadataRoute } from "next";
import { resolveLocalizedPathnames } from "@/i18n/localized-pathnames";

// Routes that should never be indexed: authenticated areas, transactional/token
// flows, and auth forms. Listed by their internal (routing.pathnames) key so both
// locale slugs get disallowed automatically.
const NOINDEX_ROUTE_KEYS = [
  "/sign-in",
  "/sign-up",
  "/forgot-password",
  "/reset-password",
  "/auth-code-error",
  "/registration-disabled",
  "/onboarding",
  "/invite/[token]",
  "/invite/resolve",
  "/qr/[token]",
] as const;

function toDisallowPrefix(localizedPath: string): string {
  // Strip a trailing dynamic segment (e.g. "/invite/[token]" -> "/invite") so the
  // disallow entry matches the whole subtree via a trailing wildcard.
  const withoutDynamicSegment = localizedPath.replace(/\/\[[^\]]+\]$/, "");
  return withoutDynamicSegment === "" ? "/" : withoutDynamicSegment;
}

export default function robots(): MetadataRoute.Robots {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";

  const disallow = new Set<string>(["/dashboard", "/en/dashboard", "/admin", "/en/admin"]);

  for (const key of NOINDEX_ROUTE_KEYS) {
    const { en, pl } = resolveLocalizedPathnames(key);
    disallow.add(toDisallowPrefix(pl));
    disallow.add(`/en${toDisallowPrefix(en)}`);
  }

  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: Array.from(disallow),
    },
    sitemap: `${appUrl}/sitemap.xml`,
  };
}
