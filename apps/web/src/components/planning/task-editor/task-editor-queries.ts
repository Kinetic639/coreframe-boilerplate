import {
  getKanbanTaskEditorAction,
  getKanbanTaskRelationsAction,
  listKanbanCardActivityAction,
} from "@/app/actions/kanban";
import type {
  KanbanCardActivity,
  KanbanTaskEditorData,
  KanbanTaskRelations,
} from "@/lib/types/kanban";

// The task editor's own cache entries. The board, the task list and the
// calendar each keep their lists; the editor tells them what changed
// (onChanged) and they update their own entries.

export const taskEditorKeys = {
  all: (orgId: string) => ["planning-task-editor", orgId] as const,
  task: (orgId: string, ref: string) => ["planning-task-editor", orgId, "task", ref] as const,
  activity: (orgId: string, taskId: string) =>
    ["planning-task-editor", orgId, "activity", taskId] as const,
  /** Parent, sub-tasks and dependencies of a task. */
  relations: (orgId: string, taskId: string) =>
    ["planning-task-editor", orgId, "relations", taskId] as const,
};

async function unwrap<T>(
  promise: Promise<{ success: true; data: T } | { success: false; error: string }>
): Promise<T> {
  const result = await promise;
  if ("error" in result) throw new Error(result.error);
  return result.data;
}

export const taskEditorQuery = (orgId: string, ref: string) => ({
  queryKey: taskEditorKeys.task(orgId, ref),
  queryFn: (): Promise<KanbanTaskEditorData> => unwrap(getKanbanTaskEditorAction(ref)),
  staleTime: 15 * 1000,
});

export const taskActivityQuery = (orgId: string, taskId: string) => ({
  queryKey: taskEditorKeys.activity(orgId, taskId),
  queryFn: (): Promise<KanbanCardActivity[]> => unwrap(listKanbanCardActivityAction(taskId)),
  staleTime: 15 * 1000,
});

export const taskRelationsQuery = (orgId: string, taskId: string) => ({
  queryKey: taskEditorKeys.relations(orgId, taskId),
  queryFn: (): Promise<KanbanTaskRelations> => unwrap(getKanbanTaskRelationsAction(taskId)),
  staleTime: 15 * 1000,
});

export { unwrap as unwrapTaskResult };
