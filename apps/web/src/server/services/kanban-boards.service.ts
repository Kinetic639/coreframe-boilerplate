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
  PatchKanbanTaskInput,
  CreateKanbanBoardLabelInput,
  UpdateKanbanBoardLabelInput,
  CreateKanbanChecklistItemInput,
  UpdateKanbanChecklistItemInput,
  KanbanTaskDatesInput,
  CopyKanbanCardInput,
  CopyKanbanColumnInput,
  CopyKanbanBoardInput,
  CreateKanbanSubtaskInput,
  KanbanDependencyInput,
  SearchKanbanTasksInput,
  CreateKanbanCustomFieldInput,
  UpdateKanbanCustomFieldInput,
  DeleteKanbanCustomFieldInput,
  SetKanbanCustomFieldValueInput,
} from "@/lib/validations/kanban";
import { normalizeCommentRichText } from "@/lib/validations/comments";
import {
  MAX_KANBAN_BOARDS_PER_USER,
  type KanbanBoardAccess,
  type KanbanBoardActivity,
  type KanbanBoardArchive,
  type KanbanBoardLabel,
  type KanbanBoardMember,
  type KanbanChecklist,
  type KanbanChecklistItem,
  type KanbanCardActivity,
  type KanbanBoardCard,
  type KanbanBoardColumn,
  type KanbanBoardDetail,
  type KanbanBoardSummary,
  type KanbanMoveResult,
  type KanbanTaskEditorData,
  type KanbanTaskRef,
  type KanbanTaskRelations,
  type KanbanTaskStatus,
  type KanbanCustomField,
  type KanbanCustomFieldValue,
  type KanbanRecurrence,
} from "@/lib/types/kanban";

const TASK_REF_FIELDS = `id, task_number, title, status, board_id,
  assignee:users!assigned_to(first_name, last_name, email)`;

function mapTaskRef(row: any): KanbanTaskRef {
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  return {
    id: row.id,
    task_number: row.task_number,
    title: row.title,
    status: row.status as KanbanTaskStatus,
    board_id: row.board_id ?? null,
    assignee_name: assignee
      ? displayName(assignee.first_name, assignee.last_name, assignee.email)
      : null,
  };
}

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

