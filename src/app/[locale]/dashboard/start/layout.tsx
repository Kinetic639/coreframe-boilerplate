"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { LayoutDashboard, Rocket, Bell } from "lucide-react";
import { useTranslations } from "next-intl";

export default function StartLayout({ children }: { children: React.ReactNode }) {
  const t = useTranslations("pages.start");

  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <LayoutDashboard className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      <StartTabs />

      <div className="mt-6">{children}</div>
    </div>
  );
}

function StartTabs() {
  const pathname = usePathname();
  const t = useTranslations("pages.start.tabs");

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname.includes("/start/getting-started")) return "getting-started";
    if (pathname.includes("/start/recent-updates")) return "recent-updates";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <Link href="/dashboard/start">
          <TabsTrigger value="overview" className="flex w-full items-center gap-2">
            <LayoutDashboard className="h-4 w-4" />
            <span>{t("overview")}</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard/start/getting-started">
          <TabsTrigger value="getting-started" className="flex w-full items-center gap-2">
            <Rocket className="h-4 w-4" />
            <span>{t("gettingStarted")}</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard/start/recent-updates">
          <TabsTrigger value="recent-updates" className="flex w-full items-center gap-2">
            <Bell className="h-4 w-4" />
            <span>{t("recentUpdates")}</span>
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  );
}
