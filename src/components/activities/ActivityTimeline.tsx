"use client";

import { useMemo } from "react";
import { formatDistanceToNow, format, isToday, isYesterday } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ScrollArea } from "@/components/ui/scroll-area";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import type { ActivityWithRelations } from "@/types/activities";
import { MODULE_COLORS } from "@/types/activities";

interface ActivityTimelineProps {
  activities: ActivityWithRelations[];
  title?: string;
  maxHeight?: string;
  showGrouping?: boolean;
}

// interface ActivityGroup {
//   date: string;
//   dateLabel: string;
//   activities: ActivityWithRelations[];
// }

export function ActivityTimeline({
  activities,
  title = "Activity Timeline",
  maxHeight = "600px",
  showGrouping = true,
}: ActivityTimelineProps) {
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;

  const groupedActivities = useMemo(() => {
    if (!showGrouping) {
      return [
        {
          date: "all",
          dateLabel: "All Activities",
          activities,
        },
      ];
    }

    const groups: Record<string, ActivityWithRelations[]> = {};

    activities.forEach((activity) => {
      const date = format(activity.createdAt, "yyyy-MM-dd");
      if (!groups[date]) {
        groups[date] = [];
      }
      groups[date].push(activity);
    });

    return Object.entries(groups)
      .map(([date, groupActivities]) => {
        const dateObj = new Date(date);
        let dateLabel: string;

        if (isToday(dateObj)) {
          dateLabel = "Today";
        } else if (isYesterday(dateObj)) {
          dateLabel = "Yesterday";
        } else {
          dateLabel = format(dateObj, "EEEE, MMMM d", { locale: dateLocale });
        }

        return {
          date,
          dateLabel,
          activities: groupActivities.sort(
            (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
          ),
        };
      })
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [activities, showGrouping, dateLocale]);

  const getModuleColor = (moduleSlug?: string) => {
    return moduleSlug
      ? MODULE_COLORS[moduleSlug as keyof typeof MODULE_COLORS] || "#6b7280"
      : "#6b7280";
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {activities.length === 0 ? (
          <div className="py-8 text-center text-muted-foreground">
            <p>No activities to display</p>
          </div>
        ) : (
          <ScrollArea style={{ maxHeight }}>
            <div className="relative">
              {/* Timeline line */}
              <div className="absolute bottom-0 left-4 top-0 w-0.5 bg-border" />

              <div className="space-y-6">
                {groupedActivities.map((group, groupIndex) => (
                  <div key={group.date}>
                    {showGrouping && (
                      <>
                        {groupIndex > 0 && <Separator className="my-6" />}
                        <div className="mb-4 flex items-center gap-3">
                          <div className="relative">
                            <div className="h-3 w-3 rounded-full border-2 border-background bg-primary" />
                          </div>
                          <h3 className="text-sm font-semibold">{group.dateLabel}</h3>
                          <Badge variant="outline" className="text-xs">
                            {group.activities.length} activities
                          </Badge>
                        </div>
                      </>
                    )}

                    <div className="space-y-4">
                      {group.activities.map((activity) => (
                        <div key={activity.id} className="relative flex items-start gap-4 pl-8">
                          {/* Timeline dot */}
                          <div className="absolute left-3 top-2">
                            <div
                              className="h-2 w-2 rounded-full border border-background"
                              style={{ backgroundColor: getModuleColor(activity.module?.slug) }}
                            />
                          </div>

                          {/* Activity content */}
                          <div className="min-w-0 flex-1">
                            <div className="flex items-start justify-between gap-2">
                              <div className="min-w-0 flex-1">
                                {/* Activity description */}
                                <p className="mb-1 text-sm font-medium leading-relaxed">
                                  {activity.description}
                                </p>

                                {/* Badges */}
                                <div className="mb-2 flex flex-wrap items-center gap-2">
                                  {activity.module && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.module.name}
                                    </Badge>
                                  )}

                                  {activity.action && (
                                    <Badge variant="secondary" className="text-xs">
                                      {activity.action.slug}
                                    </Badge>
                                  )}

                                  {activity.entityType && (
                                    <Badge variant="outline" className="text-xs">
                                      {activity.entityType.slug}
                                    </Badge>
                                  )}

                                  <ActivityStatusBadge status={activity.status} />
                                </div>

                                {/* Metadata */}
                                <div className="flex items-center gap-2 text-xs text-muted-foreground">
                                  <span>
                                    {formatDistanceToNow(activity.createdAt, {
                                      addSuffix: true,
                                      locale: dateLocale,
                                    })}
                                  </span>

                                  {activity.user && (
                                    <>
                                      <span>•</span>
                                      <span>{activity.user.name || activity.user.email}</span>
                                    </>
                                  )}

                                  {activity.branch && (
                                    <>
                                      <span>•</span>
                                      <span>{activity.branch.name}</span>
                                    </>
                                  )}
                                </div>
                              </div>

                              {/* Time stamp */}
                              <div className="text-right text-xs text-muted-foreground">
                                {format(activity.createdAt, "HH:mm")}
                              </div>
                            </div>

                            {/* Expanded metadata */}
                            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
                              <details className="mt-2">
                                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                                  Show details
                                </summary>
                                <div className="mt-2 rounded bg-muted p-2 text-xs">
                                  <pre className="overflow-x-auto">
                                    {JSON.stringify(activity.metadata, null, 2)}
                                  </pre>
                                </div>
                              </details>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </ScrollArea>
        )}
      </CardContent>
    </Card>
  );
}
