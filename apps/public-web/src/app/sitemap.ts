import type { MetadataRoute } from "next";
import { createServiceClient } from "@/utils/supabase/service";
import { resolveLocalizedPathnames } from "@/i18n/localized-pathnames";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

// Only genuinely indexable, crawler-worthy public routes — auth/utility pages
// get robots: noindex in their own metadata and are intentionally left out here.
const PUBLIC_ROUTES = [
  "/",
  "/features",
  "/pricing",
  "/tools/svwms-wdd-matcher",
  "/vmi",
  "/vmi/vendors",
  "/vmi/products",
] as const;

export default async function sitemap(): Promise<MetadataRoute.Sitemap> {
  const appUrl = process.env.NEXT_PUBLIC_SITE_URL ?? "https://www.ambra-system.com";
  const now = new Date();

  const staticEntries: MetadataRoute.Sitemap = PUBLIC_ROUTES.map((route) => {
    const { en, pl } = resolveLocalizedPathnames(route);
    const enUrl = en === "/" ? `${appUrl}/en` : `${appUrl}/en${en}`;
    const plUrl = pl === "/" ? appUrl : `${appUrl}${pl}`;
    return {
      url: plUrl,
      lastModified: now,
      alternates: { languages: { en: enUrl, pl: plUrl } },
    };
  });

  // Branch warehouse maps are public per-org opt-in pages (public_warehouse_maps_enabled) —
  // enumerate them so search engines can discover branches that chose to publish their map.
  let branchEntries: MetadataRoute.Sitemap = [];
  try {
    const supabase = createServiceClient();
    const { data: branches } = await supabase
      .from("branches")
      .select("id, created_at")
      .eq("public_warehouse_maps_enabled", true)
      .is("deleted_at", null);

    branchEntries = (branches ?? []).map((branch) => ({
      url: `${appUrl}/maps/${branch.id}`,
      lastModified: branch.created_at ? new Date(branch.created_at) : now,
    }));
  } catch {
    // Don't fail the whole sitemap if the DB is unreachable at build/request time.
  }

  let marketplaceEntries: MetadataRoute.Sitemap = [];
  try {
    const snapshot = await PublicMarketplaceRepository.getMarketplaceSnapshot();
    if (snapshot.success) {
      marketplaceEntries = [
        ...snapshot.data.suppliers.map((supplier) => ({
          url: `${appUrl}/vmi/vendors/${supplier.slug}`,
          lastModified: now,
        })),
        ...snapshot.data.products.map((product) => ({
          url: `${appUrl}/vmi/products/${product.slug}`,
          lastModified: now,
        })),
        ...snapshot.data.flyers.map((flyer) => ({
          url: `${appUrl}/vmi/flyers/${flyer.slug}`,
          lastModified: now,
        })),
      ];
    }
  } catch {
    // Keep the sitemap available even if marketplace data cannot be read.
  }

  return [...staticEntries, ...branchEntries, ...marketplaceEntries];
}
