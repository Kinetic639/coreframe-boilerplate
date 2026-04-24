import React from "react";
import { notFound } from "next/navigation";
import Pricing from "./pricing";
import { generatePublicMetadata, MetadataProps } from "@/lib/metadata";
import { createServiceClient } from "@/utils/supabase/service";
import { SiteSettingsService } from "@/server/services/site-settings.service";

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: MetadataProps) {
  return generatePublicMetadata(params, "metadata.public.pricing", [
    "pricing",
    "SaaS pricing",
    "enterprise plans",
    "warehouse management pricing",
    "business software cost",
    "Ambra pricing",
    "cennik",
    "opłaty SaaS",
    "plany enterprise",
  ]);
}

const page = async () => {
  const settings = await SiteSettingsService.getSettings(createServiceClient());
  if (!settings.pricingPageEnabled) notFound();
  return <Pricing />;
};

export default page;
