"use client";

import { useTranslations } from "next-intl";
import { BrandLoader } from "@/components/branding";

export default function OrgUsersLoading() {
  const t = useTranslations("common");

  return (
    <div className="flex min-h-[calc(100vh-10rem)] items-center justify-center">
      <BrandLoader
        variant="beacon_swap"
        label={t("loading")}
        showWordmark={false}
        logoClassName="h-[9.6rem] w-[9.6rem]"
      />
    </div>
  );
}
