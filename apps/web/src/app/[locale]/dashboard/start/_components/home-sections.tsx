import {
  ArrowUpRight,
  MapPin,
  ScanLine,
  Ticket,
  ListTodo,
  Activity,
  CircleCheck,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Card, CardContent, CardHeader, CardDescription } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { HomeCopy } from "../_lib/copy";
import type { HomeAction } from "../_lib/model";

const actionConfig = {
  tools: { href: "/dashboard/tools", icon: ScanLine },
  locations: { href: "/dashboard/warehouse/locations", icon: MapPin },
  tickets: { href: "/dashboard/help-desk/tickets", icon: Ticket },
  tasks: { href: "/dashboard/planning/tasks", icon: ListTodo },
} as const;
export function QuickActions({
  actions,
  copy,
  signals = {},
}: {
  actions: HomeAction[];
  copy: HomeCopy;
  signals?: Partial<Record<HomeAction, string>>;
}) {
  return (
    <section aria-labelledby="home-actions">
      <h2 id="home-actions" className="sr-only">
        {copy.actions}
      </h2>
      {actions.length === 0 ? (
        <p className="text-sm text-card-foreground/80">{copy.noActions}</p>
      ) : (
        <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border xl:grid-cols-4">
          {actions.map((action) => {
            const { href, icon: Icon } = actionConfig[action];
            return (
              <Link
                key={action}
                href={href}
                prefetch={false}
                className="group flex min-h-28 min-w-0 flex-col bg-card p-3 text-card-foreground transition-colors duration-150 hover:bg-accent/50 focus-visible:z-10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring sm:min-h-24"
              >
                <div className="mb-2 flex items-center justify-between">
                  <span className="rounded bg-primary/10 p-1.5 text-primary">
                    <Icon aria-hidden="true" className="size-4" />
                  </span>
                  <ArrowUpRight
                    aria-hidden="true"
                    className="size-3.5 text-muted-foreground transition-transform duration-150 group-hover:translate-x-0.5 group-hover:text-primary motion-reduce:transform-none"
                  />
                </div>
                <p className="text-sm font-medium">{copy[action]}</p>
                <p className="mt-0.5 line-clamp-2 text-xs leading-4 text-muted-foreground">
                  {copy[`${action}Description`]}
                </p>
                {signals[action] ? (
                  <p className="mt-auto pt-2 text-[11px] font-medium text-primary">
                    {signals[action]}
                  </p>
                ) : null}
              </Link>
            );
          })}
        </div>
      )}
    </section>
  );
}
export function WidgetFrame({
  id,
  title,
  description,
  children,
  count,
  tone = "default",
}: {
  id: string;
  title: string;
  description: string;
  children: React.ReactNode;
  count?: number;
  tone?: "default" | "attention";
}) {
  return (
    <section aria-labelledby={id} className="min-w-0">
      <Card
        className={`h-full rounded-md shadow-none ${tone === "attention" ? "border-l-2 border-l-amber-500/70" : ""}`}
      >
        <CardHeader className="space-y-1 p-4 pb-3">
          <div className="flex items-center gap-2">
            <h2 id={id} className="text-sm font-semibold">
              {title}
            </h2>
            {count !== undefined ? (
              <Badge
                className={
                  tone === "attention"
                    ? "bg-amber-500/10 text-amber-700 hover:bg-amber-500/10 dark:text-amber-300 tabular-nums"
                    : "bg-primary/10 text-primary hover:bg-primary/10 tabular-nums"
                }
              >
                {count}
              </Badge>
            ) : null}
          </div>
          <CardDescription className="text-xs leading-4">{description}</CardDescription>
        </CardHeader>
        <CardContent className="px-4 pb-4">{children}</CardContent>
      </Card>
    </section>
  );
}
export function WidgetEmpty({
  title,
  description,
  activity = false,
}: {
  title: string;
  description: string;
  activity?: boolean;
}) {
  const Icon = activity ? Activity : CircleCheck;
  return (
    <div className="flex min-h-28 flex-col items-start justify-center gap-1.5 border-y bg-muted/20 p-4">
      <span className="mb-0.5 rounded bg-primary/10 p-1.5 text-primary">
        <Icon aria-hidden="true" className="size-4" />
      </span>
      <p className="text-sm font-medium">{title}</p>
      <p className="max-w-lg text-sm leading-6 text-card-foreground/80">{description}</p>
    </div>
  );
}
export function WidgetUnavailable({ copy }: { copy: HomeCopy }) {
  return (
    <div role="status" className="rounded-md border border-dashed p-5 text-sm">
      <p className="font-medium">{copy.unavailable}</p>
      <p className="mt-2 leading-6 text-card-foreground/80">{copy.unavailableDescription}</p>
    </div>
  );
}
export function WidgetSkeleton({ label }: { label: string }) {
  return (
    <Card role="status" aria-label={label} className="space-y-3 rounded-md p-4 shadow-none">
      <span className="sr-only">{label}</span>
      <Skeleton className="h-5 w-40" />
      {[0, 1, 2].map((i) => (
        <Skeleton key={i} className="h-9 w-full" />
      ))}
    </Card>
  );
}

export function OverviewSkeleton({ label }: { label: string }) {
  return (
    <div role="status" aria-label={label} className="space-y-3">
      <span className="sr-only">{label}</span>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border">
        {[0, 1].map((item) => (
          <div key={item} className="bg-card p-3">
            <Skeleton className="h-4 w-24 max-w-full" />
            <Skeleton className="mt-2 h-6 w-10" />
          </div>
        ))}
      </div>
      <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border xl:grid-cols-4">
        {[0, 1, 2, 3].map((item) => (
          <div key={item} className="min-h-28 space-y-3 bg-card p-3 sm:min-h-24">
            <Skeleton className="size-7" />
            <Skeleton className="h-5 w-24" />
            <Skeleton className="h-4 w-full" />
          </div>
        ))}
      </div>
    </div>
  );
}
