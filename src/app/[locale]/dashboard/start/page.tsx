"use client";

import { PageHeaderV2 } from "@/components/v2/layout/page-header";

export default function DashboardV2StartPage() {
  return (
    <div className="space-y-6">
      <PageHeaderV2
        title="Dashboard"
        description="Welcome to your dashboard. Select a module from the sidebar to get started."
      />
    </div>
  );
}
