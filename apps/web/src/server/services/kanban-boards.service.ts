import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type {
  AddKanbanBoardMemberInput,
  CreateKanbanBoardInput,
  CreateKanbanCardInput,
  CreateKanbanColumnInput,
  KanbanColumnRefInput,
  KanbanMemberRole,
  KanbanVisibility,
  MoveKanbanTaskInput,
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
  type KanbanBoardArchive,
  type KanbanBoardMember,
  type KanbanCardActivity,
  type KanbanBoardCard,
  type KanbanBoardColumn,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
  type KanbanMoveResult,
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

const BOARD_FIELDS = `id, organization_id, title, description, color, visibility, branch_id, created_by, created_at, updated_at, archived_at,
           creator:users!created_by(first_name, last_name, email)`;

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
    archived_at: row.archived_at ?? null,
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
    archived_at: row.archived_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const CALENDAR_CARD_FIELDS =
  "id, board_id, title, due_date, calendar_all_day, calendar_start_date, calendar_end_date, calendar_start_at, calendar_end_at, calendar_timezone, label, label_color, is_inbox";

const COLUMN_FIELDS =
  "id, board_id, organization_id, title, description, color, status_category, position, archived_at, created_at, updated_at";

// Every card is a planning_tasks row.
const TASK_CARD_FIELDS = `id, board_id, column_id, organization_id, task_number, title, description_plain, description_rich,
  status, priority, assigned_to, due_at, label, label_color, is_inbox, board_position, created_by, created_at, updated_at, deleted_at,
  creator:users!created_by(first_name, last_name, email),
  assignee:users!assigned_to(first_name, last_name, email)`;

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
    archived_at: row.deleted_at ?? null,
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

/** Same activity types the task service writes for a status change. */
function statusActivityType(from: KanbanTaskStatus, to: KanbanTaskStatus): string {
  if (to === "completed") return "completed";
  if (to === "cancelled") return "cancelled";
  if (from === "completed" || from === "cancelled") return "reopened";
  return "status_changed";
}

function failure(e: unknown): { success: false; error: string } {
  return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
}

async function selectCard(
  supabase: SupabaseClient,
  orgId: string,
  cardId: string
): Promise<ServiceResult<KanbanBoardCard>> {
  const { data, error } = await supabase
    .from("planning_tasks")
    .select(TASK_CARD_FIELDS)
    .eq("organization_id", orgId)
    .eq("id", cardId)
    .single();
  if (error) return { success: false, error: error.message };
  return { success: true, data: mapCard(data) };
}

interface MoveRpcResult {
  from_board_id: string | null;
  from_column_id: string | null;
  from_inbox: boolean;
  from_status: KanbanTaskStatus;
  board_id: string | null;
  column_id: string | null;
  is_inbox: boolean;
  status: KanbanTaskStatus;
  position: number;
}

export const KanbanBoardsService = {
  async recordCardActivity(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string | null,
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
      return failure(e);
    }
  },

  /** Open boards this user can see (archived ones are listed separately). */
  async listBoards(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    options: { archived?: boolean } = {}
  ): Promise<ServiceResult<KanbanBoardSummary[]>> {
    try {
      // RLS returns exactly the boards this user can see (own, shared with
      // them, their branch's, the organization's).
      let query = supabase
        .from("planning_kanban_boards")
        .select(BOARD_FIELDS)
        .eq("organization_id", orgId)
        .is("deleted_at", null);
      query = options.archived
        ? query.not("archived_at", "is", null).order("archived_at", { ascending: false })
        : query.is("archived_at", null).order("updated_at", { ascending: false });

      const [{ data, error }, memberRoles] = await Promise.all([
        query,
        myMemberRoles(supabase, orgId, userId),
      ]);

      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: (data ?? []).map((row) => mapBoard(row, userId, memberRoles)),
      };
    } catch (e) {
      return failure(e);
    }
  },

  /** A board with its open columns and the tasks in them (archived board included, read-only in the UI). */
  async getBoard(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    userId?: string
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: boardRaw, error: boardError } = await supabase
        .from("planning_kanban_boards")
        .select(BOARD_FIELDS)
        .eq("organization_id", orgId)
        .eq("id", boardId)
        .is("deleted_at", null)
        .single();

      if (boardError) return { success: false, error: boardError.message };

      const [columnsResult, cardsResult, membersResult] = await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .select(COLUMN_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .is("deleted_at", null)
          .is("archived_at", null)
          .order("position", { ascending: true }),
        supabase
          .from("planning_tasks")
          .select(TASK_CARD_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .not("column_id", "is", null)
          .is("deleted_at", null)
          .order("board_position", { ascending: true })
          .order("created_at", { ascending: true }),
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
      if (membersResult.error) return { success: false, error: membersResult.error.message };

      const members = (membersResult.data ?? []).map(mapMember);
      const memberRoles = new Map<string, KanbanMemberRole>(
        userId ? members.filter((m) => m.user_id === userId).map((m) => [boardId, m.role]) : []
      );
      const columns = (columnsResult.data ?? []).map(mapColumn);
      // Tasks of an archived column stay in it, out of sight, until it comes back.
      const openColumnIds = new Set(columns.map((column) => column.id));

      return {
        success: true,
        data: {
          ...mapBoard(boardRaw, userId, memberRoles),
          columns,
          cards: (cardsResult.data ?? [])
            .map(mapCard)
            .filter((card) => openColumnIds.has(card.column_id)),
          members,
        },
      };
    } catch (e) {
      return failure(e);
    }
  },

  async createBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      // The limit counts open boards: archiving one frees a place.
      const { count, error: countError } = await supabase
        .from("planning_kanban_boards")
        .select("id", { count: "exact", head: true })
        .eq("organization_id", orgId)
        .eq("created_by", userId)
        .is("deleted_at", null)
        .is("archived_at", null);

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
      return failure(e);
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
      return failure(e);
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
      return failure(e);
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
      return failure(e);
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
      return failure(e);
    }
  },

  // ── Archive ───────────────────────────────────────────────────────────────

  /**
   * Archives (or restores) a board. Its columns and tasks are left as they
   * are and come back with it; the database lets only the owner or someone
   * with planning.boards.delete do this.
   */
  async setBoardArchived(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string,
    archived: boolean
  ): Promise<ServiceResult<KanbanBoardSummary>> {
    try {
      const { data, error } = await supabase
        .from("planning_kanban_boards")
        .update({ archived_at: archived ? new Date().toISOString() : null, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("id", boardId)
        .is("deleted_at", null)
        .select(BOARD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      const memberRoles = await myMemberRoles(supabase, orgId, userId);
      return { success: true, data: mapBoard(data, userId, memberRoles) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Deletes an archived board for good. Its tasks leave the board and stay in the task list. */
  async deleteBoard(supabase: SupabaseClient, boardId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc("planning_delete_board", { p_board_id: boardId });
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /** Archived columns (with how many tasks wait in each) and archived tasks of a board. */
  async getBoardArchive(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string
  ): Promise<ServiceResult<KanbanBoardArchive>> {
    try {
      const [columnsResult, cardsResult] = await Promise.all([
        supabase
          .from("planning_kanban_columns")
          .select(COLUMN_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .is("deleted_at", null)
          .not("archived_at", "is", null)
          .order("archived_at", { ascending: false }),
        supabase
          .from("planning_tasks")
          .select(TASK_CARD_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", boardId)
          .not("deleted_at", "is", null)
          .order("deleted_at", { ascending: false })
          .limit(200),
      ]);
      if (columnsResult.error) return { success: false, error: columnsResult.error.message };
      if (cardsResult.error) return { success: false, error: cardsResult.error.message };

      const columns = (columnsResult.data ?? []).map(mapColumn);
      const counts = new Map<string, number>();
      if (columns.length) {
        const { data: countRows, error: countError } = await supabase
          .from("planning_tasks")
          .select("column_id")
          .eq("organization_id", orgId)
          .in(
            "column_id",
            columns.map((column) => column.id)
          )
          .is("deleted_at", null);
        if (countError) return { success: false, error: countError.message };
        for (const row of (countRows ?? []) as Array<{ column_id: string }>) {
          counts.set(row.column_id, (counts.get(row.column_id) ?? 0) + 1);
        }
      }

      return {
        success: true,
        data: {
          columns: columns.map((column) => ({
            ...column,
            card_count: counts.get(column.id) ?? 0,
          })),
          cards: (cardsResult.data ?? []).map(mapCard),
        },
      };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Columns ───────────────────────────────────────────────────────────────

  async createColumn(
    supabase: SupabaseClient,
    orgId: string,
    _userId: string,
    input: CreateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardColumn>> {
    try {
      const position = await nextColumnPosition(supabase, input.board_id);
      const { data, error } = await supabase
        .from("planning_kanban_columns")
        .insert({
          board_id: input.board_id,
          organization_id: orgId,
          title: input.title,
          description: input.description || null,
          color: input.color || null,
          status_category: input.status_category ?? null,
          position,
        })
        .select(COLUMN_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapColumn(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async updateColumn(
    supabase: SupabaseClient,
    orgId: string,
    _userId: string,
    input: UpdateKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardColumn>> {
    try {
      const { data, error } = await supabase
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
        .is("deleted_at", null)
        .select(COLUMN_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapColumn(data) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Archives (or restores) a column. Its tasks stay in it and come back with it. */
  async setColumnArchived(
    supabase: SupabaseClient,
    orgId: string,
    input: KanbanColumnRefInput,
    archived: boolean
  ): Promise<ServiceResult<KanbanBoardColumn>> {
    try {
      const { data, error } = await supabase
        .from("planning_kanban_columns")
        .update({ archived_at: archived ? new Date().toISOString() : null })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .is("deleted_at", null)
        .select(COLUMN_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapColumn(data) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Deletes an archived column for good. Its tasks leave the board and stay in the task list. */
  async deleteColumn(supabase: SupabaseClient, columnId: string): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc("planning_delete_board_column", {
        p_column_id: columnId,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  async reorderColumns(
    supabase: SupabaseClient,
    input: ReorderKanbanColumnsInput
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.rpc("planning_reorder_board_columns", {
        p_board_id: input.board_id,
        p_column_ids: input.column_ids,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Cards (tasks) ─────────────────────────────────────────────────────────

  async createCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const position = await nextTaskPosition(supabase, input.column_id);
      // The board trigger sets the status from the column (when it has one).
      const { data, error } = await supabase
        .from("planning_tasks")
        .insert({
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
        })
        .select(TASK_CARD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      const card = mapCard(data);
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        card.id,
        userId,
        "task_created"
      );
      return { success: true, data: card };
    } catch (e) {
      return failure(e);
    }
  },

  /** Saves a card's fields; works for a task on a board and for one in the inbox. */
  async updateCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      let currentQuery = supabase
        .from("planning_tasks")
        .select("id, board_id, column_id, status, assigned_to")
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null);
      currentQuery = input.board_id
        ? currentQuery.eq("board_id", input.board_id)
        : currentQuery.is("board_id", null);
      const { data: currentRaw, error: currentError } = await currentQuery.single();
      if (currentError) return { success: false, error: currentError.message };
      const current = currentRaw as {
        board_id: string | null;
        column_id: string | null;
        status: KanbanTaskStatus;
        assigned_to: string | null;
      };

      const columnChanged =
        Boolean(input.board_id) &&
        Boolean(input.column_id) &&
        input.column_id !== current.column_id;
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
      if (columnChanged && input.column_id) {
        update.column_id = input.column_id;
        update.board_position = await nextTaskPosition(supabase, input.column_id);
      }
      if (statusChanged && !columnChanged) update.status = input.status;
      if (assigneeChanged) update.assigned_to = input.assigned_to;

      const { data: updatedRaw, error } = await supabase
        .from("planning_tasks")
        .update(update)
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null)
        .select(TASK_CARD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };

      const card = mapCard(updatedRaw);
      const boardId = current.board_id;
      if (columnChanged) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.id,
          userId,
          "card_moved",
          { from_column_id: current.column_id, to_column_id: input.column_id }
        );
      }
      if (card.status !== current.status) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.id,
          userId,
          statusActivityType(current.status, card.status),
          { from: current.status, to: card.status }
        );
      }
      if (assigneeChanged) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.id,
          userId,
          input.assigned_to ? "assigned" : "unassigned",
          { from: current.assigned_to, to: input.assigned_to ?? null }
        );
      }
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        boardId,
        input.id,
        userId,
        "card_updated"
      );
      return { success: true, data: card };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * Moves a task to a board column or to the inbox in one database call
   * (planning_move_task: one transaction, destination locked). Returns where
   * the task ended up, including the status a status column gave it.
   */
  async moveTask(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: MoveKanbanTaskInput
  ): Promise<ServiceResult<KanbanMoveResult>> {
    try {
      const { data, error } = await supabase.rpc("planning_move_task", {
        p_task_id: input.card_id,
        p_board_id: input.board_id,
        p_column_id: input.column_id,
        p_position: input.position,
      });
      if (error) return { success: false, error: error.message };
      const moved = data as MoveRpcResult;

      const boardId = moved.board_id ?? moved.from_board_id;
      if (moved.from_inbox && !moved.is_inbox) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.card_id,
          userId,
          "card_moved_from_inbox",
          { to_column_id: moved.column_id }
        );
      } else if (!moved.from_inbox && moved.is_inbox) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.card_id,
          userId,
          "card_moved_to_inbox",
          { from_column_id: moved.from_column_id }
        );
      } else if (moved.from_column_id !== moved.column_id) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.card_id,
          userId,
          "card_moved",
          { from_column_id: moved.from_column_id, to_column_id: moved.column_id }
        );
      }
      if (moved.status !== moved.from_status) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          input.card_id,
          userId,
          statusActivityType(moved.from_status, moved.status),
          { from: moved.from_status, to: moved.status }
        );
      }

      return {
        success: true,
        data: {
          card_id: input.card_id,
          board_id: moved.board_id,
          column_id: moved.column_id,
          is_inbox: moved.is_inbox,
          status: moved.status,
          position: moved.position,
        },
      };
    } catch (e) {
      return failure(e);
    }
  },

  async listInboxCards(
    supabase: SupabaseClient,
    orgId: string,
    userId: string
  ): Promise<ServiceResult<KanbanBoardCard[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .select(TASK_CARD_FIELDS)
        .eq("organization_id", orgId)
        .eq("created_by", userId)
        .eq("is_inbox", true)
        .is("deleted_at", null)
        .order("board_position", { ascending: true })
        .order("updated_at", { ascending: false });

      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapCard) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Archives a task (the same archive the task list uses). */
  async archiveCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    cardId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .update({ deleted_at: new Date().toISOString(), updated_by: userId })
        .eq("organization_id", orgId)
        .eq("id", cardId)
        .is("deleted_at", null)
        .select("board_id")
        .single();
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        (data as { board_id: string | null }).board_id,
        cardId,
        userId,
        "archived"
      );
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * Brings an archived task back. If its column was archived or deleted in
   * the meantime it goes to the board's first open column, and if the board
   * is gone it comes back as a task without a board.
   */
  async restoreCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    cardId: string
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: taskRaw, error: taskError } = await supabase
        .from("planning_tasks")
        .select("id, board_id, column_id, is_inbox")
        .eq("organization_id", orgId)
        .eq("id", cardId)
        .not("deleted_at", "is", null)
        .single();
      if (taskError) return { success: false, error: taskError.message };
      const task = taskRaw as {
        board_id: string | null;
        column_id: string | null;
        is_inbox: boolean;
      };

      const update: Record<string, unknown> = { deleted_at: null, updated_by: userId };
      if (task.board_id) {
        const { data: columnsRaw, error: columnsError } = await supabase
          .from("planning_kanban_columns")
          .select("id")
          .eq("organization_id", orgId)
          .eq("board_id", task.board_id)
          .is("deleted_at", null)
          .is("archived_at", null)
          .order("position", { ascending: true });
        if (columnsError) return { success: false, error: columnsError.message };
        const openColumnIds = ((columnsRaw ?? []) as Array<{ id: string }>).map((c) => c.id);
        if (!task.column_id || !openColumnIds.includes(task.column_id)) {
          const firstColumn = openColumnIds[0];
          if (firstColumn) {
            update.column_id = firstColumn;
            update.board_position = await nextTaskPosition(supabase, firstColumn);
          } else {
            update.board_id = null;
            update.column_id = null;
          }
        }
      }

      const { error } = await supabase
        .from("planning_tasks")
        .update(update)
        .eq("organization_id", orgId)
        .eq("id", cardId);
      if (error) return { success: false, error: error.message };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        task.board_id,
        cardId,
        userId,
        "restored"
      );
      return selectCard(supabase, orgId, cardId);
    } catch (e) {
      return failure(e);
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

      const { data: scheduledData, error: scheduledError } =
        await scheduledQuery(CALENDAR_CARD_FIELDS);
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

        const { data: unscheduledData, error: unscheduledError } =
          await unscheduledQuery(CALENDAR_CARD_FIELDS);
        if (unscheduledError) return { success: false, error: unscheduledError.message };
        const rows = (unscheduledData ?? []) as unknown as CardCalendarRow[];
        hasMoreUnscheduled = rows.length > params.unscheduledLimit;
        unscheduled = rows.slice(0, params.unscheduledLimit);
      }

      return {
        success: true,
        data: {
          scheduled: (scheduledData ?? []) as unknown as CardCalendarRow[],
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
