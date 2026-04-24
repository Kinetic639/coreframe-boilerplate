"use client";

import dynamic from "next/dynamic";
import { BrandLoader } from "@/components/branding";
import type { PublicWarehouseMapsPageClientProps } from "./public-warehouse-maps-page-client";

const PublicWarehouseMapsPageClient = dynamic(
  () =>
    import("./public-warehouse-maps-page-client").then((module) => ({
      default: module.PublicWarehouseMapsPageClient,
    })),
  {
    ssr: false,
    loading: () => (
      <div className="flex min-h-[60vh] w-full items-center justify-center rounded-2xl border bg-background/70">
        <BrandLoader variant="beacon_swap" showWordmark={false} label="" />
      </div>
    ),
  }
);

export function PublicWarehouseMapsPageShell(props: PublicWarehouseMapsPageClientProps) {
  return <PublicWarehouseMapsPageClient {...props} />;
}
