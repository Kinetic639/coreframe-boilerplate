"use client";

import { SchedulerWorkspace, type SchedulerWorkspaceProps } from "./scheduler-shell";

export type ResourcePlannerProps = Omit<SchedulerWorkspaceProps, "mode" | "initialView">;

export function ResourcePlanner(props: ResourcePlannerProps) {
  return <SchedulerWorkspace {...props} mode="planner" initialView="day" />;
}
