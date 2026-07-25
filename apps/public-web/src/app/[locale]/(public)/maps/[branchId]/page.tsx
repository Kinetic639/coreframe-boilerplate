import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { NextIntlClientProvider } from "next-intl";
import { getMessages, getTranslations } from "next-intl/server";
import { getPublicWarehouseBranchBundleAction } from "@/app/actions/warehouse/public-maps";
import { PublicWarehouseMapsPageShell } from "./_components/public-warehouse-maps-page-shell";
import { createClient } from "@/utils/supabase/server";

interface Props {
  params: Promise<{ locale: string; branchId: string }>;
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale, branchId } = await params;
  const common = await getTranslations({ locale, namespace: "metadata.common" });
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? "http://localhost:3000";

  // Lightweight lookup — only the branch name is needed for metadata, unlike the
  // full bundle (layouts/locations/shapes) the page body fetches separately.
  const branchName = await (async () => {
    try {
      const supabase = await createClient();
      const { data } = await supabase
        .from("branches")
        .select("name")
        .eq("id", branchId)
        .eq("public_warehouse_maps_enabled", true)
        .is("deleted_at", null)
        .maybeSingle();
      return data?.name ?? null;
    } catch {
      return null;
    }
  })();

  if (!branchName) {
    return {
      title: common("appName"),
      robots: { index: false, follow: false },
    };
  }

  const t = await getTranslations({ locale, namespace: "metadata.public.maps" });
  const title = `${t("title", { branchName })}${common("separator")}${common("appName")}`;
  const description = t("description", { branchName });

  return {
    title,
    description,
    metadataBase: new URL(appUrl),
    robots: { index: true, follow: true },
    // No `images` override — inherits the [locale]-level opengraph-image.png /
    // twitter-image.png file convention as the social preview.
    openGraph: {
      title,
      description,
      type: "website",
      siteName: common("appName"),
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  };
}

export default async function PublicWarehouseMapsPage({ params }: Props) {
  const { branchId } = await params;
  const messages = await getMessages();
  const result = await getPublicWarehouseBranchBundleAction(branchId);

  if (!result.success || !result.data) {
    notFound();
  }

  return (
    <NextIntlClientProvider messages={messages}>
      <PublicWarehouseMapsPageShell
        branch={result.data.branch}
        layouts={result.data.layouts}
        locations={result.data.locations}
        locationGroups={result.data.locationGroups}
      />
    </NextIntlClientProvider>
  );
}
