"use client";

import { useState } from "react";
import { ActivityIcon, RefreshCwIcon, ExternalLinkIcon } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityItem } from "@/components/activities/ActivityItem";
import { useRecentActivities } from "@/hooks/queries/useActivities";

interface RecentActivitiesWidgetProps {
  limit?: number;
  autoRefresh?: boolean;
  showViewAll?: boolean;
  className?: string;
}

export function RecentActivitiesWidget({
  limit = 5,
  autoRefresh = true,
  showViewAll = true,
  className,
}: RecentActivitiesWidgetProps) {
  const [isRefreshing, setIsRefreshing] = useState(false);

  const { data, error, isLoading, refetch } = useRecentActivities(limit, {
    enabled: true,
    refetchInterval: autoRefresh ? 30000 : undefined, // 30 seconds
  });

  const activities = data?.activities || [];

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refetch();
    setIsRefreshing(false);
  };

  return (
    <Card className={className}>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ActivityIcon className="h-5 w-5 text-primary" />
            <div>
              <CardTitle className="text-lg">Recent Activities</CardTitle>
              <CardDescription>Latest activities in your organization</CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2">
            {autoRefresh && (
              <Badge variant="outline" className="text-xs">
                Auto-refresh
              </Badge>
            )}
            <Button variant="ghost" size="sm" onClick={handleRefresh} disabled={isRefreshing}>
              <RefreshCwIcon className={`h-4 w-4 ${isRefreshing ? "animate-spin" : ""}`} />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <div className="space-y-3">
            {Array.from({ length: limit }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-12 w-2 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-6 w-6 rounded-full" />
              </div>
            ))}
          </div>
        ) : error ? (
          <Alert variant="destructive">
            <AlertDescription>Failed to load recent activities. Please try again.</AlertDescription>
          </Alert>
        ) : activities.length === 0 ? (
          <div className="py-6 text-center text-muted-foreground">
            <ActivityIcon className="mx-auto mb-3 h-12 w-12 opacity-50" />
            <p className="text-sm">No recent activities</p>
            <p className="mt-1 text-xs">Activities will appear here as they happen</p>
          </div>
        ) : (
          <>
            <ScrollArea className="max-h-64">
              <div className="space-y-1">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    compact={true}
                    showModule={true}
                    showBranch={false}
                    showUser={true}
                  />
                ))}
              </div>
            </ScrollArea>

            {showViewAll && (
              <div className="mt-4 border-t pt-3">
                <Link href="/dashboard-old/analytics/activities">
                  <Button variant="outline" size="sm" className="w-full">
                    <ExternalLinkIcon className="mr-2 h-4 w-4" />
                    View All Activities
                  </Button>
                </Link>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
