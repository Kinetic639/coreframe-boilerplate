"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ClipboardCheck, CalendarDays, History } from "lucide-react";

export default function AuditsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <ClipboardCheck className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Audits</h1>
          <p className="text-muted-foreground">Warehouse inventory audits management</p>
        </div>
      </div>

      <AuditsTabs />

      <div className="mt-6">{children}</div>
    </div>
  );
}

function AuditsTabs() {
  const pathname = usePathname();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname.includes("/audits/schedule")) return "schedule";
    if (pathname.includes("/audits/history")) return "history";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <Link href="/dashboard-old/warehouse/audits">
          <TabsTrigger value="overview" className="flex w-full items-center gap-2">
            <ClipboardCheck className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard-old/warehouse/audits/schedule">
          <TabsTrigger value="schedule" className="flex w-full items-center gap-2">
            <CalendarDays className="h-4 w-4" />
            <span>Schedule</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard-old/warehouse/audits/history">
          <TabsTrigger value="history" className="flex w-full items-center gap-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  );
}
