"use client";

import { Link, usePathname } from "@/i18n/navigation";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, FileText, History } from "lucide-react";

export default function LabelsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="container mx-auto space-y-6">
      <div className="flex items-center gap-3">
        <QrCode className="h-8 w-8 text-muted-foreground" />
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Labels & QR Codes</h1>
          <p className="text-muted-foreground">Manage product and location labels</p>
        </div>
      </div>

      <LabelsTabs />

      <div className="mt-6">{children}</div>
    </div>
  );
}

function LabelsTabs() {
  const pathname = usePathname();

  // Determine active tab based on pathname
  const getActiveTab = () => {
    if (pathname.includes("/labels/templates")) return "templates";
    if (pathname.includes("/labels/history")) return "history";
    return "overview";
  };

  const activeTab = getActiveTab();

  return (
    <Tabs value={activeTab} className="w-full">
      <TabsList className="grid w-full grid-cols-3">
        <Link href="/dashboard/warehouse/labels">
          <TabsTrigger value="overview" className="flex w-full items-center gap-2">
            <QrCode className="h-4 w-4" />
            <span>Overview</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard/warehouse/labels/templates">
          <TabsTrigger value="templates" className="flex w-full items-center gap-2">
            <FileText className="h-4 w-4" />
            <span>Templates</span>
          </TabsTrigger>
        </Link>
        <Link href="/dashboard/warehouse/labels/history">
          <TabsTrigger value="history" className="flex w-full items-center gap-2">
            <History className="h-4 w-4" />
            <span>History</span>
          </TabsTrigger>
        </Link>
      </TabsList>
    </Tabs>
  );
}
