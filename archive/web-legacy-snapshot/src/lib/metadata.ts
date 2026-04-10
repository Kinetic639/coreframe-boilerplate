import { getTranslations } from "next-intl/server";
import { Metadata } from "next";

export type MetadataProps = {
  params: Promise<{ locale: string }>;
};

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
  } = {}
): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  const metadata: Metadata = {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
  };

  // Add keywords if specified
  if (options.includeKeywords && options.keywords) {
    metadata.keywords = options.keywords;
  }

  // Add robots directive
  if (options.robots) {
    metadata.robots = options.robots;
  }

  // Add OpenGraph if specified (default true for public pages)
  if (options.openGraph !== false) {
    metadata.openGraph = {
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
      type: "website",
      siteName: common("appName"),
    };
  }

  // Add Twitter if specified (default true for public pages)
  if (options.twitter !== false) {
    metadata.twitter = {
      card: "summary",
      title: `${t("title")}${common("separator")}${common("appName")}`,
      description: t("description"),
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
  keywords?: string[]
): Promise<Metadata> {
  return generatePageMetadata(params, namespace, {
    includeKeywords: true,
    keywords,
    robots: { index: true, follow: true },
    openGraph: true,
    twitter: true,
  });
}
