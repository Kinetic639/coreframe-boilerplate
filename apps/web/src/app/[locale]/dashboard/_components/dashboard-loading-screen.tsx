"use client";

import { useTranslations } from "next-intl";
import Loader from "@/components/ui/Loader";
import { cn } from "@/lib/utils";

/**
 * Full-screen branded loader of the dashboard: "starting" while the app
 * restores its settings after a page refresh, "page" while a route loads.
 */
export function DashboardLoadingScreen({
  kind,
  className,
}: {
  kind: "starting" | "page";
  className?: string;
}) {
  const t = useTranslations("common");
  return (
    <Loader
      fullScreen
      message={t(kind === "starting" ? "loadingApp" : "loadingPage")}
      className={cn("bg-background", className)}
    />
  );
}
