"use client";

import { CalendarDays, Kanban, LayoutList } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link } from "@/i18n/navigation";
import { cn } from "@/lib/utils";

export type PlanningView = "boards" | "list" | "calendar";

const VIEWS = [
  { id: "boards", href: "/dashboard/planning/boards", Icon: Kanban },
  { id: "list", href: "/dashboard/planning/tasks", Icon: LayoutList },
  { id: "calendar", href: "/dashboard/planning", Icon: CalendarDays },
] as const;

/**
 * The three views of the same tasks (boards, list, calendar). Planning has
 * one menu entry; this switch moves between its views.
 */
export function PlanningViewSwitcher({
  current,
  className,
}: {
  current: PlanningView;
  className?: string;
}) {
  const t = useTranslations("modules.planning.views");
  return (
    <nav
      aria-label={t("label")}
      className={cn("inline-flex items-center gap-0.5 rounded-md border p-0.5", className)}
    >
      {VIEWS.map(({ id, href, Icon }) => (
        <Link
          key={id}
          href={href}
          aria-current={current === id ? "page" : undefined}
          className={cn(
            "inline-flex h-7 items-center gap-1.5 rounded px-2 text-xs font-medium text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            current === id && "bg-muted text-foreground"
          )}
        >
          <Icon className="size-3.5 shrink-0" aria-hidden />
          <span>{t(id)}</span>
        </Link>
      ))}
    </nav>
  );
}

/** A slim bar above a full-height view (boards, calendar) holding the switch. */
export function PlanningViewBar({ current }: { current: PlanningView }) {
  return (
    <div className="flex shrink-0 items-center border-b px-3 py-1.5">
      <PlanningViewSwitcher current={current} />
    </div>
  );
}
