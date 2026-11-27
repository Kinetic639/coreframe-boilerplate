"use client";

import { useTranslations } from "next-intl";
import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { usePwaStore } from "@/lib/stores/v2/pwa-store";

/**
 * "Install app" in the header: only while the browser offers installing
 * Ambra (Chrome, Edge, Android) and it is not installed yet. Opens the
 * browser's own install window.
 */
export function InstallAppButton() {
  const t = useTranslations("notificationCenter.push");
  const canInstall = usePwaStore((s) => s.canInstall);
  const installed = usePwaStore((s) => s.installed);
  const install = usePwaStore((s) => s.install);

  if (!canInstall || installed) return null;

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="h-8 gap-1.5 px-2 lg:px-2.5"
          onClick={() => void install()}
          aria-label={t("install")}
          data-testid="install-app"
        >
          <Download className="size-4" />
          <span className="hidden lg:inline">{t("install")}</span>
        </Button>
      </TooltipTrigger>
      <TooltipContent className="lg:hidden">{t("install")}</TooltipContent>
    </Tooltip>
  );
}
