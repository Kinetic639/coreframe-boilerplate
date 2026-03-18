"use client";

import { formatDistanceToNow } from "date-fns";
import { pl, enUS } from "date-fns/locale";
import { useLocale } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { ActivityStatusBadge } from "./ActivityStatusBadge";
import type { ActivityWithRelations } from "@/types/activities";
import { MODULE_COLORS } from "@/types/activities";

interface ActivityItemProps {
  activity: ActivityWithRelations;
  showModule?: boolean;
  showBranch?: boolean;
  showUser?: boolean;
  compact?: boolean;
}

export function ActivityItem({
  activity,
  showModule = true,
  showBranch = true,
  showUser = true,
  compact = false,
}: ActivityItemProps) {
  const locale = useLocale();
  const dateLocale = locale === "pl" ? pl : enUS;

  const moduleColor = activity.module?.slug
    ? MODULE_COLORS[activity.module.slug as keyof typeof MODULE_COLORS]
    : "#6b7280";

  const getInitials = (name?: string) => {
    if (!name) return "?";
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  if (compact) {
    return (
      <div className="flex items-center gap-3 py-2">
        <div
          className="h-2 w-2 flex-shrink-0 rounded-full"
          style={{ backgroundColor: moduleColor }}
        />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm text-muted-foreground">{activity.description}</p>
          <p className="text-xs text-muted-foreground">
            {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: dateLocale })}
          </p>
        </div>
        {showUser && activity.user && (
          <Avatar className="h-6 w-6">
            <AvatarFallback className="text-xs">
              {getInitials(activity.user.name || activity.user.email)}
            </AvatarFallback>
          </Avatar>
        )}
      </div>
    );
  }

  return (
    <Card className="mb-3">
      <CardContent className="p-4">
        <div className="flex items-start gap-3">
          {/* Module indicator */}
          <div
            className="mt-1 h-12 w-1 flex-shrink-0 rounded-full"
            style={{ backgroundColor: moduleColor }}
          />

          <div className="min-w-0 flex-1">
            {/* Header with badges */}
            <div className="mb-2 flex flex-wrap items-center gap-2">
              {showModule && activity.module && (
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

            {/* Description */}
            <p className="mb-2 text-sm leading-relaxed">{activity.description}</p>

            {/* Metadata */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>
                  {formatDistanceToNow(activity.createdAt, { addSuffix: true, locale: dateLocale })}
                </span>

                {showBranch && activity.branch && <span>• {activity.branch.name}</span>}

                {activity.url && (
                  <TooltipProvider>
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="cursor-help">• URL</span>
                      </TooltipTrigger>
                      <TooltipContent>
                        <p>{activity.url}</p>
                      </TooltipContent>
                    </Tooltip>
                  </TooltipProvider>
                )}

                {activity.ipAddress && <span>• {activity.ipAddress}</span>}
              </div>

              {/* User avatar */}
              {showUser && activity.user && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Avatar className="h-7 w-7">
                        <AvatarFallback className="text-xs">
                          {getInitials(activity.user.name || activity.user.email)}
                        </AvatarFallback>
                      </Avatar>
                    </TooltipTrigger>
                    <TooltipContent>
                      <p>{activity.user.name || activity.user.email}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>

            {/* Metadata object (if present and not empty) */}
            {activity.metadata && Object.keys(activity.metadata).length > 0 && (
              <details className="mt-3">
                <summary className="cursor-pointer text-xs text-muted-foreground hover:text-foreground">
                  Show metadata
                </summary>
                <pre className="mt-2 overflow-x-auto rounded bg-muted p-2 text-xs">
                  {JSON.stringify(activity.metadata, null, 2)}
                </pre>
              </details>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
