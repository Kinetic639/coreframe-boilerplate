import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddKanbanBoardMemberInput,
  CreateKanbanBoardInput,
  CreateKanbanCardInput,
  CreateKanbanColumnInput,
  DeleteKanbanBoardInput,
  DeleteKanbanColumnInput,
  KanbanMemberRole,
  KanbanVisibility,
  MoveKanbanCardToInboxInput,
  MoveKanbanCardInput,
  MoveKanbanInboxCardToBoardInput,
  RemoveKanbanBoardMemberInput,
  ReorderKanbanColumnsInput,
  UpdateKanbanBoardInput,
  UpdateKanbanBoardMemberInput,
  UpdateKanbanCardInput,
  UpdateKanbanColumnInput,
} from "@/lib/validations/kanban";
import { normalizeCommentRichText } from "@/lib/validations/comments";
import {
  MAX_KANBAN_BOARDS_PER_USER,
  type KanbanBoardAccess,
  type KanbanBoardMember,
  type KanbanCardActivity,
  type KanbanBoardCard,
  type KanbanBoardColumn,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
  type KanbanTaskStatus,
} from "@/lib/types/kanban";

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };

export interface CardCalendarRow {
  id: string;
  board_id: string;
  title: string;
  due_date: string | null;
  calendar_all_day: boolean | null;
  calendar_start_date: string | null;
  calendar_end_date: string | null;
  calendar_start_at: string | null;
  calendar_end_at: string | null;
  calendar_timezone: string | null;
  label: string | null;
  label_color: string | null;
  is_inbox: boolean;
}

export interface CardCalendarListParams {
  rangeStart: string;
  rangeEnd: string;
  rangeStartIso: string;
  rangeEndIso: string;
  includeUnscheduled: boolean;
  unscheduledLimit: number;
  unscheduledSearch?: string;
  boardIds?: string[];
}

export interface CardCalendarListResult {
  scheduled: CardCalendarRow[];
  unscheduled: CardCalendarRow[];
  hasMoreUnscheduled: boolean;
}

function displayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || null;
}

const BOARD_FIELDS = `id, organization_id, title, description, color, visibility, branch_id, created_by, created_at, updated_at,
           creator:users!created_by(first_name, last_name, email)`;

// Before migration 20261115200000 runs there is no branch_id and no members
// table. Reads fall back to the old shape so the boards keep working while
// the code is deployed ahead of the database.
const LEGACY_BOARD_FIELDS = `id, organization_id, title, description, color, visibility, created_by, created_at, updated_at,
           creator:users!created_by(first_name, last_name, email)`;

function isMissingSharingSchema(error: { code?: string } | null | undefined): boolean {
  return ["42703", "42P01", "PGRST204", "PGRST205"].includes(error?.code ?? "");
}

function normalizeVisibility(value: string): KanbanVisibility {
  return value === "public" ? "organization" : (value as KanbanVisibility);
}

/**
 * The current user's role on a board, mirroring planning_board_access() in the
 * database (which is what actually enforces it): owner, else an explicit
 * member role, else editor through the board's scope (RLS only returns boards
 * the user can see).
 */
function boardAccess(
  row: { created_by: string },
  userId: string | undefined,
  memberRole: KanbanMemberRole | undefined
): KanbanBoardAccess {
  if (userId && row.created_by === userId) return "owner";
  return memberRole ?? "editor";
}

function mapMember(row: any): KanbanBoardMember {
  const user = Array.isArray(row.user) ? row.user[0] : row.user;
  return {
    user_id: row.user_id,
    role: row.role as KanbanMemberRole,
    name: user ? displayName(user.first_name, user.last_name, user.email) : null,
    email: user?.email ?? null,
    created_at: row.created_at,
  };
}

async function myMemberRoles(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | undefined
): Promise<Map<string, KanbanMemberRole>> {
  if (!userId) return new Map();
  const { data } = await supabase
    .from("planning_kanban_board_members")
    .select("board_id, role")
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  return new Map(
    ((data ?? []) as Array<{ board_id: string; role: KanbanMemberRole }>).map((row) => [
      row.board_id,
      row.role,
    ])
  );
}

