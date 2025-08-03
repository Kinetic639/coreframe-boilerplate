import { Metadata } from "next";
import { ActivityFeed } from "@/components/activities/ActivityFeed";

export const metadata: Metadata = {
  title: "Activity Log",
  description: "Detailed activity log with advanced filtering and search",
};

export default function ActivitiesPage() {
  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Log</h1>
        <p className="text-muted-foreground">
          Comprehensive activity log with advanced filtering, search, and export capabilities
        </p>
      </div>

      {/* Activity Feed */}
      <ActivityFeed
        title="All Activities"
        description="Complete activity history for your organization"
        showFilters={true}
        compact={false}
        limit={25}
        maxHeight="none"
        autoRefresh={true}
        refreshInterval={60000} // 1 minute
      />
    </div>
  );
}
