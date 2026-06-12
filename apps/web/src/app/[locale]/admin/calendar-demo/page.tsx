"use client";

import { useState } from "react";
import { CalendarRange, GanttChartSquare } from "lucide-react";

import { CalendarScheduler, ResourcePlanner } from "@/components/primitives/scheduler";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { cn } from "@/utils";

type DemoMode = "calendar" | "planner";

const DEMO_MODES: Array<{
  value: DemoMode;
  label: string;
  description: string;
}> = [
  {
    value: "calendar",
    label: "Calendar",
    description: "Month, week, day, list, and year calendar views.",
  },
  {
    value: "planner",
    label: "Resource planner",
    description: "Timeline view for resource allocation and workload planning.",
  },
];

export default function CalendarDemoPage() {
  const [mode, setMode] = useState<DemoMode>("calendar");
  const activeMode = DEMO_MODES.find((item) => item.value === mode) ?? DEMO_MODES[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] min-h-[720px] flex-col overflow-hidden bg-background">
      <div className="flex-none border-b px-6 py-4">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <div className="mb-2 flex items-center gap-2">
              {mode === "calendar" ? (
                <CalendarRange className="h-5 w-5 text-primary" />
              ) : (
                <GanttChartSquare className="h-5 w-5 text-primary" />
              )}
              <Badge variant="outline">Primitive demo</Badge>
            </div>
            <h1 className="text-2xl font-bold tracking-tight">Calendar & Resource Planner</h1>
            <p className="mt-1 max-w-3xl text-sm text-muted-foreground">
              Generated preview with mocked data, kept in admin until the production feature is
              reimplemented.
            </p>
          </div>

          <div className="flex items-center gap-1 rounded-md border bg-muted/40 p-1">
            {DEMO_MODES.map((item) => (
              <Button
                key={item.value}
                type="button"
                variant={mode === item.value ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setMode(item.value)}
                title={item.description}
                className={cn("h-8", mode === item.value && "bg-background shadow-xs")}
              >
                {item.label}
              </Button>
            ))}
          </div>
        </div>
      </div>

      <div className="min-h-0 flex-1">
        {mode === "calendar" ? (
          <CalendarScheduler title={activeMode.label} />
        ) : (
          <ResourcePlanner title={activeMode.label} />
        )}
      </div>
    </div>
  );
}