function mapBoard(
  row: any,
  userId?: string,
  memberRoles: Map<string, KanbanMemberRole> = new Map()
): KanbanBoardSummary {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    color: row.color ?? null,
    visibility: normalizeVisibility(row.visibility),
    branch_id: row.branch_id ?? null,
    created_by: row.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
    my_access: boardAccess(row, userId, memberRoles.get(row.id)),
  };
}

function mapColumn(row: any): KanbanBoardColumn {
  return {
    id: row.id,
    board_id: row.board_id,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description ?? null,
    color: row.color ?? null,
    status_category: (row.status_category ?? null) as KanbanTaskStatus | null,
    position: row.position ?? 0,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const CALENDAR_CARD_FIELDS =
  "id, board_id, title, due_date, calendar_all_day, calendar_start_date, calendar_end_date, calendar_start_at, calendar_end_at, calendar_timezone, label, label_color, is_inbox";
const CALENDAR_CARD_FIELDS_WITHOUT_LABEL = CALENDAR_CARD_FIELDS.replace(" label, label_color,", "");

const COLUMN_FIELDS =
  "id, board_id, organization_id, title, description, color, status_category, position, created_at, updated_at";

// Since phase 2 a board shows tasks: every card is a planning_tasks row.
const TASK_CARD_FIELDS = `id, board_id, column_id, organization_id, task_number, title, description_plain, description_rich,
  status, priority, assigned_to, due_at, label, label_color, is_inbox, board_position, created_by, created_at, updated_at,
  creator:users!created_by(first_name, last_name, email),
  assignee:users!assigned_to(first_name, last_name, email)`;

// Before migration 20261116090000 tasks have no label. Reads and writes fall
// back to the shape without it, so the boards (and the home dashboard) keep
// working while the code is deployed ahead of the database.
const TASK_CARD_FIELDS_WITHOUT_LABEL = TASK_CARD_FIELDS.replace(" label, label_color,", "");

async function selectWithLabelFallback<T>(
  run: (fields: string) => PromiseLike<{ data: T | null; error: any }>,
  fields: string = TASK_CARD_FIELDS,
  fallbackFields: string = TASK_CARD_FIELDS_WITHOUT_LABEL
): Promise<{ data: T | null; error: any }> {
  const first = await run(fields);
  return isMissingSharingSchema(first.error) ? run(fallbackFields) : first;
}

function withoutLabel<T extends Record<string, unknown>>(values: T): T {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { label, label_color, ...rest } = values;
  return rest as T;
}

function mapCard(row: any): KanbanBoardCard {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  return {
    id: row.id,
    board_id: row.board_id ?? "",
    column_id: row.column_id ?? "",
    task_number: row.task_number,
    status: row.status as KanbanTaskStatus,
    priority: row.priority ?? "normal",
    assigned_to: row.assigned_to ?? null,
    assignee_name: assignee
      ? displayName(assignee.first_name, assignee.last_name, assignee.email)
      : null,
    assignee_email: assignee?.email ?? null,
    organization_id: row.organization_id,
    title: row.title,
    description: row.description_plain ?? null,
    description_rich: row.description_rich ?? null,
    due_at: row.due_at ?? null,
    label: row.label ?? null,
    label_color: row.label_color ?? null,
    is_inbox: row.is_inbox ?? false,
    position: row.board_position ?? 0,
    created_by: row.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function mapActivity(row: any): KanbanCardActivity {
  const actor = Array.isArray(row.actor) ? row.actor[0] : row.actor;
  return {
    id: row.id,
    organization_id: row.organization_id,
    board_id: row.board_id ?? "",
    card_id: row.task_id,
    actor_id: row.actor_id ?? null,
    actor_name: actor ? displayName(actor.first_name, actor.last_name, actor.email) : null,
    actor_email: actor?.email ?? null,
    activity_type: row.activity_type,
    message: row.message ?? null,
    metadata: row.metadata ?? {},
    created_at: row.created_at,
  };
}

async function nextColumnPosition(supabase: SupabaseClient, boardId: string): Promise<number> {
  const { data } = await supabase
    .from("planning_kanban_columns")
    .select("position")
    .eq("board_id", boardId)
    .is("deleted_at", null)
    .order("position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as any)?.position ?? -1) + 1;
}

async function nextTaskPosition(supabase: SupabaseClient, columnId: string): Promise<number> {
  const { data } = await supabase
    .from("planning_tasks")
    .select("board_position")
    .eq("column_id", columnId)
    .is("deleted_at", null)
    .order("board_position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as any)?.board_position ?? -1) + 1;
}

async function nextInboxPosition(
  supabase: SupabaseClient,
  orgId: string,
  userId: string
): Promise<number> {
  const { data } = await supabase
    .from("planning_tasks")
    .select("board_position")
    .eq("organization_id", orgId)
    .eq("created_by", userId)
    .eq("is_inbox", true)
    .is("deleted_at", null)
    .order("board_position", { ascending: false })
    .limit(1)
    .maybeSingle();
  return ((data as any)?.board_position ?? -1) + 1;
}

/** Same activity types the task service writes for a status change. */
function statusActivityType(from: KanbanTaskStatus, to: KanbanTaskStatus): string {
  if (to === "completed") return "completed";
  if (to === "cancelled") return "cancelled";
  if (from === "completed" || from === "cancelled") return "reopened";
  return "status_changed";
}

function failedUpdate(results: Array<{ error: unknown }>, fallback: string): string | null {
  const failed = results.find((result) => result.error);
  if (!failed?.error) return null;
  const error = failed.error as { message?: string };
  return error.message ?? fallback;
}

export const KanbanBoardsService = {
  async recordCardActivity(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    cardId: string,
    actorId: string | null,
    activityType: string,
    metadata: Record<string, unknown> = {},
    message?: string
  ): Promise<void> {
    // A card is a task: its history is the task's activity.
    await supabase.from("planning_task_activity").insert({
      organization_id: orgId,
      task_id: cardId,
      actor_id: actorId,
      activity_type: activityType,
      message: message ?? null,
      metadata: boardId ? { board_id: boardId, ...metadata } : metadata,
    });
  },

  async listCardActivity(
    supabase: SupabaseClient,
    orgId: string,
    cardId: string
  ): Promise<ServiceResult<KanbanCardActivity[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_task_activity")
        .select(
          `id, organization_id, task_id, actor_id, activity_type, message, metadata, created_at,
           actor:users!actor_id(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .eq("task_id", cardId)
        .order("created_at", { ascending: true });

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapActivity) };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async listBoards(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<KanbanBoardSummary[]>> {
    try {
      // RLS returns exactly the boards this user can see (own, shared with
      // them, their branch's, the organization's).
      const selectBoards = (fields: string) =>
        supabase
          .from("planning_kanban_boards")
          .select(fields)
          .eq("organization_id", orgId)
          .is("deleted_at", null)
          .order("updated_at", { ascending: false });
      const [first, memberRoles] = await Promise.all([
        selectBoards(BOARD_FIELDS),
        myMemberRoles(supabase, orgId, userId),
      ]);
      const { data, error } = isMissingSharingSchema(first.error)
        ? await selectBoards(LEGACY_BOARD_FIELDS)
        : first;

      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: (data ?? []).map((row) => mapBoard(row, userId, memberRoles)),
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async getBoard(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    userId?: string
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const selectBoard = (fields: string) =>
        supabase
          .from("planning_kanban_boards")
          .select(fields)
          .eq("organization_id", orgId)
          .eq("id", boardId)
          .is("deleted_at", null)
          .single();
      const firstBoard = await selectBoard(BOARD_FIELDS);
      const { data: boardRaw, error: boardError } = isMissingSharingSchema(firstBoard.error)
        ? await selectBoard(LEGACY_BOARD_FIELDS)
        : firstBoard;

      if (boardError) return { success: false, error: boardError.message };

      const [columnsResult, cardsResult, membersResult] = await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .select(COLUMN_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .is("deleted_at", null)
          .order("position", { ascending: true }),
        selectWithLabelFallback<any[]>((fields) =>
          supabase
            .from("planning_tasks")
            .select(fields)
            .eq("organization_id", orgId)
            .eq("board_id", boardId)
            .not("column_id", "is", null)
            .is("deleted_at", null)
            .order("board_position", { ascending: true })
            .order("created_at", { ascending: true })
        ),
        supabase
          .from("planning_kanban_board_members")
          .select(
            `user_id, role, created_at,
             user:users!user_id(first_name, last_name, email)`
          )
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .order("created_at", { ascending: true }),
      ]);

      if (columnsResult.error) return { success: false, error: columnsResult.error.message };
      if (cardsResult.error) return { success: false, error: cardsResult.error.message };
      if (membersResult.error && !isMissingSharingSchema(membersResult.error)) {
        return { success: false, error: membersResult.error.message };
      }

      const members = membersResult.error ? [] : (membersResult.data ?? []).map(mapMember);
      const memberRoles = new Map<string, KanbanMemberRole>(
        userId ? members.filter((m) => m.user_id === userId).map((m) => [boardId, m.role]) : []
      );
      const board = mapBoard(boardRaw as any, userId, memberRoles);

      return {
        success: true,
        data: {
          ...board,
          columns: (columnsResult.data ?? []).map(mapColumn),
          cards: (cardsResult.data ?? []).map(mapCard),
          members,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { count, error: countError } = await supabase
        .from("planning_kanban_boards")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("created_by", userId)
        .is("deleted_at", null);

      if (countError) return { success: false, error: countError.message };
      if ((count ?? 0) >= MAX_KANBAN_BOARDS_PER_USER) {
        return {
          success: false,
          error: `You can create up to ${MAX_KANBAN_BOARDS_PER_USER} boards.`,
        };
      }

      const { data, error } = await supabase
        .from("planning_kanban_boards")
        .insert({
          organization_id: orgId,
          title: input.title,
          description: input.description || null,
          color: input.color || null,
          visibility: input.visibility,
          branch_id: input.visibility === "branch" ? (input.branch_id ?? null) : null,
          created_by: userId,
          updated_by: userId,
        })
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };

      const boardId = (data as any).id as string;
      const members = (input.members ?? []).filter((member) => member.user_id !== userId);
      if (members.length) {
        // The board exists either way: if this fails, the returned board has
        // fewer members than asked for and the client says so.
        await supabase.from("planning_kanban_board_members").upsert(
          members.map((member) => ({
            board_id: boardId,
            organization_id: orgId,
            user_id: member.user_id,
            role: member.role,
            added_by: userId,
          })),
          { onConflict: "board_id,user_id" }
        );
      }
      return KanbanBoardsService.getBoard(supabase, orgId, boardId, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Members (owner only; enforced by RLS) ─────────────────────────────────

  async addBoardMember(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: AddKanbanBoardMemberInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase.from("planning_kanban_board_members").upsert(
        {
          board_id: input.board_id,
          organization_id: orgId,
          user_id: input.user_id,
          role: input.role,
          added_by: userId,
        },
        { onConflict: "board_id,user_id" }
      );
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateBoardMember(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanBoardMemberInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_board_members")
        .update({ role: input.role })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("user_id", input.user_id);
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async removeBoardMember(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: RemoveKanbanBoardMemberInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_board_members")
        .delete()
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("user_id", input.user_id);
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: DeleteKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardSummary[]>> {
    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("planning_kanban_boards")
        .update({ deleted_at: deletedAt, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .update({ deleted_at: deletedAt })
          .eq("organization_id", orgId)
          .eq("board_id", input.id)
          .is("deleted_at", null),
        supabase
          .from("planning_tasks")
          .update({ deleted_at: deletedAt, updated_by: userId })
          .eq("organization_id", orgId)
          .eq("board_id", input.id)
          .is("deleted_at", null),
      ]);

      return KanbanBoardsService.listBoards(supabase, orgId, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const updatePayload: Record<string, unknown> = {
        title: input.title,
        description: input.description || null,
        visibility: input.visibility,
        branch_id: input.visibility === "branch" ? (input.branch_id ?? null) : null,
        updated_by: userId,
      };
      if (input.color !== undefined) {
        updatePayload.color = input.color || null;
      }

      const { error } = await supabase
        .from("planning_kanban_boards")
        .update(updatePayload)
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createColumn(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const position = await nextColumnPosition(supabase, input.board_id);
      const { error } = await supabase.from("planning_kanban_columns").insert({
        board_id: input.board_id,
        organization_id: orgId,
        title: input.title,
        description: input.description || null,
        color: input.color || null,
        status_category: input.status_category ?? null,
        position,
      });
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateColumn(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_columns")
        .update({
          title: input.title,
          description: input.description || null,
          color: input.color || null,
          ...(input.status_category !== undefined
            ? { status_category: input.status_category }
            : {}),
        })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteColumn(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: DeleteKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const deletedAt = new Date().toISOString();
      const { error } = await supabase
        .from("planning_kanban_columns")
        .update({ deleted_at: deletedAt })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      // The column's tasks are records of their own: they leave the board and
      // stay in the task list instead of being archived with the column.
      await supabase
        .from("planning_tasks")
        .update({ board_id: null, column_id: null, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("column_id", input.id)
        .is("deleted_at", null);

      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async createCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const position = await nextTaskPosition(supabase, input.column_id);
      // The board trigger sets the status from the column (when it has one).
      const values = {
        organization_id: orgId,
        board_id: input.board_id,
        column_id: input.column_id,
        board_position: position,
        title: input.title,
        description_plain: input.description || null,
        description_rich: normalizeCommentRichText(input.description_rich) ?? null,
        due_at: input.due_at || null,
        label: input.label || null,
        label_color: input.label_color || null,
        created_by: userId,
        updated_by: userId,
      };
      const insert = (row: Record<string, unknown>) =>
        supabase.from("planning_tasks").insert(row).select("id").single();
      let { data, error } = await insert(values);
      if (isMissingSharingSchema(error) && !input.label)
        ({ data, error } = await insert(withoutLabel(values)));
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        (data as any).id,
        userId,
        "task_created"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: currentRaw, error: currentError } = await supabase
        .from("planning_tasks")
        .select("id, column_id, status, assigned_to")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null)
        .single();
      if (currentError) return { success: false, error: currentError.message };
      const current = currentRaw as {
        column_id: string | null;
        status: KanbanTaskStatus;
        assigned_to: string | null;
      };

      const columnChanged = input.column_id !== current.column_id;
      const statusChanged = input.status !== undefined && input.status !== current.status;
      const assigneeChanged =
        input.assigned_to !== undefined && input.assigned_to !== current.assigned_to;

      // Only what changed is sent: a new column may set the status itself
      // (status column), and the status may move the task (board trigger).
      const update: Record<string, unknown> = {
        title: input.title,
        description_plain: input.description || null,
        description_rich: normalizeCommentRichText(input.description_rich) ?? null,
        due_at: input.due_at || null,
        label: input.label || null,
        label_color: input.label_color || null,
        updated_by: userId,
      };
      if (columnChanged) {
        update.column_id = input.column_id;
        update.board_position = await nextTaskPosition(supabase, input.column_id);
      }
      if (statusChanged && !columnChanged) update.status = input.status;
      if (assigneeChanged) update.assigned_to = input.assigned_to;

      const runUpdate = (values: Record<string, unknown>) =>
        supabase
          .from("planning_tasks")
          .update(values)
          .eq("organization_id", orgId)
          .eq("board_id", input.board_id)
          .eq("id", input.id)
          .is("deleted_at", null)
          .select("status")
          .single();
      let { data: updatedRaw, error } = await runUpdate(update);
      if (isMissingSharingSchema(error) && !input.label) {
        ({ data: updatedRaw, error } = await runUpdate(withoutLabel(update)));
      }
      if (error) return { success: false, error: error.message };

      const newStatus = (updatedRaw as { status: KanbanTaskStatus }).status;
      if (columnChanged) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          input.board_id,
          input.id,
          userId,
          "card_moved",
          { from_column_id: current.column_id, to_column_id: input.column_id }
        );
      }
      if (newStatus !== current.status) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          input.board_id,
          input.id,
          userId,
          statusActivityType(current.status, newStatus),
          { from: current.status, to: newStatus }
        );
      }
      if (assigneeChanged) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          input.board_id,
          input.id,
          userId,
          input.assigned_to ? "assigned" : "unassigned",
          { from: current.assigned_to, to: input.assigned_to ?? null }
        );
      }
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        input.id,
        userId,
        "card_updated"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async moveCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: MoveKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: cardsRaw, error: cardsError } = await supabase
        .from("planning_tasks")
        .select("id, column_id, board_position, status")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .not("column_id", "is", null)
        .is("deleted_at", null)
        .order("board_position", { ascending: true });

      if (cardsError) return { success: false, error: cardsError.message };

      const cards = (cardsRaw ?? []) as Array<{
        id: string;
        column_id: string;
        board_position: number;
        status: KanbanTaskStatus;
      }>;
      const moved = cards.find((card) => card.id === input.card_id);
      if (!moved) return { success: false, error: "Card not found" };
      const fromColumnId = moved.column_id;

      const affectedColumnIds = new Set([moved.column_id, input.to_column_id]);
      const updates: Array<PromiseLike<{ error: unknown }>> = [];

      for (const columnId of affectedColumnIds) {
        const nextCards = cards
          .filter((card) => card.column_id === columnId && card.id !== input.card_id)
          .sort((a, b) => a.board_position - b.board_position);

        if (columnId === input.to_column_id) {
          nextCards.splice(input.to_position, 0, { ...moved, column_id: input.to_column_id });
        }

        nextCards.forEach((card, index) => {
          const isMoved = card.id === input.card_id;
          // Only the moved task changes column; the others only get a new
          // order, and only when it actually changed.
          if (!isMoved && card.board_position === index) return;
          updates.push(
            supabase
              .from("planning_tasks")
              .update(
                isMoved && fromColumnId !== input.to_column_id
                  ? { column_id: columnId, board_position: index, updated_by: userId }
                  : { board_position: index }
              )
              .eq("organization_id", orgId)
              .eq("board_id", input.board_id)
              .eq("id", card.id)
          );
        });
      }

      const failure = failedUpdate(await Promise.all(updates), "Failed to move card");
      if (failure) return { success: false, error: failure };

      if (fromColumnId !== input.to_column_id) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          input.board_id,
          input.card_id,
          userId,
          "card_moved",
          { from_column_id: fromColumnId, to_column_id: input.to_column_id }
        );
        const { data: after } = await supabase
          .from("planning_tasks")
          .select("status")
          .eq("id", input.card_id)
          .maybeSingle();
        const newStatus = (after as { status?: KanbanTaskStatus } | null)?.status;
        if (newStatus && newStatus !== moved.status) {
          await KanbanBoardsService.recordCardActivity(
            supabase,
            orgId,
            input.board_id,
            input.card_id,
            userId,
            statusActivityType(moved.status, newStatus),
            { from: moved.status, to: newStatus }
          );
        }
      }

      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  /** The current user's inbox: their own tasks not placed on a board yet. */
  async listInboxCards(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<KanbanBoardCard[]>> {
    try {
      const { data, error } = await selectWithLabelFallback<any[]>((fields) =>
        supabase
          .from("planning_tasks")
          .select(fields)
          .eq("organization_id", orgId)
          .eq("created_by", userId)
          .eq("is_inbox", true)
          .is("deleted_at", null)
          .order("board_position", { ascending: true })
          .order("updated_at", { ascending: false })
      );

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapCard) };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async moveCardToInbox(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: MoveKanbanCardToInboxInput
  ): Promise<ServiceResult<{ board: KanbanBoardDetail; inbox: KanbanBoardCard[] }>> {
    try {
      const { data: currentRaw, error: currentError } = await supabase
        .from("planning_tasks")
        .select("column_id, created_by")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.card_id)
        .is("deleted_at", null)
        .single();
      if (currentError) return { success: false, error: currentError.message };
      const current = currentRaw as { column_id: string | null; created_by: string };
      // The inbox is private to the task's author.
      if (current.created_by !== userId) {
        return { success: false, error: "Only the author can move a task to their inbox." };
      }

      const position = await nextInboxPosition(supabase, orgId, userId);
      const { error } = await supabase
        .from("planning_tasks")
        .update({
          board_id: null,
          column_id: null,
          is_inbox: true,
          board_position: position,
          updated_by: userId,
        })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.card_id)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        input.card_id,
        userId,
        "card_moved_to_inbox",
        { from_column_id: current.column_id }
      );

      return KanbanBoardsService.boardAndInbox(supabase, orgId, userId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async moveInboxCardToBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: MoveKanbanInboxCardToBoardInput
  ): Promise<ServiceResult<{ board: KanbanBoardDetail; inbox: KanbanBoardCard[] }>> {
    try {
      const { data: targetCardsRaw, error: cardsError } = await supabase
        .from("planning_tasks")
        .select("id, board_position")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("column_id", input.column_id)
        .is("deleted_at", null)
        .order("board_position", { ascending: true });

      if (cardsError) return { success: false, error: cardsError.message };

      const destinationCards = (targetCardsRaw ?? []) as Array<{
        id: string;
        board_position: number;
      }>;
      const boundedPosition = Math.max(0, Math.min(input.position, destinationCards.length));

      const { error: movedError } = await supabase
        .from("planning_tasks")
        .update({
          board_id: input.board_id,
          column_id: input.column_id,
          is_inbox: false,
          board_position: boundedPosition,
          updated_by: userId,
        })
        .eq("organization_id", orgId)
        .eq("id", input.card_id)
        .eq("is_inbox", true)
        .is("deleted_at", null);
      if (movedError) return { success: false, error: movedError.message };

      const failure = failedUpdate(
        await Promise.all(
          destinationCards.map((card, index) =>
            supabase
              .from("planning_tasks")
              .update({ board_position: index >= boundedPosition ? index + 1 : index })
              .eq("organization_id", orgId)
              .eq("board_id", input.board_id)
              .eq("id", card.id)
              .is("deleted_at", null)
          )
        ),
        "Failed to move inbox card"
      );
      if (failure) return { success: false, error: failure };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        input.card_id,
        userId,
        "card_moved_from_inbox",
        { to_column_id: input.column_id }
      );

      return KanbanBoardsService.boardAndInbox(supabase, orgId, userId, input.board_id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async boardAndInbox(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string
  ): Promise<ServiceResult<{ board: KanbanBoardDetail; inbox: KanbanBoardCard[] }>> {
    const [boardResult, inboxResult] = await Promise.all([
      KanbanBoardsService.getBoard(supabase, orgId, boardId, userId),
      KanbanBoardsService.listInboxCards(supabase, orgId, userId),
    ]);
    if (!boardResult.success) {
      return {
        success: false,
        error: "error" in boardResult ? boardResult.error : "Failed to load board",
      };
    }
    if (!inboxResult.success) {
      return {
        success: false,
        error: "error" in inboxResult ? inboxResult.error : "Failed to load inbox",
      };
    }
    return { success: true, data: { board: boardResult.data, inbox: inboxResult.data } };
  },

  async reorderColumns(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: ReorderKanbanColumnsInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const results = await Promise.all(
        input.column_ids.map((id, position) =>
          supabase
            .from("planning_kanban_columns")
            .update({ position })
            .eq("organization_id", orgId)
            .eq("board_id", input.board_id)
            .eq("id", id)
            .is("deleted_at", null)
        )
      );
      const failed = results.find((result) => result.error);
      if (failed?.error) return { success: false, error: failed.error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, input.board_id, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDeleteCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string,
    cardId: string
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({ deleted_at: new Date().toISOString(), updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("id", cardId)
        .is("deleted_at", null);
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        boardId,
        cardId,
        userId,
        "archived"
      );
      return KanbanBoardsService.getBoard(supabase, orgId, boardId, userId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Calendar ─────────────────────────────────────────────────────────────

  async listCardsForCalendar(
    supabase: SupabaseClient,
    orgId: string,
    params: CardCalendarListParams
  ): Promise<ServiceResult<CardCalendarListResult>> {
    try {
      if (params.boardIds && params.boardIds.length === 0) {
        return {
          success: true,
          data: { scheduled: [], unscheduled: [], hasMoreUnscheduled: false },
        };
      }

      const scheduledQuery = (fields: string) => {
        let query = supabase
          .from("planning_tasks")
          .select(fields)
          .eq("organization_id", orgId)
          .not("board_id", "is", null)
          .neq("status", "cancelled")
          .is("deleted_at", null)
          .or(
            [
              `and(calendar_all_day.eq.true,calendar_start_date.lte.${params.rangeEnd},calendar_end_date.gte.${params.rangeStart})`,
              `and(calendar_all_day.eq.false,calendar_start_at.lte.${params.rangeEndIso},calendar_end_at.gte.${params.rangeStartIso})`,
              `and(calendar_all_day.is.null,due_date.gte.${params.rangeStart},due_date.lte.${params.rangeEnd})`,
            ].join(",")
          )
          .order("due_date", { ascending: true });
        if (params.boardIds) query = query.in("board_id", params.boardIds);
        return query;
      };

      const { data: scheduledData, error: scheduledError } = await selectWithLabelFallback<any[]>(
        scheduledQuery,
        CALENDAR_CARD_FIELDS,
        CALENDAR_CARD_FIELDS_WITHOUT_LABEL
      );
      if (scheduledError) return { success: false, error: scheduledError.message };

      let unscheduled: CardCalendarRow[] = [];
      let hasMoreUnscheduled = false;
      if (params.includeUnscheduled && params.unscheduledLimit > 0) {
        const unscheduledQuery = (fields: string) => {
          let query = supabase
            .from("planning_tasks")
            .select(fields)
            .eq("organization_id", orgId)
            .not("board_id", "is", null)
            .neq("status", "cancelled")
            .neq("status", "completed")
            .is("deleted_at", null)
            .is("due_date", null)
            .is("calendar_all_day", null)
            .order("updated_at", { ascending: false })
            .limit(params.unscheduledLimit + 1);
          if (params.unscheduledSearch) {
            query = query.ilike("title", `%${params.unscheduledSearch}%`);
          }
          if (params.boardIds) query = query.in("board_id", params.boardIds);
          return query;
        };

        const { data: unscheduledData, error: unscheduledError } = await selectWithLabelFallback<
          any[]
        >(unscheduledQuery, CALENDAR_CARD_FIELDS, CALENDAR_CARD_FIELDS_WITHOUT_LABEL);
        if (unscheduledError) return { success: false, error: unscheduledError.message };
        const rows = (unscheduledData ?? []) as CardCalendarRow[];
        hasMoreUnscheduled = rows.length > params.unscheduledLimit;
        unscheduled = rows.slice(0, params.unscheduledLimit);
      }

      return {
        success: true,
        data: {
          scheduled: (scheduledData ?? []) as CardCalendarRow[],
          unscheduled,
          hasMoreUnscheduled,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateCardDueAt(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    cardId: string,
    boardId: string,
    dueAt: string | null,
    dueDate?: string | null
  ): Promise<ServiceResult<void>> {
    try {
      const boardResult = await KanbanBoardsService.getBoard(supabase, orgId, boardId, userId);
      if (!boardResult.success) return { success: false, error: "Board not found" };

      const { error } = await supabase
        .from("planning_tasks")
        .update({ due_at: dueAt, due_date: dueDate ?? null, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("id", cardId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        boardId,
        cardId,
        userId,
        "card_updated",
        { due_at: dueAt, due_date: dueDate ?? null }
      );

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async updateCardCalendarSchedule(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    cardId: string,
    boardId: string,
    schedule:
      | {
          allDay: true;
          startDate: string;
          endDate: string;
          timezone: string;
        }
      | {
          allDay: false;
          startAt: string;
          endAt: string;
          timezone: string;
        }
      | null
  ): Promise<ServiceResult<void>> {
    try {
      const boardResult = await KanbanBoardsService.getBoard(supabase, orgId, boardId, userId);
      if (!boardResult.success) return { success: false, error: "Board not found" };

      let update:
        | {
            calendar_all_day: null;
            calendar_start_date: null;
            calendar_end_date: null;
            calendar_start_at: null;
            calendar_end_at: null;
            calendar_timezone: null;
            updated_by: string;
          }
        | {
            calendar_all_day: boolean;
            calendar_start_date: string | null;
            calendar_end_date: string | null;
            calendar_start_at: string | null;
            calendar_end_at: string | null;
            calendar_timezone: string;
            updated_by: string;
          };

      if (schedule === null) {
        update = {
          calendar_all_day: null,
          calendar_start_date: null,
          calendar_end_date: null,
          calendar_start_at: null,
          calendar_end_at: null,
          calendar_timezone: null,
          updated_by: userId,
        };
      } else if (schedule.allDay === true) {
        update = {
          calendar_all_day: true,
          calendar_start_date: schedule.startDate,
          calendar_end_date: schedule.endDate,
          calendar_start_at: null,
          calendar_end_at: null,
          calendar_timezone: schedule.timezone,
          updated_by: userId,
        };
      } else {
        update = {
          calendar_all_day: false,
          calendar_start_date: null,
          calendar_end_date: null,
          calendar_start_at: schedule.startAt,
          calendar_end_at: schedule.endAt,
          calendar_timezone: schedule.timezone,
          updated_by: userId,
        };
      }

      const { error } = await supabase
        .from("planning_tasks")
        .update(update)
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("id", cardId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        boardId,
        cardId,
        userId,
        "card_updated",
        { calendar_schedule: schedule }
      );

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },
};
