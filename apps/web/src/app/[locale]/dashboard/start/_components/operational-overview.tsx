import { AlertTriangle, ListChecks } from "lucide-react";
import { loadAttention, loadOpenTaskCount } from "../_lib/data";
import type { HomeCopy } from "../_lib/copy";
import type { HomeAction } from "../_lib/model";
import { QuickActions } from "./home-sections";

export async function OperationalOverview({
  actions,
  copy,
  attentionResult,
  taskResult,
}: {
  actions: HomeAction[];
  copy: HomeCopy;
  attentionResult: ReturnType<typeof loadAttention> | null;
  taskResult: ReturnType<typeof loadOpenTaskCount> | null;
}) {
  const [attention, tasks] = await Promise.all([
    attentionResult ?? Promise.resolve(null),
    taskResult ?? Promise.resolve(null),
  ]);
  const attentionCount = attention?.state === "ready" ? attention.data.totalCount : undefined;
  const taskCount = tasks?.state === "ready" ? tasks.data.totalCount : undefined;
  const signals: Partial<Record<HomeAction, string>> = {};
  if (attentionCount !== undefined) {
    signals.tickets = copy.ticketsSignal.replace("{count}", String(attentionCount));
  }
  if (taskCount !== undefined) {
    signals.tasks = copy.tasksSignal.replace("{count}", String(taskCount));
  }

  return (
    <div className="space-y-3">
      {attentionCount !== undefined || taskCount !== undefined ? (
        <section aria-labelledby="home-summary">
          <h2 id="home-summary" className="sr-only">
            {copy.operationalSummary}
          </h2>
          <div className="grid grid-cols-2 gap-px overflow-hidden rounded-md border bg-border">
            {attentionCount !== undefined ? (
              <SummaryCard
                label={copy.attentionMetric}
                description={copy.attentionMetricDescription}
                value={attentionCount}
                icon={AlertTriangle}
                tone="attention"
              />
            ) : null}
            {taskCount !== undefined ? (
              <SummaryCard
                label={copy.tasksMetric}
                description={copy.tasksMetricDescription}
                value={taskCount}
                icon={ListChecks}
                tone="info"
              />
            ) : null}
          </div>
        </section>
      ) : null}
      <QuickActions actions={actions} copy={copy} signals={signals} />
    </div>
  );
}

function SummaryCard({
  label,
  description,
  value,
  icon: Icon,
  tone,
}: {
  label: string;
  description: string;
  value: number;
  icon: typeof AlertTriangle;
  tone: "attention" | "info";
}) {
  const toneClasses =
    tone === "attention"
      ? "bg-amber-500/10 text-amber-700 dark:text-amber-300"
      : "bg-sky-500/10 text-sky-700 dark:text-sky-300";
  return (
    <div className="flex min-h-20 items-center justify-between gap-2 bg-card px-3 py-2.5 sm:min-h-0 sm:px-4">
      <div className="min-w-0">
        <p className="text-[11px] font-medium leading-4 text-muted-foreground sm:text-xs">
          {label}
        </p>
        <div className="mt-0.5 flex items-baseline gap-2">
          <p className="text-xl font-semibold tabular-nums tracking-tight sm:text-2xl">{value}</p>
          <p className="hidden truncate text-[11px] text-muted-foreground sm:block">
            {description}
          </p>
        </div>
      </div>
      <span className={`shrink-0 rounded p-1.5 ${toneClasses}`}>
        <Icon aria-hidden="true" className="size-3.5 sm:size-4" />
      </span>
    </div>
  );
}
