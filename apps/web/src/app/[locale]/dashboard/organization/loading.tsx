"use client";

import { useTranslations } from "next-intl";
import { BrandLoader } from "@/components/branding";

export default function OrgLoading() {
  const t = useTranslations("common");

  return (
    <div className="flex flex-1 items-center justify-center py-24">
      <BrandLoader
        variant="beacon_swap"
        label={t("loading")}
        showWordmark={false}
        logoClassName="h-32 w-32"
      />
    </div>
  );
}
