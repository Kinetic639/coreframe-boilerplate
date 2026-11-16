"use server";

import { revalidatePath } from "next/cache";
import type { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_BOARDS_CREATE,
  PLANNING_BOARDS_DELETE,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
  PLANNING_TASKS_ASSIGN,
  PLANNING_TASKS_READ,
  PLANNING_TASKS_UPDATE,
} from "@/lib/constants/permissions";
import {
  addKanbanBoardMemberSchema,
  createKanbanBoardSchema,
  createKanbanCardSchema,
  createKanbanColumnSchema,
  kanbanBoardRefSchema,
  kanbanBoardStarSchema,
  kanbanCardRefSchema,
  kanbanTaskLookupSchema,
  patchKanbanTaskSchema,
  kanbanColumnRefSchema,
  moveKanbanTaskSchema,
  removeKanbanBoardMemberSchema,
  reorderKanbanColumnsSchema,
  updateKanbanBoardMemberSchema,
  updateKanbanBoardSchema,
  updateKanbanCardSchema,
  updateKanbanColumnSchema,
  createKanbanBoardLabelSchema,
  updateKanbanBoardLabelSchema,
  kanbanBoardLabelRefSchema,
  setKanbanTaskLabelsSchema,
  createKanbanChecklistSchema,
  updateKanbanChecklistSchema,
  kanbanChecklistRefSchema,
  createKanbanChecklistItemSchema,
  updateKanbanChecklistItemSchema,
  kanbanTaskWatchSchema,
  type CreateKanbanBoardLabelInput,
  type UpdateKanbanBoardLabelInput,
  type KanbanBoardLabelRefInput,
  type SetKanbanTaskLabelsInput,
  type CreateKanbanChecklistInput,
  type UpdateKanbanChecklistInput,
  type CreateKanbanChecklistItemInput,
  type UpdateKanbanChecklistItemInput,
  type KanbanTaskWatchInput,
  type AddKanbanBoardMemberInput,
  type CreateKanbanBoardInput,
  type CreateKanbanCardInput,
  type CreateKanbanColumnInput,
  type KanbanBoardRefInput,
  type KanbanBoardStarInput,
  type PatchKanbanTaskInput,
  type KanbanCardRefInput,
  type KanbanColumnRefInput,
  type MoveKanbanTaskInput,
  type RemoveKanbanBoardMemberInput,
  type ReorderKanbanColumnsInput,
  type UpdateKanbanBoardInput,
  type UpdateKanbanBoardMemberInput,
  type UpdateKanbanCardInput,
  type UpdateKanbanColumnInput,
} from "@/lib/validations/kanban";
import type {
  KanbanBoardActivity,
  KanbanBoardLabel,
  KanbanChecklist,
  KanbanChecklistItem,
  KanbanBoardArchive,
  KanbanBoardCard,
  KanbanBoardColumn,
  KanbanBoardDetail,
  KanbanBoardSummary,
  KanbanCardActivity,
  KanbanMoveResult,
  KanbanTaskEditorData,
} from "@/lib/types/kanban";
import { KanbanBoardsService } from "@/server/services/kanban-boards.service";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function getAuthedContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return null;
  return { supabase, context, userId: user.id, orgId: context.app.activeOrgId };
}

async function currentAssignee(
  ctx: NonNullable<Awaited<ReturnType<typeof getAuthedContext>>>,
  taskId: string
): Promise<string | null> {
  const { data } = await ctx.supabase
    .from("planning_tasks")
    .select("assigned_to")
    .eq("organization_id", ctx.orgId)
    .eq("id", taskId)
    .maybeSingle();
  return (data as { assigned_to: string | null } | null)?.assigned_to ?? null;
}

function firstZodError(error: unknown) {
  const issues = (error as { issues?: Array<{ message?: string }> })?.issues;
  return issues?.[0]?.message ?? "Invalid input";
}

/**
 * Only for changes to the boards themselves (the page renders the board list
 * on the server). Columns and cards live in the client cache, so changing
 * them does not throw away the server-rendered page.
 */
function revalidateBoards() {
  revalidatePath("/dashboard/planning/boards");
  revalidatePath("/dashboard/planowanie/tablice");
}

type AuthedContext = NonNullable<Awaited<ReturnType<typeof getAuthedContext>>>;

