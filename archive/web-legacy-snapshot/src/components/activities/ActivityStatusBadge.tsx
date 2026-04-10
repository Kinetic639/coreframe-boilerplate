import { Badge } from "@/components/ui/badge";
import type { ActivityStatus } from "@/types/activities";
import { ACTIVITY_STATUS_VARIANTS } from "@/types/activities";

interface ActivityStatusBadgeProps {
  status: ActivityStatus;
  className?: string;
}

export function ActivityStatusBadge({ status, className }: ActivityStatusBadgeProps) {
  const variant = ACTIVITY_STATUS_VARIANTS[status] as
    | "default"
    | "secondary"
    | "destructive"
    | "outline";

  const statusLabels = {
    recorded: "Recorded",
    processed: "Processed",
    archived: "Archived",
    error: "Error",
  };

  return (
    <Badge variant={variant} className={className}>
      {statusLabels[status]}
    </Badge>
  );
}
