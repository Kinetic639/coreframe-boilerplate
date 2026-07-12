"use client";

import { useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";

export default function CrmError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const t = useTranslations("modules.crm.errors");

  useEffect(() => {
    console.error("[CRM] page error:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center gap-4 p-12 text-center">
      <p className="text-sm text-muted-foreground">{t("loadRetry")}</p>
      <Button variant="outline" size="sm" onClick={reset}>
        {t("tryAgain")}
      </Button>
    </div>
  );
}