const BOARD_FIELDS = `id, organization_id, title, description, color, visibility, branch_id, created_by, created_at, updated_at, archived_at, is_template,
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

/** The boards this user starred. */
async function myStars(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | undefined
): Promise<Set<string>> {
  if (!userId) return new Set();
  const { data } = await supabase
    .from("planning_kanban_board_stars")
    .select("board_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId);
  return new Set(((data ?? []) as Array<{ board_id: string }>).map((row) => row.board_id));
}

/**
 * What a card shows besides its row: how many comments and files it has, and
 * a short-lived link to its cover image. One query per 200 tasks each.
 */
async function withCardExtras(
  supabase: SupabaseClient,
  orgId: string,
  cards: KanbanBoardCard[]
): Promise<KanbanBoardCard[]> {
  if (!cards.length) return cards;
  const comments = new Map<string, number>();
  const files = new Map<string, number>();
  const subtasks = new Map<string, { total: number; done: number }>();
  const blocked = new Map<string, number>();
  const coverPaths = new Map<string, string>();
  const ids = cards.map((card) => card.id);
  const coverIds = new Set(
    cards.map((card) => card.cover_attachment_id).filter((id): id is string => Boolean(id))
  );
  // Chunked: a long id list would not fit in one request URL.
  for (let start = 0; start < ids.length; start += 200) {
    const chunk = ids.slice(start, start + 200);
    const [commentRows, fileRows, childRows, dependencyRows] = await Promise.all([
      supabase
        .from("app_comments")
        .select("target_id")
        .eq("org_id", orgId)
        .eq("target_type", "planning.task")
        .in("target_id", chunk)
        .is("deleted_at", null),
      supabase
        .from("app_attachments")
        .select("id, target_id, storage_path, content_type")
        .eq("org_id", orgId)
        .eq("target_type", "planning.task")
        .in("target_id", chunk)
        .is("deleted_at", null),
      supabase
        .from("planning_tasks")
        .select("parent_task_id, status")
        .eq("organization_id", orgId)
        .in("parent_task_id", chunk)
        .is("deleted_at", null),
      supabase
        .from("planning_task_dependencies")
        .select("task_id, blocker:planning_tasks!depends_on_task_id(status, deleted_at)")
        .eq("organization_id", orgId)
        .in("task_id", chunk),
    ]);
    for (const row of (childRows.data ?? []) as Array<{ parent_task_id: string; status: string }>) {
      const entry = subtasks.get(row.parent_task_id) ?? { total: 0, done: 0 };
      entry.total += 1;
      if (row.status === "completed" || row.status === "cancelled") entry.done += 1;
      subtasks.set(row.parent_task_id, entry);
    }
    for (const row of (dependencyRows.data ?? []) as Array<{ task_id: string; blocker: any }>) {
      const blocker = Array.isArray(row.blocker) ? row.blocker[0] : row.blocker;
      if (!blocker || blocker.deleted_at) continue;
      if (blocker.status === "completed" || blocker.status === "cancelled") continue;
      blocked.set(row.task_id, (blocked.get(row.task_id) ?? 0) + 1);
    }
    for (const row of (commentRows.data ?? []) as Array<{ target_id: string }>) {
      comments.set(row.target_id, (comments.get(row.target_id) ?? 0) + 1);
    }
    for (const row of (fileRows.data ?? []) as Array<{
      id: string;
      target_id: string;
      storage_path: string;
      content_type: string;
    }>) {
      files.set(row.target_id, (files.get(row.target_id) ?? 0) + 1);
      if (coverIds.has(row.id) && row.content_type.startsWith("image/")) {
        coverPaths.set(row.id, row.storage_path);
      }
    }
  }
  const coverUrls = new Map<string, string>();
  if (coverPaths.size) {
    const entries = [...coverPaths.entries()];
    const { data } = await supabase.storage.from("app-attachments").createSignedUrls(
      entries.map(([, path]) => path),
      60 * 60
    );
    (data ?? []).forEach((signed, index) => {
      if (signed?.signedUrl) coverUrls.set(entries[index][0], signed.signedUrl);
    });
  }
  return cards.map((card) => ({
    ...card,
    comment_count: comments.get(card.id) ?? 0,
    attachment_count: files.get(card.id) ?? 0,
    subtask_total: subtasks.get(card.id)?.total ?? 0,
    subtask_done: subtasks.get(card.id)?.done ?? 0,
    blocked_by_open: blocked.get(card.id) ?? 0,
    cover_url: card.cover_attachment_id ? (coverUrls.get(card.cover_attachment_id) ?? null) : null,
  }));
}

async function boardLabels(
  supabase: SupabaseClient,
  orgId: string,
  boardId: string
): Promise<KanbanBoardLabel[]> {
  const { data } = await supabase
    .from("planning_kanban_board_labels")
    .select(LABEL_FIELDS)
    .eq("organization_id", orgId)
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapLabel);
}

function mapBoard(
  row: any,
  userId?: string,
  memberRoles: Map<string, KanbanMemberRole> = new Map(),
  stars: Set<string> = new Set()
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
    starred: stars.has(row.id),
    is_template: Boolean(row.is_template),
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
    wip_limit: row.wip_limit ?? null,
    position: row.position ?? 0,
    archived_at: row.archived_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

const CALENDAR_CARD_FIELDS =
  "id, board_id, title, due_date, calendar_all_day, calendar_start_date, calendar_end_date, calendar_start_at, calendar_end_at, calendar_timezone, label, label_color, is_inbox";

const COLUMN_FIELDS =
  "id, board_id, organization_id, title, description, color, status_category, wip_limit, position, archived_at, created_at, updated_at";

// Every card is a planning_tasks row.
const TASK_CARD_FIELDS = `id, board_id, column_id, organization_id, task_number, title, description_plain, description_rich,
  status, priority, assigned_to, due_at, due_has_time, label, label_color, is_inbox, board_position, created_by, created_at, updated_at, deleted_at,
  calendar_all_day, calendar_start_date, calendar_start_at, cover_color, cover_attachment_id, is_template, parent_task_id, recurrence,
  field_values:planning_task_custom_field_values(field_id, value),
  creator:users!created_by(first_name, last_name, email),
  assignee:users!assigned_to(first_name, last_name, email),
  task_labels:planning_task_labels(label:planning_kanban_board_labels(id, name, color, position)),
  checklist_items:planning_task_checklist_items(is_done),
  watchers:planning_task_watchers(user_id)`;

const LABEL_FIELDS = "id, name, color, position";

function mapLabel(row: any): KanbanBoardLabel {
  return { id: row.id, name: row.name ?? "", color: row.color, position: row.position ?? 0 };
}

const CHECKLIST_ITEM_FIELDS = `id, checklist_id, task_id, title, is_done, assigned_to, due_at, position,
  assignee:users!assigned_to(first_name, last_name, email)`;

function mapChecklistItem(row: any): KanbanChecklistItem {
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  return {
    id: row.id,
    checklist_id: row.checklist_id,
    task_id: row.task_id,
    title: row.title,
    is_done: Boolean(row.is_done),
    assigned_to: row.assigned_to ?? null,
    assignee_name: assignee
      ? displayName(assignee.first_name, assignee.last_name, assignee.email)
      : null,
    due_at: row.due_at ?? null,
    position: row.position ?? 0,
  };
}

/** The day a moment falls on in a time zone (YYYY-MM-DD). */
function dayIn(iso: string, timeZone: string): string {
  try {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(new Date(iso));
  } catch {
    return iso.slice(0, 10);
  }
}

/**
 * The columns behind a task's start and due dates. The due moment goes to
 * due_at (a plain day at 12:00 UTC) and its day to due_date; a start day
 * makes an all-day calendar range from start to due. Without a start the
 * calendar shows the task on its due day.
 */
export function datesUpdate(dates: KanbanTaskDatesInput): Record<string, unknown> {
  const dueAt = dates.due_at ?? null;
  const hasTime = Boolean(dueAt) && dates.due_has_time;
  const dueDay = dueAt ? (hasTime ? dayIn(dueAt, dates.timezone) : dueAt.slice(0, 10)) : null;
  const update: Record<string, unknown> = {
    due_at: dueAt,
    due_has_time: hasTime,
    due_date: dueDay,
  };
  if (dates.start_date) {
    const end = dueDay && dueDay >= dates.start_date ? dueDay : dates.start_date;
    Object.assign(update, {
      calendar_all_day: true,
      calendar_start_date: dates.start_date,
      calendar_end_date: end,
      calendar_start_at: null,
      calendar_end_at: null,
      calendar_timezone: dates.timezone,
    });
  } else {
    Object.assign(update, {
      calendar_all_day: null,
      calendar_start_date: null,
      calendar_end_date: null,
      calendar_start_at: null,
      calendar_end_at: null,
      calendar_timezone: null,
    });
  }
  return update;
}

/** The start day of a task: the first day of its calendar range, if it has one. */
function startDateOf(row: any): string | null {
  if (row.calendar_all_day === true) return row.calendar_start_date ?? null;
  if (row.calendar_all_day === false && row.calendar_start_at) {
    return String(row.calendar_start_at).slice(0, 10);
  }
  return null;
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
    archived_at: row.deleted_at ?? null,
    comment_count: row.comment_count ?? 0,
    labels: ((row.task_labels ?? []) as Array<{ label: any }>)
      .map((link) => (Array.isArray(link.label) ? link.label[0] : link.label))
      .filter(Boolean)
      .map(mapLabel)
      .sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)),
    checklist_total: (row.checklist_items ?? []).length,
    checklist_done: ((row.checklist_items ?? []) as Array<{ is_done: boolean }>).filter(
      (item) => item.is_done
    ).length,
    attachment_count: row.attachment_count ?? 0,
    watcher_ids: ((row.watchers ?? []) as Array<{ user_id: string }>).map((w) => w.user_id),
    due_has_time: Boolean(row.due_has_time),
    start_date: startDateOf(row),
    cover_color: row.cover_color ?? null,
    cover_attachment_id: row.cover_attachment_id ?? null,
    cover_url: row.cover_url ?? null,
    is_template: Boolean(row.is_template),
    parent_task_id: row.parent_task_id ?? null,
    subtask_total: 0,
    subtask_done: 0,
    blocked_by_open: 0,
    recurrence: (row.recurrence ?? null) as KanbanRecurrence | null,
    custom_values: Object.fromEntries(
      ((row.field_values ?? []) as Array<{ field_id: string; value: KanbanCustomFieldValue }>).map(
        (entry) => [entry.field_id, entry.value]
      )
    ),
  };
}

const CUSTOM_FIELD_FIELDS = "id, board_id, name, field_type, options, show_on_card, position";

function mapCustomField(row: any): KanbanCustomField {
  return {
    id: row.id,
    board_id: row.board_id,
    name: row.name,
    field_type: row.field_type,
    options: Array.isArray(row.options) ? row.options : [],
    show_on_card: Boolean(row.show_on_card),
    position: row.position ?? 0,
  };
}

async function boardCustomFields(
  supabase: SupabaseClient,
  orgId: string,
  boardId: string
): Promise<KanbanCustomField[]> {
  const { data } = await supabase
    .from("planning_board_custom_fields")
    .select(CUSTOM_FIELD_FIELDS)
    .eq("organization_id", orgId)
    .eq("board_id", boardId)
    .order("position", { ascending: true })
    .order("created_at", { ascending: true });
  return (data ?? []).map(mapCustomField);
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

      const [{ data, error }, memberRoles, stars] = await Promise.all([
        query,
        myMemberRoles(supabase, orgId, userId),
        myStars(supabase, orgId, userId),
      ]);

      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: (data ?? []).map((row) => mapBoard(row, userId, memberRoles, stars)),
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

      const [columnsResult, cardsResult, membersResult, stars, labels, customFields] =
        await Promise.all([
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
          myStars(supabase, orgId, userId),
          boardLabels(supabase, orgId, boardId),
          boardCustomFields(supabase, orgId, boardId),
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
      const cards = await withCardExtras(
        supabase,
        orgId,
        (cardsResult.data ?? []).map(mapCard).filter((card) => openColumnIds.has(card.column_id))
      );

      return {
        success: true,
        data: {
          ...mapBoard(boardRaw, userId, memberRoles, stars),
          columns,
          labels,
          cards,
          members,
          custom_fields: customFields,
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

      let boardId: string;
      if (input.template_id) {
        // From a template: the copy (labels, lists, cards) is made private,
        // then gets what was filled in here.
        const { data: newId, error: copyError } = await supabase.rpc("planning_copy_board", {
          p_board_id: input.template_id,
          p_title: input.title,
          p_with_cards: true,
          p_as_template: false,
        });
        if (copyError) return { success: false, error: copyError.message };
        boardId = newId as string;
        const patch: Record<string, unknown> = {
          visibility: input.visibility,
          branch_id: input.visibility === "branch" ? (input.branch_id ?? null) : null,
          updated_by: userId,
        };
        if (input.description) patch.description = input.description;
        if (input.color) patch.color = input.color;
        const { error: setupError } = await supabase
          .from("planning_kanban_boards")
          .update(patch)
          .eq("organization_id", orgId)
          .eq("id", boardId);
        if (setupError) return { success: false, error: setupError.message };
      } else {
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
        boardId = (data as any).id as string;
      }

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
      if (input.is_template !== undefined) {
        updatePayload.is_template = input.is_template;
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
      const [memberRoles, stars] = await Promise.all([
        myMemberRoles(supabase, orgId, userId),
        myStars(supabase, orgId, userId),
      ]);
      return { success: true, data: mapBoard(data, userId, memberRoles, stars) };
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
          wip_limit: input.wip_limit ?? null,
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
          ...(input.wip_limit !== undefined ? { wip_limit: input.wip_limit } : {}),
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
      let card = mapCard(data);
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        input.board_id,
        card.id,
        userId,
        "task_created"
      );
      if (input.position !== undefined && input.position < position) {
        // "Add to the top": the move renumbers the column in one transaction.
        const { data: moved, error: moveError } = await supabase.rpc("planning_move_task", {
          p_task_id: card.id,
          p_board_id: input.board_id,
          p_column_id: input.column_id,
          p_position: input.position,
        });
        if (!moveError && moved) {
          card = { ...card, position: (moved as MoveRpcResult).position };
        }
      }
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
  /** Stars or unstars a board for the current user (their favourites). */
  async setBoardStar(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string,
    starred: boolean
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = starred
        ? await supabase
            .from("planning_kanban_board_stars")
            .upsert(
              { user_id: userId, board_id: boardId, organization_id: orgId },
              { onConflict: "user_id,board_id", ignoreDuplicates: true }
            )
        : await supabase
            .from("planning_kanban_board_stars")
            .delete()
            .eq("user_id", userId)
            .eq("board_id", boardId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * A task as the task editor shows it, by id or by number (TSK-0042), with
   * its board and the board's open columns when it sits on one.
   */
  async getTaskEditor(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    ref: string
  ): Promise<ServiceResult<KanbanTaskEditorData>> {
    try {
      const byId = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(ref);
      const { data: row, error } = await supabase
        .from("planning_tasks")
        .select(TASK_CARD_FIELDS)
        .eq("organization_id", orgId)
        .eq(byId ? "id" : "task_number", byId ? ref : ref.toUpperCase())
        .maybeSingle();
      if (error) return { success: false, error: error.message };
      if (!row) return { success: false, error: "Task not found" };
      const [card] = await withCardExtras(supabase, orgId, [mapCard(row)]);

      if (!card.board_id) {
        return { success: true, data: { card, board: null, columns: [], labels: [] } };
      }

      const [boardResult, columnsResult, memberRoles, labels, customFields] = await Promise.all([
        supabase
          .from("planning_kanban_boards")
          .select("id, title, color, archived_at, created_by")
          .eq("organization_id", orgId)
          .eq("id", card.board_id)
          .is("deleted_at", null)
          .maybeSingle(),
        supabase
          .from("planning_kanban_columns")
          .select(COLUMN_FIELDS)
          .eq("organization_id", orgId)
          .eq("board_id", card.board_id)
          .is("deleted_at", null)
          .is("archived_at", null)
          .order("position", { ascending: true }),
        myMemberRoles(supabase, orgId, userId),
        boardLabels(supabase, orgId, card.board_id),
        boardCustomFields(supabase, orgId, card.board_id),
      ]);
      const boardRow = boardResult.data as {
        id: string;
        title: string;
        color: string | null;
        archived_at: string | null;
        created_by: string;
      } | null;
      // The board may be out of reach (not shared with this user): the task
      // still opens, without its board.
      if (!boardRow) return { success: true, data: { card, board: null, columns: [], labels: [] } };
      return {
        success: true,
        data: {
          card,
          board: {
            id: boardRow.id,
            title: boardRow.title,
            color: boardRow.color ?? null,
            archived_at: boardRow.archived_at ?? null,
            my_access: boardAccess(boardRow, userId, memberRoles.get(boardRow.id)),
          },
          columns: (columnsResult.data ?? []).map(mapColumn),
          labels,
          custom_fields: customFields,
        },
      };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * Saves only the fields that came in (the task editor saves each field on
   * its own) and writes one history entry per real change.
   */
  async patchTask(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: PatchKanbanTaskInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: currentRaw, error: currentError } = await supabase
        .from("planning_tasks")
        .select(
          "id, board_id, status, assigned_to, title, priority, due_at, due_has_time, description_plain, description_rich, label, label_color, calendar_all_day, calendar_start_date, calendar_start_at, cover_color, cover_attachment_id"
        )
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null)
        .single();
      if (currentError) return { success: false, error: currentError.message };
      const current = currentRaw as {
        board_id: string | null;
        status: KanbanTaskStatus;
        assigned_to: string | null;
        title: string;
        priority: string;
        due_at: string | null;
        description_plain: string | null;
        description_rich: unknown;
        label: string | null;
        label_color: string | null;
        due_has_time: boolean;
        calendar_all_day: boolean | null;
        calendar_start_date: string | null;
        calendar_start_at: string | null;
        cover_color: string | null;
        cover_attachment_id: string | null;
      };

      const update: Record<string, unknown> = {};
      const history: Array<[string, Record<string, unknown>]> = [];

      if (input.title !== undefined && input.title !== current.title) {
        update.title = input.title;
        history.push(["title_changed", { from: current.title, to: input.title }]);
      }
      if (input.description !== undefined || input.description_rich !== undefined) {
        const plain = input.description ?? null;
        const rich =
          input.description_rich === undefined
            ? current.description_rich
            : (normalizeCommentRichText(input.description_rich) ?? null);
        if (
          plain !== (current.description_plain ?? null) ||
          JSON.stringify(rich ?? null) !== JSON.stringify(current.description_rich ?? null)
        ) {
          update.description_plain = plain || null;
          update.description_rich = rich ?? null;
          history.push(["description_changed", {}]);
        }
      }
      if (input.priority !== undefined && input.priority !== current.priority) {
        update.priority = input.priority;
        history.push(["priority_changed", { from: current.priority, to: input.priority }]);
      }
      if (input.due_at !== undefined && (input.due_at ?? null) !== (current.due_at ?? null)) {
        const dueAt = input.due_at ?? null;
        update.due_at = dueAt;
        update.due_has_time = false;
        // The calendar reads the day: keep it with the time.
        update.due_date = dueAt ? dueAt.slice(0, 10) : null;
        history.push(["due_date_changed", { due_at_from: current.due_at, due_at_to: dueAt }]);
      }
      if (
        (input.label !== undefined && (input.label || null) !== current.label) ||
        (input.label_color !== undefined && (input.label_color || null) !== current.label_color)
      ) {
        const label = input.label !== undefined ? input.label || null : current.label;
        update.label = label;
        update.label_color = label
          ? input.label_color !== undefined
            ? input.label_color || null
            : current.label_color
          : null;
        history.push(["card_updated", {}]);
      }
      if (input.dates) {
        const next = datesUpdate(input.dates);
        const currentStart = startDateOf(current);
        if (
          (next.due_at ?? null) !== (current.due_at ?? null) ||
          next.due_has_time !== Boolean(current.due_has_time) ||
          input.dates.start_date !== currentStart
        ) {
          if (input.dates.start_date === currentStart && current.calendar_all_day === false) {
            // A timed slot from the calendar stays as it is when only the due date moves.
            for (const key of Object.keys(next)) {
              if (key.startsWith("calendar_")) delete next[key];
            }
          }
          Object.assign(update, next);
          history.push([
            "due_date_changed",
            {
              due_at_from: current.due_at,
              due_at_to: next.due_at,
              start_from: currentStart,
              start_to: input.dates.start_date,
            },
          ]);
        }
      }
      if (
        (input.cover_color !== undefined && (input.cover_color ?? null) !== current.cover_color) ||
        (input.cover_attachment_id !== undefined &&
          (input.cover_attachment_id ?? null) !== current.cover_attachment_id)
      ) {
        if (input.cover_attachment_id) {
          // Only an image attached to this very task can be its cover.
          const { data: file } = await supabase
            .from("app_attachments")
            .select("id, content_type")
            .eq("org_id", orgId)
            .eq("target_type", "planning.task")
            .eq("target_id", input.id)
            .eq("id", input.cover_attachment_id)
            .is("deleted_at", null)
            .maybeSingle();
          if (
            !file ||
            !String((file as { content_type: string }).content_type).startsWith("image/")
          ) {
            return { success: false, error: "The cover must be an image attached to this task" };
          }
        }
        // One cover at a time: a colour or an image.
        update.cover_attachment_id =
          input.cover_attachment_id !== undefined
            ? (input.cover_attachment_id ?? null)
            : input.cover_color
              ? null
              : current.cover_attachment_id;
        update.cover_color =
          input.cover_color !== undefined
            ? (input.cover_color ?? null)
            : input.cover_attachment_id
              ? null
              : current.cover_color;
        history.push(["cover_changed", {}]);
      }
      if (input.status !== undefined && input.status !== current.status) {
        update.status = input.status;
      }
      if (input.is_template !== undefined) {
        update.is_template = input.is_template;
      }
      if (input.parent_task_id !== undefined) {
        // The database refuses another organization's task and any cycle.
        update.parent_task_id = input.parent_task_id;
        history.push(["parent_changed", { to: input.parent_task_id }]);
      }
      if (input.recurrence !== undefined) {
        // Shape checked again by the database.
        update.recurrence = input.recurrence;
        history.push(["recurrence_changed", { to: input.recurrence }]);
      }
      if (input.assigned_to !== undefined && input.assigned_to !== current.assigned_to) {
        update.assigned_to = input.assigned_to;
        history.push([
          input.assigned_to ? "assigned" : "unassigned",
          { from: current.assigned_to, to: input.assigned_to },
        ]);
      }

      if (!Object.keys(update).length) {
        const unchanged = await selectCard(supabase, orgId, input.id);
        if (!unchanged.success) return unchanged;
        const [card] = await withCardExtras(supabase, orgId, [unchanged.data]);
        return { success: true, data: card };
      }

      const { data: updatedRaw, error } = await supabase
        .from("planning_tasks")
        .update({ ...update, updated_by: userId })
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .is("deleted_at", null)
        .select(TASK_CARD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      const [card] = await withCardExtras(supabase, orgId, [mapCard(updatedRaw)]);

      // A status change may also move the task on its board (board trigger).
      if (card.status !== current.status) {
        history.push([
          statusActivityType(current.status, card.status),
          { from: current.status, to: card.status },
        ]);
      }
      for (const [type, metadata] of history) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          current.board_id,
          input.id,
          userId,
          type,
          metadata
        );
      }
      return { success: true, data: card };
    } catch (e) {
      return failure(e);
    }
  },

  /** Archives every task of a column at once (e.g. clearing "Done"). Returns their ids. */
  async archiveColumnCards(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    boardId: string,
    columnId: string
  ): Promise<ServiceResult<string[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .update({ deleted_at: new Date().toISOString(), updated_by: userId })
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("column_id", columnId)
        .is("deleted_at", null)
        .select("id");
      if (error) return { success: false, error: error.message };
      const ids = ((data ?? []) as Array<{ id: string }>).map((row) => row.id);
      if (ids.length) {
        await supabase.from("planning_task_activity").insert(
          ids.map((id) => ({
            organization_id: orgId,
            task_id: id,
            actor_id: userId,
            activity_type: "archived",
            metadata: { board_id: boardId, column_id: columnId },
          }))
        );
      }
      return { success: true, data: ids };
    } catch (e) {
      return failure(e);
    }
  },

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

  // ── Board labels ──────────────────────────────────────────────────────────

  async createBoardLabel(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanBoardLabelInput
  ): Promise<ServiceResult<KanbanBoardLabel>> {
    try {
      const { data: last } = await supabase
        .from("planning_kanban_board_labels")
        .select("position")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await supabase
        .from("planning_kanban_board_labels")
        .insert({
          organization_id: orgId,
          board_id: input.board_id,
          name: input.name ?? "",
          color: input.color,
          position: ((last as { position: number } | null)?.position ?? -1) + 1,
          created_by: userId,
        })
        .select(LABEL_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapLabel(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async updateBoardLabel(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateKanbanBoardLabelInput
  ): Promise<ServiceResult<KanbanBoardLabel>> {
    try {
      const { data, error } = await supabase
        .from("planning_kanban_board_labels")
        .update({
          name: input.name ?? "",
          color: input.color,
          updated_at: new Date().toISOString(),
        })
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .select(LABEL_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapLabel(data) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Deleting a label takes it off every task of the board. */
  async deleteBoardLabel(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    labelId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_kanban_board_labels")
        .delete()
        .eq("organization_id", orgId)
        .eq("board_id", boardId)
        .eq("id", labelId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /** Sets a task's labels to exactly these (labels of its own board). */
  async setTaskLabels(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    taskId: string,
    labelIds: string[]
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: task, error: taskError } = await supabase
        .from("planning_tasks")
        .select("id, board_id")
        .eq("organization_id", orgId)
        .eq("id", taskId)
        .is("deleted_at", null)
        .single();
      if (taskError) return { success: false, error: taskError.message };
      const boardId = (task as { board_id: string | null }).board_id;
      if (!boardId) return { success: false, error: "Only a task on a board has board labels" };

      const { data: currentRows, error: currentError } = await supabase
        .from("planning_task_labels")
        .select("label_id")
        .eq("task_id", taskId);
      if (currentError) return { success: false, error: currentError.message };
      const current = new Set(
        ((currentRows ?? []) as Array<{ label_id: string }>).map((row) => row.label_id)
      );
      const wanted = new Set(labelIds);
      const added = [...wanted].filter((id) => !current.has(id));
      const removed = [...current].filter((id) => !wanted.has(id));

      if (removed.length) {
        const { error } = await supabase
          .from("planning_task_labels")
          .delete()
          .eq("task_id", taskId)
          .in("label_id", removed);
        if (error) return { success: false, error: error.message };
      }
      if (added.length) {
        const { error } = await supabase
          .from("planning_task_labels")
          .insert(
            added.map((labelId) => ({ task_id: taskId, label_id: labelId, organization_id: orgId }))
          );
        if (error) return { success: false, error: error.message };
      }
      if (added.length || removed.length) {
        await KanbanBoardsService.recordCardActivity(
          supabase,
          orgId,
          boardId,
          taskId,
          userId,
          "labels_changed",
          { added, removed }
        );
      }
      const card = await selectCard(supabase, orgId, taskId);
      if (!card.success) return card;
      const [withExtras] = await withCardExtras(supabase, orgId, [card.data]);
      return { success: true, data: withExtras };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Checklists ────────────────────────────────────────────────────────────

  async listChecklists(
    supabase: SupabaseClient,
    orgId: string,
    taskId: string
  ): Promise<ServiceResult<KanbanChecklist[]>> {
    try {
      const [listsResult, itemsResult] = await Promise.all([
        supabase
          .from("planning_task_checklists")
          .select("id, task_id, title, position, created_at")
          .eq("organization_id", orgId)
          .eq("task_id", taskId)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
        supabase
          .from("planning_task_checklist_items")
          .select(
            `id, checklist_id, task_id, title, is_done, assigned_to, due_at, position, created_at,
             assignee:users!assigned_to(first_name, last_name, email)`
          )
          .eq("organization_id", orgId)
          .eq("task_id", taskId)
          .order("position", { ascending: true })
          .order("created_at", { ascending: true }),
      ]);
      if (listsResult.error) return { success: false, error: listsResult.error.message };
      if (itemsResult.error) return { success: false, error: itemsResult.error.message };
      const items = (itemsResult.data ?? []).map(mapChecklistItem);
      return {
        success: true,
        data: (listsResult.data ?? []).map((row: any) => ({
          id: row.id,
          task_id: row.task_id,
          title: row.title,
          position: row.position ?? 0,
          items: items.filter((item) => item.checklist_id === row.id),
        })),
      };
    } catch (e) {
      return failure(e);
    }
  },

  async createChecklist(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    taskId: string,
    title: string
  ): Promise<ServiceResult<KanbanChecklist>> {
    try {
      const { count } = await supabase
        .from("planning_task_checklists")
        .select("id", { count: "exact", head: true })
        .eq("task_id", taskId);
      const { data, error } = await supabase
        .from("planning_task_checklists")
        .insert({
          organization_id: orgId,
          task_id: taskId,
          title,
          position: count ?? 0,
          created_by: userId,
        })
        .select("id, task_id, title, position")
        .single();
      if (error) return { success: false, error: error.message };
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        null,
        taskId,
        userId,
        "checklist_added",
        { title }
      );
      const row = data as { id: string; task_id: string; title: string; position: number };
      return { success: true, data: { ...row, items: [] } };
    } catch (e) {
      return failure(e);
    }
  },

  async renameChecklist(
    supabase: SupabaseClient,
    orgId: string,
    checklistId: string,
    title: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_task_checklists")
        .update({ title })
        .eq("organization_id", orgId)
        .eq("id", checklistId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  async deleteChecklist(
    supabase: SupabaseClient,
    orgId: string,
    checklistId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_task_checklists")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", checklistId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  async addChecklistItem(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanChecklistItemInput
  ): Promise<ServiceResult<KanbanChecklistItem>> {
    try {
      const { data: last } = await supabase
        .from("planning_task_checklist_items")
        .select("position")
        .eq("checklist_id", input.checklist_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await supabase
        .from("planning_task_checklist_items")
        .insert({
          organization_id: orgId,
          checklist_id: input.checklist_id,
          task_id: input.task_id,
          title: input.title,
          position: ((last as { position: number } | null)?.position ?? -1) + 1,
          created_by: userId,
        })
        .select(CHECKLIST_ITEM_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapChecklistItem(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async updateChecklistItem(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateKanbanChecklistItemInput
  ): Promise<ServiceResult<KanbanChecklistItem>> {
    try {
      const update: Record<string, unknown> = {};
      if (input.title !== undefined) update.title = input.title;
      if (input.is_done !== undefined) {
        update.is_done = input.is_done;
        update.done_at = input.is_done ? new Date().toISOString() : null;
        update.done_by = input.is_done ? userId : null;
      }
      if (input.assigned_to !== undefined) update.assigned_to = input.assigned_to;
      if (input.due_at !== undefined) update.due_at = input.due_at;
      const { data, error } = await supabase
        .from("planning_task_checklist_items")
        .update(update)
        .eq("organization_id", orgId)
        .eq("id", input.id)
        .select(CHECKLIST_ITEM_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapChecklistItem(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async deleteChecklistItem(
    supabase: SupabaseClient,
    orgId: string,
    itemId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_task_checklist_items")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", itemId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * Turns a checklist item into a task of its own: on the same board column
   * (at the bottom) or, for a task outside a board, in the inbox. The item
   * goes away once the task exists.
   */
  async convertChecklistItem(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    itemId: string
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: itemRaw, error: itemError } = await supabase
        .from("planning_task_checklist_items")
        .select("id, title, assigned_to, due_at, task_id")
        .eq("organization_id", orgId)
        .eq("id", itemId)
        .single();
      if (itemError) return { success: false, error: itemError.message };
      const item = itemRaw as {
        title: string;
        assigned_to: string | null;
        due_at: string | null;
        task_id: string;
      };
      const { data: parentRaw, error: parentError } = await supabase
        .from("planning_tasks")
        .select("id, task_number, board_id, column_id, branch_id")
        .eq("organization_id", orgId)
        .eq("id", item.task_id)
        .single();
      if (parentError) return { success: false, error: parentError.message };
      const parent = parentRaw as {
        task_number: string;
        board_id: string | null;
        column_id: string | null;
        branch_id: string | null;
      };

      let created: ServiceResult<KanbanBoardCard>;
      if (parent.board_id && parent.column_id) {
        created = await KanbanBoardsService.createCard(supabase, orgId, userId, {
          board_id: parent.board_id,
          column_id: parent.column_id,
          title: item.title.slice(0, 300),
        });
      } else {
        const { data, error } = await supabase
          .from("planning_tasks")
          .insert({
            organization_id: orgId,
            branch_id: parent.branch_id,
            title: item.title.slice(0, 300),
            status: "open",
            priority: "normal",
            is_inbox: true,
            created_by: userId,
            updated_by: userId,
          })
          .select(TASK_CARD_FIELDS)
          .single();
        created = error
          ? { success: false, error: error.message }
          : { success: true, data: mapCard(data) };
      }
      if (!created.success) return created;

      if (item.assigned_to || item.due_at) {
        const patched = await KanbanBoardsService.patchTask(supabase, orgId, userId, {
          id: created.data.id,
          ...(item.assigned_to ? { assigned_to: item.assigned_to } : {}),
          ...(item.due_at ? { due_at: item.due_at } : {}),
        });
        if (patched.success) created = patched;
      }
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        parent.board_id,
        created.data.id,
        userId,
        "created_from_checklist",
        { from_task: parent.task_number }
      );
      await supabase
        .from("planning_task_checklist_items")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", itemId);
      return created;
    } catch (e) {
      return failure(e);
    }
  },

  // ── Copies and templates (stage 6a) ───────────────────────────────────────

  /** A copy of a card in a column (same or another board); returns the new card. */
  async copyCard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CopyKanbanCardInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: newId, error } = await supabase.rpc("planning_copy_task", {
        p_task_id: input.card_id,
        p_column_id: input.column_id,
        p_position: input.position ?? null,
        p_title: input.title || null,
        p_keep: input.keep ?? [],
        p_as_template: input.as_template ?? false,
      });
      if (error) return { success: false, error: error.message };
      const created = await selectCard(supabase, orgId, newId as string);
      if (!created.success) return created;
      const { data: source } = await supabase
        .from("planning_tasks")
        .select("task_number")
        .eq("organization_id", orgId)
        .eq("id", input.card_id)
        .maybeSingle();
      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        created.data.board_id || null,
        created.data.id,
        userId,
        "copied_from",
        { from_task: (source as { task_number?: string } | null)?.task_number ?? null }
      );
      const [card] = await withCardExtras(supabase, orgId, [created.data]);
      return { success: true, data: card };
    } catch (e) {
      return failure(e);
    }
  },

  /** A copy of a column with its cards; returns the board it landed on. */
  async copyColumn(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CopyKanbanColumnInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
      const { data: newId, error } = await supabase.rpc("planning_copy_column", {
        p_column_id: input.column_id,
        p_board_id: input.board_id ?? null,
        p_title: input.title || null,
      });
      if (error) return { success: false, error: error.message };
      const { data: column, error: columnError } = await supabase
        .from("planning_kanban_columns")
        .select("board_id")
        .eq("organization_id", orgId)
        .eq("id", newId as string)
        .single();
      if (columnError) return { success: false, error: columnError.message };
      return KanbanBoardsService.getBoard(
        supabase,
        orgId,
        (column as { board_id: string }).board_id,
        userId
      );
    } catch (e) {
      return failure(e);
    }
  },

  /** A new board from another (a copy, or one made from a template). */
  async copyBoard(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CopyKanbanBoardInput
  ): Promise<ServiceResult<KanbanBoardDetail>> {
    try {
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
      const { data: newId, error } = await supabase.rpc("planning_copy_board", {
        p_board_id: input.board_id,
        p_title: input.title,
        p_with_cards: input.with_cards ?? true,
        p_as_template: input.as_template ?? false,
      });
      if (error) return { success: false, error: error.message };
      return KanbanBoardsService.getBoard(supabase, orgId, newId as string, userId);
    } catch (e) {
      return failure(e);
    }
  },

  // ── Custom fields (stage 6b) ──────────────────────────────────────────────

  async createCustomField(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanCustomFieldInput
  ): Promise<ServiceResult<KanbanCustomField>> {
    try {
      const { data: last } = await supabase
        .from("planning_board_custom_fields")
        .select("position")
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .order("position", { ascending: false })
        .limit(1)
        .maybeSingle();
      const { data, error } = await supabase
        .from("planning_board_custom_fields")
        .insert({
          organization_id: orgId,
          board_id: input.board_id,
          name: input.name,
          field_type: input.field_type,
          options: input.field_type === "select" ? (input.options ?? []) : [],
          show_on_card: input.show_on_card ?? false,
          position: ((last as { position: number } | null)?.position ?? -1) + 1,
          created_by: userId,
        })
        .select(CUSTOM_FIELD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      return { success: true, data: mapCustomField(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async updateCustomField(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateKanbanCustomFieldInput
  ): Promise<ServiceResult<KanbanCustomField>> {
    try {
      const update: Record<string, unknown> = {};
      if (input.name !== undefined) update.name = input.name;
      if (input.options !== undefined) update.options = input.options;
      if (input.show_on_card !== undefined) update.show_on_card = input.show_on_card;
      if (input.position !== undefined) update.position = input.position;
      const { data, error } = await supabase
        .from("planning_board_custom_fields")
        .update(update)
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id)
        .select(CUSTOM_FIELD_FIELDS)
        .single();
      if (error) return { success: false, error: error.message };
      if (input.options !== undefined) {
        // A removed choice: the cards that had it are left empty.
        const ids = new Set(input.options.map((option) => option.id));
        const { data: values } = await supabase
          .from("planning_task_custom_field_values")
          .select("task_id, value")
          .eq("organization_id", orgId)
          .eq("field_id", input.id);
        const stale = ((values ?? []) as Array<{ task_id: string; value: unknown }>)
          .filter((row) => !ids.has(String(row.value)))
          .map((row) => row.task_id);
        if (stale.length) {
          await supabase
            .from("planning_task_custom_field_values")
            .delete()
            .eq("organization_id", orgId)
            .eq("field_id", input.id)
            .in("task_id", stale);
        }
      }
      return { success: true, data: mapCustomField(data) };
    } catch (e) {
      return failure(e);
    }
  },

  /** Removes a field and every card's value for it. */
  async deleteCustomField(
    supabase: SupabaseClient,
    orgId: string,
    input: DeleteKanbanCustomFieldInput
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_board_custom_fields")
        .delete()
        .eq("organization_id", orgId)
        .eq("board_id", input.board_id)
        .eq("id", input.id);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /** Sets (or clears, with null) a task's value for a field; returns the card. */
  async setCustomFieldValue(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: SetKanbanCustomFieldValueInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const empty = input.value === null || input.value === "";
      const { error } = empty
        ? await supabase
            .from("planning_task_custom_field_values")
            .delete()
            .eq("organization_id", orgId)
            .eq("task_id", input.task_id)
            .eq("field_id", input.field_id)
        : await supabase.from("planning_task_custom_field_values").upsert(
            {
              task_id: input.task_id,
              field_id: input.field_id,
              organization_id: orgId,
              value: input.value,
              updated_by: userId,
            },
            { onConflict: "task_id,field_id" }
          );
      if (error) return { success: false, error: error.message };
      const card = await selectCard(supabase, orgId, input.task_id);
      if (!card.success) return card;
      const [withExtras] = await withCardExtras(supabase, orgId, [card.data]);
      return { success: true, data: withExtras };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Sub-tasks and dependencies (stage 6a) ─────────────────────────────────

  /** A task's parent, sub-tasks, and what it waits for or holds up. */
  async getTaskRelations(
    supabase: SupabaseClient,
    orgId: string,
    taskId: string
  ): Promise<ServiceResult<KanbanTaskRelations>> {
    try {
      const { data: taskRaw, error: taskError } = await supabase
        .from("planning_tasks")
        .select("id, parent_task_id")
        .eq("organization_id", orgId)
        .eq("id", taskId)
        .single();
      if (taskError) return { success: false, error: taskError.message };
      const parentId = (taskRaw as { parent_task_id: string | null }).parent_task_id;

      const [parent, children, blockedBy, blocking] = await Promise.all([
        parentId
          ? supabase
              .from("planning_tasks")
              .select(TASK_REF_FIELDS)
              .eq("organization_id", orgId)
              .eq("id", parentId)
              .is("deleted_at", null)
              .maybeSingle()
          : Promise.resolve({ data: null, error: null }),
        supabase
          .from("planning_tasks")
          .select(TASK_REF_FIELDS)
          .eq("organization_id", orgId)
          .eq("parent_task_id", taskId)
          .is("deleted_at", null)
          .order("created_at", { ascending: true }),
        supabase
          .from("planning_task_dependencies")
          .select(`task:planning_tasks!depends_on_task_id(${TASK_REF_FIELDS}, deleted_at)`)
          .eq("organization_id", orgId)
          .eq("task_id", taskId),
        supabase
          .from("planning_task_dependencies")
          .select(`task:planning_tasks!task_id(${TASK_REF_FIELDS}, deleted_at)`)
          .eq("organization_id", orgId)
          .eq("depends_on_task_id", taskId),
      ]);
      if (children.error) return { success: false, error: children.error.message };
      if (blockedBy.error) return { success: false, error: blockedBy.error.message };
      if (blocking.error) return { success: false, error: blocking.error.message };

      const linked = (rows: any[] | null) =>
        (rows ?? [])
          .map((row) => (Array.isArray(row.task) ? row.task[0] : row.task))
          .filter((task) => task && !task.deleted_at)
          .map(mapTaskRef);

      return {
        success: true,
        data: {
          parent: parent.data ? mapTaskRef(parent.data) : null,
          subtasks: (children.data ?? []).map(mapTaskRef),
          blocked_by: linked(blockedBy.data),
          blocking: linked(blocking.data),
        },
      };
    } catch (e) {
      return failure(e);
    }
  },

  /**
   * A new sub-task: on the parent's board, in the parent's column (or in the
   * inbox when the parent is not on a board).
   */
  async createSubtask(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateKanbanSubtaskInput
  ): Promise<ServiceResult<KanbanBoardCard>> {
    try {
      const { data: parentRaw, error: parentError } = await supabase
        .from("planning_tasks")
        .select("id, task_number, board_id, column_id, branch_id")
        .eq("organization_id", orgId)
        .eq("id", input.parent_id)
        .is("deleted_at", null)
        .single();
      if (parentError) return { success: false, error: parentError.message };
      const parent = parentRaw as {
        task_number: string;
        board_id: string | null;
        column_id: string | null;
        branch_id: string | null;
      };
      const onBoard = Boolean(parent.board_id && parent.column_id);
      const position = onBoard ? await nextTaskPosition(supabase, parent.column_id!) : 0;
      const { data, error } = await supabase
        .from("planning_tasks")
        .insert({
          organization_id: orgId,
          branch_id: parent.branch_id,
          board_id: onBoard ? parent.board_id : null,
          column_id: onBoard ? parent.column_id : null,
          board_position: position,
          is_inbox: !onBoard,
          parent_task_id: input.parent_id,
          title: input.title,
          status: "open",
          priority: "normal",
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
        parent.board_id,
        card.id,
        userId,
        "task_created",
        { parent_task: parent.task_number }
      );
      return { success: true, data: card };
    } catch (e) {
      return failure(e);
    }
  },

  async addDependency(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: KanbanDependencyInput
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase.from("planning_task_dependencies").insert({
        organization_id: orgId,
        task_id: input.task_id,
        depends_on_task_id: input.depends_on_task_id,
        created_by: userId,
      });
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  async removeDependency(
    supabase: SupabaseClient,
    orgId: string,
    input: KanbanDependencyInput
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_task_dependencies")
        .delete()
        .eq("organization_id", orgId)
        .eq("task_id", input.task_id)
        .eq("depends_on_task_id", input.depends_on_task_id);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /** Tasks to link to (by number or words of the title), newest first. */
  async searchTasks(
    supabase: SupabaseClient,
    orgId: string,
    input: SearchKanbanTasksInput
  ): Promise<ServiceResult<KanbanTaskRef[]>> {
    try {
      let query = supabase
        .from("planning_tasks")
        .select(TASK_REF_FIELDS)
        .eq("organization_id", orgId)
        .is("deleted_at", null)
        .eq("is_template", false)
        .order("updated_at", { ascending: false })
        .limit(12);
      const text = input.query.replace(/[%_,()]/g, " ").trim();
      if (text) {
        query = query.or(`task_number.ilike.%${text}%,title.ilike.%${text}%`);
      }
      if (input.exclude_id) query = query.neq("id", input.exclude_id);
      const { data, error } = await query;
      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapTaskRef) };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Watchers ──────────────────────────────────────────────────────────────

  async setWatching(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    taskId: string,
    watching: boolean
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = watching
        ? await supabase
            .from("planning_task_watchers")
            .upsert(
              { task_id: taskId, user_id: userId, organization_id: orgId },
              { onConflict: "task_id,user_id", ignoreDuplicates: true }
            )
        : await supabase
            .from("planning_task_watchers")
            .delete()
            .eq("task_id", taskId)
            .eq("user_id", userId);
      if (error) return { success: false, error: error.message };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  // ── Board activity ────────────────────────────────────────────────────────

  /** The latest changes to the tasks of a board, newest first. */
  async listBoardActivity(
    supabase: SupabaseClient,
    orgId: string,
    boardId: string,
    limit = 60
  ): Promise<ServiceResult<KanbanBoardActivity[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_task_activity")
        .select(
          `id, organization_id, task_id, actor_id, activity_type, message, metadata, created_at,
           actor:users!actor_id(first_name, last_name, email),
           task:planning_tasks!inner(task_number, title, board_id)`
        )
        .eq("organization_id", orgId)
        .eq("task.board_id", boardId)
        .order("created_at", { ascending: false })
        .limit(Math.min(Math.max(limit, 1), 200));
      if (error) return { success: false, error: error.message };
      return {
        success: true,
        data: (data ?? []).map((row: any) => {
          const task = Array.isArray(row.task) ? row.task[0] : row.task;
          return {
            ...mapActivity({ ...row, board_id: boardId }),
            task_number: task?.task_number ?? "",
            task_title: task?.title ?? "",
          };
        }),
      };
    } catch (e) {
      return failure(e);
    }
  },
};
