import { Metadata } from "next";
import { ActivityTimeline } from "@/components/activities/ActivityTimeline";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export const metadata: Metadata = {
  title: "Activity Timeline",
  description: "Visual timeline view of activities with chronological grouping",
};

export default function TimelinePage() {
  // This would be populated with actual data from the ActivityService
  const mockActivities: never[] = []; // In a real implementation, this would come from a server component or API

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Timeline</h1>
        <p className="text-muted-foreground">
          Visual timeline view of activities grouped chronologically for better insights
        </p>
      </div>

      {/* Filters and Timeline */}
      <div className="grid gap-6 lg:grid-cols-4">
        <div className="lg:col-span-1">
          <Card>
            <CardHeader>
              <CardTitle>Filters</CardTitle>
              <CardDescription>Filter activities by date, module, or user</CardDescription>
            </CardHeader>
            <CardContent>
              {/* This would be a simplified version of ActivityFilters */}
              <div className="space-y-4">
                <div className="text-sm text-muted-foreground">
                  Timeline filters will be implemented here
                </div>
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-3">
          <ActivityTimeline
            activities={mockActivities}
            title="Chronological Timeline"
            maxHeight="800px"
            showGrouping={true}
          />
        </div>
      </div>
    </div>
  );
}
