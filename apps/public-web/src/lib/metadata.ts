import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { resolveLocalizedPathnames } from "@/i18n/localized-pathnames";

export type MetadataProps = {
  params: Promise<{ locale: string }>;
};

// pl is the default locale with no URL prefix (localePrefix: "as-needed" in routing.ts).
function buildLocaleAlternates(appUrl: string, pathnameKey: string, currentLocale: string) {
  const { en, pl } = resolveLocalizedPathnames(pathnameKey);
  const enUrl = en === "/" ? `${appUrl}/en` : `${appUrl}/en${en}`;
  const plUrl = pl === "/" ? appUrl : `${appUrl}${pl}`;
  return {
    canonical: currentLocale === "en" ? enUrl : plUrl,
    languages: { en: enUrl, pl: plUrl, "x-default": plUrl },
  };
}

export async function generatePageMetadata(
  params: MetadataProps["params"],
  namespace: string,
  options: {
    includeKeywords?: boolean;
    keywords?: string[];
    robots?: {
      index: boolean;
      follow: boolean;
    };
    openGraph?: boolean;
    twitter?: boolean;
    /** Key into routing.pathnames used to build canonical + hreflang alternates. */
    pathname?: string;
    /**
     * Root-relative image path for this page's OG/Twitter preview. When omitted,
     * Next.js falls back to the [locale]-level opengraph-image.png/twitter-image.png
     * file convention — most pages should leave this unset.
     */
    image?: string;
  } = {}
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  const common = await getTranslations({ locale, namespace: "metadata.common" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";
  const title = `${t("title")}${common("separator")}${common("appName")}`;
  const description = t("description");

  const metadata: Metadata = {
    title,
    description,
    metadataBase: new URL(appUrl),
  };

  // Add keywords if specified
  if (options.includeKeywords && options.keywords) {
    metadata.keywords = options.keywords;
  }

  // Add robots directive
  if (options.robots) {
    metadata.robots = options.robots;
  }

  // Add canonical + hreflang alternates when the page's routing key is known
  if (options.pathname) {
    metadata.alternates = buildLocaleAlternates(appUrl, options.pathname, locale);
  }

  // Add OpenGraph if specified (default true for public pages). Only set `images`
  // when a page explicitly overrides it — otherwise the [locale]-level
  // opengraph-image.png file convention is used automatically.
  if (options.openGraph !== false) {
    metadata.openGraph = {
      title,
      description,
      type: "website",
      siteName: common("appName"),
      ...(options.image ? { images: [{ url: options.image }] } : {}),
    };
  }

  // Add Twitter if specified (default true for public pages); same image fallback as above.
  if (options.twitter !== false) {
    metadata.twitter = {
      card: "summary_large_image",
      title,
      description,
      ...(options.image ? { images: [options.image] } : {}),
    };
  }

  return metadata;
}

// Utility for dashboard pages (no indexing, no social media tags)
export async function generateDashboardMetadata(
  params: MetadataProps["params"],
  namespace: string
): Promise<Metadata> {
  return generatePageMetadata(params, namespace, {
    robots: { index: false, follow: false },
    openGraph: false,
    twitter: false,
  });
}

// Utility for public pages (with SEO optimization)
export async function generatePublicMetadata(
  params: MetadataProps["params"],
  namespace: string,
  keywords?: string[],
  options: { pathname?: string; image?: string } = {}
): Promise<Metadata> {
  return generatePageMetadata(params, namespace, {
    includeKeywords: true,
    keywords,
    robots: { index: true, follow: true },
    openGraph: true,
    twitter: true,
    pathname: options.pathname,
    image: options.image,
  });
}

// Utility for auth-flow pages (indexed=false, no social preview — not share-worthy)
export async function generateAuthMetadata(
  params: MetadataProps["params"],
  namespace: string
): Promise<Metadata> {
  return generatePageMetadata(params, namespace, {
    robots: { index: false, follow: true },
    openGraph: false,
    twitter: false,
  });
}
