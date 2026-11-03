"use client";

import { useTranslations } from "next-intl";
import { Bug, CircleAlert, Lightbulb } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { FeedbackKind, FeedbackPriority, FeedbackStatus } from "@/lib/platform-feedback/types";

const STATUS_CLASS: Record<FeedbackStatus, string> = {
  new: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200",
  in_progress:
    "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200",
  resolved:
    "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200",
  rejected: "border-muted-foreground/30 bg-muted text-muted-foreground",
};

const PRIORITY_CLASS: Record<FeedbackPriority, string> = {
  low: "text-muted-foreground",
  normal: "",
  high: "border-orange-300 text-orange-700 dark:text-orange-300",
  critical: "border-red-400 bg-red-50 text-red-700 dark:bg-red-950/40 dark:text-red-300",
};

export const FEEDBACK_KIND_ICON = { bug: Bug, problem: CircleAlert, idea: Lightbulb } as const;

export function FeedbackStatusBadge({ status }: { status: FeedbackStatus }) {
  const t = useTranslations("platformFeedback.status");
  return (
    <Badge variant="outline" className={cn("font-medium", STATUS_CLASS[status])}>
      {t(status)}
    </Badge>
  );
}

export function FeedbackKindBadge({ kind }: { kind: FeedbackKind }) {
  const t = useTranslations("platformFeedback.kind");
  const Icon = FEEDBACK_KIND_ICON[kind];
  return (
    <Badge variant="secondary" className="gap-1 font-normal">
      <Icon className="h-3 w-3" />
      {t(kind)}
    </Badge>
  );
}

export function FeedbackPriorityBadge({ priority }: { priority: FeedbackPriority }) {
  const t = useTranslations("platformFeedback.priority");
  if (priority === "normal") return null;
  return (
    <Badge variant="outline" className={cn("font-normal", PRIORITY_CLASS[priority])}>
      {t(priority)}
    </Badge>
  );
}