/** Signed in, holds the permission (any of a list), input valid: then runs the change. */
async function guarded<S extends z.ZodTypeAny, T>(
  permission: string | string[],
  schema: S,
  input: z.input<S>,
  run: (ctx: AuthedContext, data: z.output<S>) => Promise<ActionResult<T>>,
  options: { revalidate?: boolean } = {}
): Promise<ActionResult<T>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const permissions = Array.isArray(permission) ? permission : [permission];
    if (!permissions.some((item) => checkPermission(ctx.context.user.permissionSnapshot, item))) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await run(ctx, parsed.data);
    if (result.success && options.revalidate) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function listKanbanBoardsAction(): Promise<ActionResult<KanbanBoardSummary[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.listBoards(ctx.supabase, ctx.orgId, ctx.userId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function getKanbanBoardAction(
  boardId: string
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.getBoard(ctx.supabase, ctx.orgId, boardId, ctx.userId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function listKanbanCardActivityAction(
  cardId: string
): Promise<ActionResult<KanbanCardActivity[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    // A card is a task: its history is open to whoever reads tasks or boards.
    const snapshot = ctx.context.user.permissionSnapshot;
    if (
      !checkPermission(snapshot, PLANNING_BOARDS_READ) &&
      !checkPermission(snapshot, PLANNING_TASKS_READ)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.listCardActivity(ctx.supabase, ctx.orgId, cardId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function listKanbanInboxCardsAction(): Promise<ActionResult<KanbanBoardCard[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.listInboxCards(ctx.supabase, ctx.orgId, ctx.userId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function createKanbanBoardAction(
  input: CreateKanbanBoardInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_CREATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = createKanbanBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.createBoard(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      parsed.data
    );
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateKanbanBoardAction(
  input: UpdateKanbanBoardInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = updateKanbanBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.updateBoard(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      parsed.data
    );
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// ── Board members (the database lets only the board owner change them) ─────

async function boardMemberAction<S extends z.ZodTypeAny>(
  input: z.input<S>,
  schema: S,
  run: (ctx: AuthedContext, data: z.output<S>) => Promise<ActionResult<KanbanBoardDetail>>
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = schema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await run(ctx, parsed.data);
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function addKanbanBoardMemberAction(
  input: AddKanbanBoardMemberInput
): Promise<ActionResult<KanbanBoardDetail>> {
  return boardMemberAction(input, addKanbanBoardMemberSchema, (ctx, data) =>
    KanbanBoardsService.addBoardMember(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function updateKanbanBoardMemberAction(
  input: UpdateKanbanBoardMemberInput
): Promise<ActionResult<KanbanBoardDetail>> {
  return boardMemberAction(input, updateKanbanBoardMemberSchema, (ctx, data) =>
    KanbanBoardsService.updateBoardMember(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function removeKanbanBoardMemberAction(
  input: RemoveKanbanBoardMemberInput
): Promise<ActionResult<KanbanBoardDetail>> {
  return boardMemberAction(input, removeKanbanBoardMemberSchema, (ctx, data) =>
    KanbanBoardsService.removeBoardMember(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

// ── Archive ─────────────────────────────────────────────────────────────────

/** Open boards, or (archived: true) the archived ones. */
export async function listKanbanBoardsByStateAction(
  archived: boolean
): Promise<ActionResult<KanbanBoardSummary[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.listBoards(ctx.supabase, ctx.orgId, ctx.userId, { archived });
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

// The database lets only the owner, or someone with planning.boards.delete,
// archive, restore or delete a board.
export async function archiveKanbanBoardAction(
  input: KanbanBoardRefInput
): Promise<ActionResult<KanbanBoardSummary>> {
  return guarded(
    PLANNING_BOARDS_UPDATE,
    kanbanBoardRefSchema,
    input,
    (ctx, data) =>
      KanbanBoardsService.setBoardArchived(ctx.supabase, ctx.orgId, ctx.userId, data.id, true),
    { revalidate: true }
  );
}

export async function restoreKanbanBoardAction(
  input: KanbanBoardRefInput
): Promise<ActionResult<KanbanBoardSummary>> {
  return guarded(
    PLANNING_BOARDS_UPDATE,
    kanbanBoardRefSchema,
    input,
    (ctx, data) =>
      KanbanBoardsService.setBoardArchived(ctx.supabase, ctx.orgId, ctx.userId, data.id, false),
    { revalidate: true }
  );
}

/** Deletes an archived board for good (its tasks stay in the task list). */
export async function deleteKanbanBoardAction(
  input: KanbanBoardRefInput
): Promise<ActionResult<void>> {
  return guarded(
    PLANNING_BOARDS_UPDATE,
    kanbanBoardRefSchema,
    input,
    (ctx, data) => KanbanBoardsService.deleteBoard(ctx.supabase, data.id),
    { revalidate: true }
  );
}

export async function getKanbanBoardArchiveAction(
  boardId: string
): Promise<ActionResult<KanbanBoardArchive>> {
  return guarded(PLANNING_BOARDS_READ, kanbanBoardRefSchema, { id: boardId }, (ctx, data) =>
    KanbanBoardsService.getBoardArchive(ctx.supabase, ctx.orgId, data.id)
  );
}

// ── Columns ─────────────────────────────────────────────────────────────────

export async function createKanbanColumnAction(
  input: CreateKanbanColumnInput
): Promise<ActionResult<KanbanBoardColumn>> {
  return guarded(PLANNING_BOARDS_UPDATE, createKanbanColumnSchema, input, (ctx, data) =>
    KanbanBoardsService.createColumn(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function updateKanbanColumnAction(
  input: UpdateKanbanColumnInput
): Promise<ActionResult<KanbanBoardColumn>> {
  return guarded(PLANNING_BOARDS_UPDATE, updateKanbanColumnSchema, input, (ctx, data) =>
    KanbanBoardsService.updateColumn(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function archiveKanbanColumnAction(
  input: KanbanColumnRefInput
): Promise<ActionResult<KanbanBoardColumn>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanColumnRefSchema, input, (ctx, data) =>
    KanbanBoardsService.setColumnArchived(ctx.supabase, ctx.orgId, data, true)
  );
}

export async function restoreKanbanColumnAction(
  input: KanbanColumnRefInput
): Promise<ActionResult<KanbanBoardColumn>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanColumnRefSchema, input, (ctx, data) =>
    KanbanBoardsService.setColumnArchived(ctx.supabase, ctx.orgId, data, false)
  );
}

/** Deletes an archived column for good (its tasks stay in the task list). */
export async function deleteKanbanColumnAction(
  input: KanbanColumnRefInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanColumnRefSchema, input, (ctx, data) =>
    KanbanBoardsService.deleteColumn(ctx.supabase, data.id)
  );
}

export async function reorderKanbanColumnsAction(
  input: ReorderKanbanColumnsInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_BOARDS_UPDATE, reorderKanbanColumnsSchema, input, (ctx, data) =>
    KanbanBoardsService.reorderColumns(ctx.supabase, data)
  );
}

// ── Cards (tasks) ───────────────────────────────────────────────────────────

export async function createKanbanCardAction(
  input: CreateKanbanCardInput
): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(PLANNING_BOARDS_UPDATE, createKanbanCardSchema, input, (ctx, data) =>
    KanbanBoardsService.createCard(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function updateKanbanCardAction(
  input: UpdateKanbanCardInput
): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(PLANNING_BOARDS_UPDATE, updateKanbanCardSchema, input, async (ctx, data) => {
    // Anyone who edits the board can take a task ("I'll take it") or let go of
    // it; giving it to someone else needs the assign permission.
    const assignee = data.assigned_to;
    if (
      assignee !== undefined &&
      assignee !== ctx.userId &&
      !checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_ASSIGN)
    ) {
      const current = await currentAssignee(ctx, data.id);
      const releasingOwn = assignee === null && current === ctx.userId;
      if (current !== assignee && !releasingOwn) {
        return { success: false, error: "Insufficient permissions" };
      }
    }
    return KanbanBoardsService.updateCard(ctx.supabase, ctx.orgId, ctx.userId, data);
  });
}

/**
 * The task editor saves one field at a time. Editing a task is the same
 * right on the task list and on a board, so either permission will do; the
 * database (RLS) still decides per board.
 */
export async function patchKanbanTaskAction(
  input: PatchKanbanTaskInput
): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(
    [PLANNING_TASKS_UPDATE, PLANNING_BOARDS_UPDATE],
    patchKanbanTaskSchema,
    input,
    async (ctx, data) => {
      const assignee = data.assigned_to;
      if (
        assignee !== undefined &&
        assignee !== ctx.userId &&
        !checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_ASSIGN)
      ) {
        const current = await currentAssignee(ctx, data.id);
        const releasingOwn = assignee === null && current === ctx.userId;
        if (current !== assignee && !releasingOwn) {
          return { success: false, error: "Insufficient permissions" };
        }
      }
      return KanbanBoardsService.patchTask(ctx.supabase, ctx.orgId, ctx.userId, data);
    }
  );
}

/** A task for the editor, by id or number, with its board and columns. */
export async function getKanbanTaskEditorAction(
  ref: string
): Promise<ActionResult<KanbanTaskEditorData>> {
  return guarded(
    [PLANNING_TASKS_READ, PLANNING_BOARDS_READ],
    kanbanTaskLookupSchema,
    { ref },
    (ctx, data) => KanbanBoardsService.getTaskEditor(ctx.supabase, ctx.orgId, ctx.userId, data.ref)
  );
}

/** Archives every task of a column (they can be restored from the board archive). */
export async function archiveKanbanColumnCardsAction(
  input: KanbanColumnRefInput
): Promise<ActionResult<string[]>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanColumnRefSchema, input, (ctx, data) =>
    KanbanBoardsService.archiveColumnCards(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      data.board_id,
      data.id
    )
  );
}

/** Stars or unstars a board (favourites are per person). */
export async function setKanbanBoardStarAction(
  input: KanbanBoardStarInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_BOARDS_READ, kanbanBoardStarSchema, input, (ctx, data) =>
    KanbanBoardsService.setBoardStar(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      data.board_id,
      data.starred
    )
  );
}

/** Moves a task to a board column or to the inbox (one transaction in the database). */
export async function moveKanbanTaskAction(
  input: MoveKanbanTaskInput
): Promise<ActionResult<KanbanMoveResult>> {
  return guarded(PLANNING_BOARDS_UPDATE, moveKanbanTaskSchema, input, (ctx, data) =>
    KanbanBoardsService.moveTask(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function archiveKanbanCardAction(
  input: KanbanCardRefInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanCardRefSchema, input, (ctx, data) =>
    KanbanBoardsService.archiveCard(ctx.supabase, ctx.orgId, ctx.userId, data.card_id)
  );
}

export async function restoreKanbanCardAction(
  input: KanbanCardRefInput
): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(PLANNING_BOARDS_DELETE, kanbanCardRefSchema, input, (ctx, data) =>
    KanbanBoardsService.restoreCard(ctx.supabase, ctx.orgId, ctx.userId, data.card_id)
  );
}

// ── Board labels ────────────────────────────────────────────────────────────

export async function createKanbanBoardLabelAction(
  input: CreateKanbanBoardLabelInput
): Promise<ActionResult<KanbanBoardLabel>> {
  return guarded(PLANNING_BOARDS_UPDATE, createKanbanBoardLabelSchema, input, (ctx, data) =>
    KanbanBoardsService.createBoardLabel(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function updateKanbanBoardLabelAction(
  input: UpdateKanbanBoardLabelInput
): Promise<ActionResult<KanbanBoardLabel>> {
  return guarded(PLANNING_BOARDS_UPDATE, updateKanbanBoardLabelSchema, input, (ctx, data) =>
    KanbanBoardsService.updateBoardLabel(ctx.supabase, ctx.orgId, data)
  );
}

export async function deleteKanbanBoardLabelAction(
  input: KanbanBoardLabelRefInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_BOARDS_UPDATE, kanbanBoardLabelRefSchema, input, (ctx, data) =>
    KanbanBoardsService.deleteBoardLabel(ctx.supabase, ctx.orgId, data.board_id, data.id)
  );
}

export async function setKanbanTaskLabelsAction(
  input: SetKanbanTaskLabelsInput
): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(PLANNING_TASKS_UPDATE, setKanbanTaskLabelsSchema, input, (ctx, data) =>
    KanbanBoardsService.setTaskLabels(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      data.task_id,
      data.label_ids
    )
  );
}

// ── Checklists ──────────────────────────────────────────────────────────────

export async function listKanbanChecklistsAction(
  taskId: string
): Promise<ActionResult<KanbanChecklist[]>> {
  return guarded(
    [PLANNING_TASKS_READ, PLANNING_BOARDS_READ],
    kanbanCardRefSchema,
    { card_id: taskId },
    (ctx, data) => KanbanBoardsService.listChecklists(ctx.supabase, ctx.orgId, data.card_id)
  );
}

export async function createKanbanChecklistAction(
  input: CreateKanbanChecklistInput
): Promise<ActionResult<KanbanChecklist>> {
  return guarded(PLANNING_TASKS_UPDATE, createKanbanChecklistSchema, input, (ctx, data) =>
    KanbanBoardsService.createChecklist(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      data.task_id,
      data.title
    )
  );
}

export async function renameKanbanChecklistAction(
  input: UpdateKanbanChecklistInput
): Promise<ActionResult<void>> {
  return guarded(PLANNING_TASKS_UPDATE, updateKanbanChecklistSchema, input, (ctx, data) =>
    KanbanBoardsService.renameChecklist(ctx.supabase, ctx.orgId, data.id, data.title)
  );
}

export async function deleteKanbanChecklistAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  return guarded(PLANNING_TASKS_UPDATE, kanbanChecklistRefSchema, input, (ctx, data) =>
    KanbanBoardsService.deleteChecklist(ctx.supabase, ctx.orgId, data.id)
  );
}

export async function addKanbanChecklistItemAction(
  input: CreateKanbanChecklistItemInput
): Promise<ActionResult<KanbanChecklistItem>> {
  return guarded(PLANNING_TASKS_UPDATE, createKanbanChecklistItemSchema, input, (ctx, data) =>
    KanbanBoardsService.addChecklistItem(ctx.supabase, ctx.orgId, ctx.userId, data)
  );
}

export async function updateKanbanChecklistItemAction(
  input: UpdateKanbanChecklistItemInput
): Promise<ActionResult<KanbanChecklistItem>> {
  return guarded(PLANNING_TASKS_UPDATE, updateKanbanChecklistItemSchema, input, (ctx, data) => {
    // Giving an item to someone else takes the same right as giving a task.
    if (
      data.assigned_to &&
      data.assigned_to !== ctx.userId &&
      !checkPermission(ctx.context.user.permissionSnapshot, PLANNING_TASKS_ASSIGN)
    ) {
      return Promise.resolve({ success: false as const, error: "Insufficient permissions" });
    }
    return KanbanBoardsService.updateChecklistItem(ctx.supabase, ctx.orgId, ctx.userId, data);
  });
}

export async function deleteKanbanChecklistItemAction(input: {
  id: string;
}): Promise<ActionResult<void>> {
  return guarded(PLANNING_TASKS_UPDATE, kanbanChecklistRefSchema, input, (ctx, data) =>
    KanbanBoardsService.deleteChecklistItem(ctx.supabase, ctx.orgId, data.id)
  );
}

export async function convertKanbanChecklistItemAction(input: {
  id: string;
}): Promise<ActionResult<KanbanBoardCard>> {
  return guarded(PLANNING_TASKS_UPDATE, kanbanChecklistRefSchema, input, (ctx, data) =>
    KanbanBoardsService.convertChecklistItem(ctx.supabase, ctx.orgId, ctx.userId, data.id)
  );
}

// ── Watchers and board activity ─────────────────────────────────────────────

export async function setKanbanTaskWatchingAction(
  input: KanbanTaskWatchInput
): Promise<ActionResult<void>> {
  return guarded(
    [PLANNING_TASKS_READ, PLANNING_BOARDS_READ],
    kanbanTaskWatchSchema,
    input,
    (ctx, data) =>
      KanbanBoardsService.setWatching(
        ctx.supabase,
        ctx.orgId,
        ctx.userId,
        data.task_id,
        data.watching
      )
  );
}

export async function listKanbanBoardActivityAction(
  boardId: string
): Promise<ActionResult<KanbanBoardActivity[]>> {
  return guarded(PLANNING_BOARDS_READ, kanbanBoardRefSchema, { id: boardId }, (ctx, data) =>
    KanbanBoardsService.listBoardActivity(ctx.supabase, ctx.orgId, data.id)
  );
}
