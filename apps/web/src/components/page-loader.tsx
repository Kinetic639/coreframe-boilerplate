"use client";

import { useTranslations } from "next-intl";
import { BrandLoader } from "@/components/branding";
import { cn } from "@/lib/utils";

interface PageLoaderProps {
  className?: string;
}

export function PageLoader({ className }: PageLoaderProps) {
  const t = useTranslations("common");

  return (
    <div className={cn("flex flex-1 items-center justify-center", className)}>
      <BrandLoader
        variant="beacon_swap"
        label={t("loading")}
        showWordmark={false}
        logoClassName="h-[7.68rem] w-[7.68rem]"
      />
    </div>
  );
}
