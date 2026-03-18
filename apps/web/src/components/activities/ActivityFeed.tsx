"use client";

import { useState, useMemo } from "react";
import { RefreshCwIcon, Loader2Icon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import { ActivityItem } from "./ActivityItem";
import { ActivityFilters } from "./ActivityFilters";
import { useInfiniteActivities } from "@/hooks/queries/useActivities";
import type { ActivityFilters as ActivityFiltersType } from "@/types/activities";

interface ActivityFeedProps {
  title?: string;
  description?: string;
  initialFilters?: Partial<Omit<ActivityFiltersType, "organizationId">>;
  showFilters?: boolean;
  compact?: boolean;
  limit?: number;
  maxHeight?: string;
  autoRefresh?: boolean;
  refreshInterval?: number;
}

export function ActivityFeed({
  title = "Recent Activities",
  description = "Latest activities across your organization",
  initialFilters = {},
  showFilters = true,
  compact = false,
  limit = 20,
  maxHeight = "600px",
  autoRefresh = false,
  refreshInterval = 30000,
}: ActivityFeedProps) {
  const [filters, setFilters] = useState<Omit<ActivityFiltersType, "organizationId">>({
    limit,
    ...initialFilters,
  });

  const {
    data,
    error,
    isLoading,
    isFetchingNextPage,
    hasNextPage,
    fetchNextPage,
    refetch,
    isRefetching,
  } = useInfiniteActivities(filters, {
    refetchInterval: autoRefresh ? refreshInterval : undefined,
  });

  const activities = useMemo(() => {
    return data?.pages.flatMap((page) => page.activities) || [];
  }, [data]);

  const totalCount = data?.pages[0]?.total || 0;

  const handleLoadMore = () => {
    if (hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  };

  const handleRefresh = () => {
    refetch();
  };

  const handleFiltersChange = (newFilters: Omit<ActivityFiltersType, "organizationId">) => {
    setFilters({
      ...newFilters,
      limit,
    });
  };

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>{title}</CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-12 w-1 rounded-full" />
                <div className="flex-1 space-y-2">
                  <Skeleton className="h-4 w-3/4" />
                  <Skeleton className="h-3 w-1/2" />
                </div>
                <Skeleton className="h-7 w-7 rounded-full" />
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          {description && <CardDescription>{description}</CardDescription>}
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertDescription>Failed to load activities. {error.message}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {showFilters && (
        <ActivityFilters
          filters={filters}
          onFiltersChange={handleFiltersChange}
          showCompact={compact}
        />
      )}

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                {title}
                {totalCount > 0 && (
                  <span className="text-sm font-normal text-muted-foreground">
                    ({totalCount} total)
                  </span>
                )}
              </CardTitle>
              {description && <CardDescription>{description}</CardDescription>}
            </div>
            <Button variant="outline" size="sm" onClick={handleRefresh} disabled={isRefetching}>
              {isRefetching ? (
                <Loader2Icon className="h-4 w-4 animate-spin" />
              ) : (
                <RefreshCwIcon className="h-4 w-4" />
              )}
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {activities.length === 0 ? (
            <div className="py-8 text-center text-muted-foreground">
              <p>No activities found.</p>
              <p className="mt-1 text-sm">Try adjusting your filters or check back later.</p>
            </div>
          ) : (
            <ScrollArea style={{ maxHeight }} className="pr-4">
              <div className="space-y-1">
                {activities.map((activity) => (
                  <ActivityItem
                    key={activity.id}
                    activity={activity}
                    compact={compact}
                    showModule={!filters.moduleIds?.length || filters.moduleIds.length > 1}
                    showBranch={!filters.branchId}
                    showUser={!filters.userId}
                  />
                ))}
              </div>

              {hasNextPage && (
                <div className="flex justify-center pt-4">
                  <Button variant="outline" onClick={handleLoadMore} disabled={isFetchingNextPage}>
                    {isFetchingNextPage ? (
                      <>
                        <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                        Loading more...
                      </>
                    ) : (
                      "Load more"
                    )}
                  </Button>
                </div>
              )}
            </ScrollArea>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
