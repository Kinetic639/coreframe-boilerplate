"use client";

import type { CalendarView } from "./scheduler-types";
import { SchedulerWorkspace, type SchedulerWorkspaceProps } from "./scheduler-shell";

export type CalendarSchedulerProps = Omit<SchedulerWorkspaceProps, "mode" | "initialView"> & {
  initialView?: Exclude<CalendarView, "timeline">;
};

export function CalendarScheduler(props: CalendarSchedulerProps) {
  return <SchedulerWorkspace {...props} mode="calendar" />;
}
