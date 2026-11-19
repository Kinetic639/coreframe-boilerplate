import {
  getKanbanBoardAction,
  getKanbanBoardArchiveAction,
  getKanbanTaskEditorAction,
  getKanbanTaskRelationsAction,
  listChecklistTemplatesAction,
  listKanbanBoardActivityAction,
  listKanbanBoardsAction,
  listKanbanBoardsByStateAction,
  listKanbanCardActivityAction,
  listKanbanChecklistsAction,
  listKanbanInboxCardsAction,
  searchKanbanTasksAction,
} from "@/app/actions/kanban";
import {
  getQrAssignmentForTaskAction,
  getTaskDetailAction,
  listTasksForDataViewAction,
} from "@/app/actions/planning";
import { getPlanningCalendarDataAction } from "@/app/actions/planning/calendar";

/**
 * Planning reads served over GET (/api/planning/read/<name>).
 *
 * Next.js runs Server Actions one at a time per page, so a read sent as an
 * action waits behind every save and every other read. A GET runs at once,
 * next to the others. Each entry is the existing action: sign-in, permission
 * and input checks stay exactly where they are. Only reads belong here.
 */
export const planningReads = {
  boards: listKanbanBoardsAction,
  boardsByState: listKanbanBoardsByStateAction,
  board: getKanbanBoardAction,
  boardArchive: getKanbanBoardArchiveAction,
  boardActivity: listKanbanBoardActivityAction,
  inbox: listKanbanInboxCardsAction,
  cardActivity: listKanbanCardActivityAction,
  taskEditor: getKanbanTaskEditorAction,
  taskRelations: getKanbanTaskRelationsAction,
  checklists: listKanbanChecklistsAction,
  checklistTemplates: listChecklistTemplatesAction,
  searchTasks: searchKanbanTasksAction,
  tasksDataView: listTasksForDataViewAction,
  taskDetail: getTaskDetailAction,
  taskQrAssignment: getQrAssignmentForTaskAction,
  calendar: getPlanningCalendarDataAction,
} as const;

export type PlanningReads = typeof planningReads;
export type PlanningReadName = keyof PlanningReads;
