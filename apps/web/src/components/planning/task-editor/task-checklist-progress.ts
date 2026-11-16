import type { KanbanChecklist } from "@/lib/types/kanban";

/** Items across a task's checklists, and how many are done. */
export function checklistProgress(lists: Pick<KanbanChecklist, "items">[]): {
  total: number;
  done: number;
} {
  let total = 0;
  let done = 0;
  for (const list of lists) {
    for (const item of list.items) {
      total += 1;
      if (item.is_done) done += 1;
    }
  }
  return { total, done };
}
