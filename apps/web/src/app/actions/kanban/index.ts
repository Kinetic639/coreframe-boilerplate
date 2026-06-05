"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  PLANNING_BOARDS_CREATE,
  PLANNING_BOARDS_DELETE,
  PLANNING_BOARDS_READ,
  PLANNING_BOARDS_UPDATE,
} from "@/lib/constants/permissions";
import {
  createKanbanBoardSchema,
  createKanbanCardSchema,
  createKanbanColumnSchema,
  deleteKanbanBoardSchema,
  deleteKanbanColumnSchema,
  moveKanbanCardSchema,
  reorderKanbanColumnsSchema,
  updateKanbanBoardSchema,
  updateKanbanCardSchema,
  updateKanbanColumnSchema,
  type CreateKanbanBoardInput,
  type CreateKanbanCardInput,
  type CreateKanbanColumnInput,
  type DeleteKanbanBoardInput,
  type DeleteKanbanColumnInput,
  type MoveKanbanCardInput,
  type ReorderKanbanColumnsInput,
  type UpdateKanbanBoardInput,
  type UpdateKanbanCardInput,
  type UpdateKanbanColumnInput,
} from "@/lib/validations/kanban";
import { type KanbanBoardDetail, type KanbanBoardSummary } from "@/lib/types/kanban";
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

function firstZodError(error: unknown) {
  const issues = (error as { issues?: Array<{ message?: string }> })?.issues;
  return issues?.[0]?.message ?? "Invalid input";
}

function revalidateBoards() {
  revalidatePath("/dashboard/planning/boards");
  revalidatePath("/dashboard/planowanie/tablice");
}

export async function listKanbanBoardsAction(): Promise<ActionResult<KanbanBoardSummary[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_READ)) {
      return { success: false, error: "Insufficient permissions" };
    }
    return KanbanBoardsService.listBoards(ctx.supabase, ctx.orgId);
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
    return KanbanBoardsService.getBoard(ctx.supabase, ctx.orgId, boardId);
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

export async function deleteKanbanBoardAction(
  input: DeleteKanbanBoardInput
): Promise<ActionResult<KanbanBoardSummary[]>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_DELETE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = deleteKanbanBoardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.softDeleteBoard(
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

export async function createKanbanColumnAction(
  input: CreateKanbanColumnInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = createKanbanColumnSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.createColumn(ctx.supabase, ctx.orgId, parsed.data);
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function updateKanbanColumnAction(
  input: UpdateKanbanColumnInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = updateKanbanColumnSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.updateColumn(ctx.supabase, ctx.orgId, parsed.data);
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteKanbanColumnAction(
  input: DeleteKanbanColumnInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_DELETE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = deleteKanbanColumnSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.softDeleteColumn(
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

export async function createKanbanCardAction(
  input: CreateKanbanCardInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = createKanbanCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.createCard(
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

export async function updateKanbanCardAction(
  input: UpdateKanbanCardInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = updateKanbanCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.updateCard(
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

export async function moveKanbanCardAction(
  input: MoveKanbanCardInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = moveKanbanCardSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.moveCard(
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

export async function reorderKanbanColumnsAction(
  input: ReorderKanbanColumnsInput
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_UPDATE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const parsed = reorderKanbanColumnsSchema.safeParse(input);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };
    const result = await KanbanBoardsService.reorderColumns(ctx.supabase, ctx.orgId, parsed.data);
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteKanbanCardAction(
  boardId: string,
  cardId: string
): Promise<ActionResult<KanbanBoardDetail>> {
  try {
    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    if (!checkPermission(ctx.context.user.permissionSnapshot, PLANNING_BOARDS_DELETE)) {
      return { success: false, error: "Insufficient permissions" };
    }
    const result = await KanbanBoardsService.softDeleteCard(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      boardId,
      cardId
    );
    if (result.success) revalidateBoards();
    return result;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
