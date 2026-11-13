import type { PaginatedResult } from "@/lib/data-view/types";
import {
  getTaskDetailAction,
  listTasksForDataViewAction,
  listTasksForKanbanAction,
} from "@/app/actions/planning";
import type {
  PlanningTaskDetail,
  PlanningTaskListRow,
} from "@/server/services/planning-tasks.service";
import { taskFilters, taskListParams, type TaskState } from "./tasks-state";

// The task list's cache: one entry per page the address asks for, the board's
// tasks, and one per task card, per organization. Everything that changes a
// task drops the "planning-tasks" entries.

export type TaskList = PaginatedResult<PlanningTaskListRow>;

/** A list page stays fresh this long: going back and forth costs nothing. */
const LIST_STALE_TIME = 30 * 1000;
const DETAIL_STALE_TIME = 60 * 1000;

export const taskKeys = {
  all: (orgId: string) => ["planning-tasks", orgId] as const,
  list: (orgId: string, state: TaskState) =>
    ["planning-tasks", orgId, "list", taskListParams(state), taskFilters(state)] as const,
  board: (orgId: string) => ["planning-tasks", orgId, "board"] as const,
  detail: (orgId: string, taskNumber: string) =>
    ["planning-tasks", orgId, "detail", taskNumber] as const,
};

export const taskListQuery = (orgId: string, state: TaskState) => ({
  queryKey: taskKeys.list(orgId, state),
  queryFn: async (): Promise<TaskList> => {
    const result = await listTasksForDataViewAction(
      taskListParams(state),
      orgId,
      taskFilters(state)
    );
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});

export const taskBoardQuery = (orgId: string) => ({
  queryKey: taskKeys.board(orgId),
  queryFn: async (): Promise<PlanningTaskListRow[]> => {
    const result = await listTasksForKanbanAction(orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: LIST_STALE_TIME,
});

export const taskDetailQuery = (orgId: string, taskNumber: string) => ({
  queryKey: taskKeys.detail(orgId, taskNumber),
  queryFn: async (): Promise<PlanningTaskDetail> => {
    const result = await getTaskDetailAction(taskNumber, orgId);
    if (!result.success) throw new Error((result as { error: string }).error);
    return result.data;
  },
  staleTime: DETAIL_STALE_TIME,
});
