"use client";

import { useTranslations } from "next-intl";
import { BUILD_VERSION_LABEL } from "@/lib/app-version";
import { useWhatsNewStore } from "./whats-new-store";

/** "Version 1.4.0 (a1b2c3d)" under the user menu; opens "What's new". Hidden when collapsed. */
export function SidebarVersion() {
  const t = useTranslations("appVersion");
  const setOpen = useWhatsNewStore((s) => s.setOpen);

  return (
    <button
      type="button"
      onClick={() => setOpen(true)}
      title={t("whatsNew")}
      className="w-full rounded px-2 text-left text-[11px] leading-5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring group-data-[collapsible=icon]:hidden"
    >
      {t("label", { version: BUILD_VERSION_LABEL })}
    </button>
  );
}
