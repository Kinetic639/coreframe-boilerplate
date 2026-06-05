import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import { createServiceClient } from "@/utils/supabase/service";
import type {
  TaskStatus,
  TaskPriority,
  TaskListFilters,
  CreateTaskInput,
  UpdateTaskInput,
  AssignTaskInput,
} from "@/lib/validations/planning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanningTaskListRow {
  id: string;
  organization_id: string;
  task_number: string;
  title: string;
  status: TaskStatus;
  priority: TaskPriority;
  branch_id: string | null;
  assigned_to: string | null;
  assignee_name: string | null;
  assignee_email: string | null;
  assignee_avatar_url: string | null;
  assignee_profile_href: string | null;
  created_by: string;
  creator_name: string | null;
  creator_email: string | null;
  due_at: string | null;
  started_at: string | null;
  completed_at: string | null;
  cancelled_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface PlanningTaskActivity {
  id: string;
  organization_id: string;
  task_id: string;
  activity_type: string;
  actor_id: string | null;
  actor_name: string | null;
  message: string | null;
  metadata: Record<string, unknown> | null;
  created_at: string;
}

export interface PlanningTaskDetail extends PlanningTaskListRow {
  description_plain: string | null;
  description_rich: unknown | null;
  updated_by: string | null;
  deleted_at: string | null;
  activity: PlanningTaskActivity[];
}

export type ServiceResult<T> = { success: true; data: T } | { success: false; error: string };
type DataViewFilterValue = string | string[] | boolean | null | undefined;

const SORTABLE_TASK_FIELDS = new Set([
  "task_number",
  "title",
  "status",
  "priority",
  "branch_id",
  "assigned_to",
  "due_at",
  "started_at",
  "completed_at",
  "cancelled_at",
  "created_at",
  "updated_at",
]);

const USER_AVATAR_BUCKET = "user-avatars";
const AVATAR_TTL_SECONDS = 60 * 60;
const AVATAR_SIGN_TIMEOUT_MS = 2_000;

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function displayName(
  firstName: string | null,
  lastName: string | null,
  email: string | null
): string | null {
  const name = [firstName, lastName].filter(Boolean).join(" ").trim();
  return name || email || null;
}

function memberProfileHref(userId: string): string {
  return `/dashboard/organization/users/members/${userId}`;
}

async function batchSignAvatarUrls(
  entries: Array<{ userId: string; avatarPath: string }>
): Promise<Map<string, string>> {
  if (entries.length === 0) return new Map();

  const sign = async (): Promise<Map<string, string>> => {
    try {
      const svc = createServiceClient();
      const { data, error } = await svc.storage.from(USER_AVATAR_BUCKET).createSignedUrls(
        entries.map((entry) => entry.avatarPath),
        AVATAR_TTL_SECONDS
      );

      if (error || !data) return new Map();

      const signedUrls = new Map<string, string>();
      data.forEach((item, index) => {
        const entry = entries[index];
        if (entry && item.signedUrl) signedUrls.set(entry.userId, item.signedUrl);
      });
      return signedUrls;
    } catch {
      return new Map();
    }
  };

  const timeout = new Promise<Map<string, string>>((resolve) => {
    setTimeout(() => resolve(new Map()), AVATAR_SIGN_TIMEOUT_MS);
  });

  return Promise.race([sign(), timeout]);
}

function resolveAvatarUrl(
  userId: string | null,
  avatarUrl: string | null,
  avatarPath: string | null,
  signedUrls: Map<string, string>
): string | null {
  if (userId && avatarPath?.startsWith(`${userId}/`)) {
    return signedUrls.get(userId) ?? avatarUrl;
  }
  return avatarUrl;
}

function collectAvatarSignEntries(rows: any[]): Array<{ userId: string; avatarPath: string }> {
  const entries = new Map<string, string>();

  rows.forEach((row) => {
    const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
    const userId = row.assigned_to as string | null;
    const avatarPath = assignee?.avatar_path as string | null | undefined;

    if (userId && avatarPath?.startsWith(`${userId}/`)) entries.set(userId, avatarPath);
  });

  return Array.from(entries, ([userId, avatarPath]) => ({ userId, avatarPath }));
}

function mapTaskRow(row: any, signedAvatarUrls: Map<string, string>): PlanningTaskListRow {
  const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  const assignedTo = row.assigned_to ?? null;

  return {
    id: row.id,
    organization_id: row.organization_id,
    task_number: row.task_number,
    title: row.title,
    status: row.status as TaskStatus,
    priority: row.priority as TaskPriority,
    branch_id: row.branch_id ?? null,
    assigned_to: assignedTo,
    assignee_name: assignee
      ? displayName(assignee.first_name, assignee.last_name, assignee.email)
      : null,
    assignee_email: assignee?.email ?? null,
    assignee_avatar_url: assignee
      ? resolveAvatarUrl(
          assignedTo,
          assignee.avatar_url ?? null,
          assignee.avatar_path ?? null,
          signedAvatarUrls
        )
      : null,
    assignee_profile_href: assignedTo ? memberProfileHref(assignedTo) : null,
    created_by: row.created_by,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    creator_email: creator?.email ?? null,
    due_at: row.due_at ?? null,
    started_at: row.started_at ?? null,
    completed_at: row.completed_at ?? null,
    cancelled_at: row.cancelled_at ?? null,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function stringArrayFilter(value: DataViewFilterValue): string[] | undefined {
  if (Array.isArray(value)) return value.filter((item): item is string => Boolean(item));
  if (typeof value === "string" && value) return [value];
  return undefined;
}

function nullableStringFilter(value: DataViewFilterValue): string | null | undefined {
  if (value === null) return null;
  if (typeof value === "string" && value) return value;
  return undefined;
}

function normalizeFilters(params: DataViewListParams, filters: TaskListFilters): TaskListFilters {
  const rawFilters = params.filters ?? {};
  return {
    search: filters.search ?? params.search?.trim() ?? undefined,
    status: filters.status ?? (stringArrayFilter(rawFilters.status) as TaskStatus[] | undefined),
    priority:
      filters.priority ?? (stringArrayFilter(rawFilters.priority) as TaskPriority[] | undefined),
    branch_id: filters.branch_id ?? nullableStringFilter(rawFilters.branch_id),
    assigned_to: filters.assigned_to ?? nullableStringFilter(rawFilters.assigned_to),
  };
}

function resolveSortField(field: string | null | undefined): string {
  return field && SORTABLE_TASK_FIELDS.has(field) ? field : "created_at";
}

function looksLikeUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

async function insertActivity(
  supabase: SupabaseClient,
  orgId: string,
  taskId: string,
  actorId: string,
  activityType: string,
  message: string,
  metadata: Record<string, unknown> | null = null,
  branchId: string | null = null
): Promise<ServiceResult<void>> {
  const { error } = await supabase.from("planning_task_activity").insert({
    organization_id: orgId,
    task_id: taskId,
    activity_type: activityType,
    actor_id: actorId,
    message,
    metadata,
    branch_id: branchId,
  });
  if (error) return { success: false, error: error.message };
  return { success: true, data: undefined };
}

async function assertBranchBelongsToOrg(
  supabase: SupabaseClient,
  orgId: string,
  branchId: string | null | undefined
): Promise<ServiceResult<void>> {
  if (!branchId) return { success: true, data: undefined };

  const { data, error } = await supabase
    .from("branches")
    .select("id")
    .eq("id", branchId)
    .eq("organization_id", orgId)
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Branch does not belong to this organization" };
  return { success: true, data: undefined };
}

async function assertUserIsActiveOrgMember(
  supabase: SupabaseClient,
  orgId: string,
  userId: string | null | undefined
): Promise<ServiceResult<void>> {
  if (!userId) return { success: true, data: undefined };

  const { data, error } = await supabase
    .from("organization_members")
    .select("user_id")
    .eq("organization_id", orgId)
    .eq("user_id", userId)
    .eq("status", "active")
    .is("deleted_at", null)
    .maybeSingle();

  if (error) return { success: false, error: error.message };
  if (!data) return { success: false, error: "Assignee is not an active organization member" };
  return { success: true, data: undefined };
}

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const PlanningTasksService = {
  // ── List for DataView ────────────────────────────────────────────────────

  async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams,
    filters: TaskListFilters = {}
  ): Promise<ServiceResult<PaginatedResult<PlanningTaskListRow>>> {
    try {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const offset = (page - 1) * pageSize;
      const resolvedFilters = normalizeFilters(params, filters);

      let query = supabase
        .from("planning_tasks")
        .select(
          `id, organization_id, task_number, title, status, priority,
           branch_id, assigned_to, due_at, started_at, completed_at, cancelled_at,
           created_by, created_at, updated_at,
           assignee:users!assigned_to(first_name, last_name, email, avatar_url, avatar_path),
           creator:users!created_by(first_name, last_name, email)`,
          { count: "exact" }
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (resolvedFilters.status?.length) query = query.in("status", resolvedFilters.status);
      if (resolvedFilters.priority?.length) query = query.in("priority", resolvedFilters.priority);
      if (resolvedFilters.branch_id !== undefined) {
        resolvedFilters.branch_id === null
          ? (query = query.is("branch_id", null))
          : (query = query.eq("branch_id", resolvedFilters.branch_id));
      }
      if (resolvedFilters.assigned_to !== undefined) {
        resolvedFilters.assigned_to === null
          ? (query = query.is("assigned_to", null))
          : (query = query.eq("assigned_to", resolvedFilters.assigned_to));
      }
      if (resolvedFilters.search) {
        query = query.or(
          `title.ilike.%${resolvedFilters.search}%,task_number.ilike.%${resolvedFilters.search}%`
        );
      }

      const sortField = resolveSortField(params.sort?.field);
      const sortAsc = params.sort?.direction === "asc";
      query = query.order(sortField, { ascending: sortAsc }).range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) return { success: false, error: error.message };

      const rawRows = (data ?? []) as any[];
      const signedAvatarUrls = await batchSignAvatarUrls(collectAvatarSignEntries(rawRows));
      const rows = rawRows.map((row) => mapTaskRow(row, signedAvatarUrls));

      return { success: true, data: { rows, totalCount: count ?? 0, page, pageSize } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── List for Kanban ─────────────────────────────────────────────────────

  async listForKanban(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<PlanningTaskListRow[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .select(
          `id, organization_id, task_number, title, status, priority,
           branch_id, assigned_to, due_at, started_at, completed_at, cancelled_at,
           created_by, created_at, updated_at,
           assignee:users!assigned_to(first_name, last_name, email, avatar_url, avatar_path),
           creator:users!created_by(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .in("status", ["open", "in_progress", "completed", "cancelled"])
        .is("deleted_at", null)
        .order("updated_at", { ascending: false })
        .limit(500);

      if (error) return { success: false, error: error.message };

      const rawRows = (data ?? []) as any[];
      const signedAvatarUrls = await batchSignAvatarUrls(collectAvatarSignEntries(rawRows));
      const rows = rawRows.map((row) => mapTaskRow(row, signedAvatarUrls));

      return { success: true, data: rows };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Get detail ───────────────────────────────────────────────────────────

  async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    taskIdentifier: string
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const identifierColumn = looksLikeUuid(taskIdentifier) ? "id" : "task_number";
      const { data: raw, error } = await supabase
        .from("planning_tasks")
        .select(
          `id, organization_id, task_number, title, description_plain, description_rich,
           status, priority, branch_id, assigned_to, due_at, started_at, completed_at,
           cancelled_at, created_by, updated_by, created_at, updated_at, deleted_at,
           assignee:users!assigned_to(first_name, last_name, email, avatar_url, avatar_path),
           creator:users!created_by(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .eq(identifierColumn, taskIdentifier)
        .is("deleted_at", null)
        .single();

      if (error) return { success: false, error: error.message };
      if (!raw) return { success: false, error: "Not found" };

      const row = raw as any;
      const signedAvatarUrls = await batchSignAvatarUrls(collectAvatarSignEntries([row]));
      const mappedRow = mapTaskRow(row, signedAvatarUrls);

      // Fetch activity
      const { data: activityRaw } = await supabase
        .from("planning_task_activity")
        .select(
          `id, organization_id, task_id, activity_type, actor_id, message, metadata, created_at,
           actor:users!actor_id(first_name, last_name, email)`
        )
        .eq("task_id", row.id)
        .eq("organization_id", orgId)
        .order("created_at", { ascending: true });

      const activity: PlanningTaskActivity[] = (activityRaw ?? []).map((a) => {
        const act = a as any;
        const actor = Array.isArray(act.actor) ? act.actor[0] : act.actor;
        return {
          id: act.id,
          organization_id: act.organization_id,
          task_id: act.task_id,
          activity_type: act.activity_type,
          actor_id: act.actor_id ?? null,
          actor_name: actor ? displayName(actor.first_name, actor.last_name, actor.email) : null,
          message: act.message ?? null,
          metadata: act.metadata ?? null,
          created_at: act.created_at,
        };
      });

      return {
        success: true,
        data: {
          id: row.id,
          organization_id: row.organization_id,
          task_number: row.task_number,
          title: row.title,
          description_plain: row.description_plain ?? null,
          description_rich: row.description_rich ?? null,
          status: mappedRow.status,
          priority: mappedRow.priority,
          branch_id: mappedRow.branch_id,
          assigned_to: mappedRow.assigned_to,
          assignee_name: mappedRow.assignee_name,
          assignee_email: mappedRow.assignee_email,
          assignee_avatar_url: mappedRow.assignee_avatar_url,
          assignee_profile_href: mappedRow.assignee_profile_href,
          created_by: mappedRow.created_by,
          creator_name: mappedRow.creator_name,
          creator_email: mappedRow.creator_email,
          updated_by: row.updated_by ?? null,
          due_at: mappedRow.due_at,
          started_at: mappedRow.started_at,
          completed_at: mappedRow.completed_at,
          cancelled_at: mappedRow.cancelled_at,
          created_at: mappedRow.created_at,
          updated_at: mappedRow.updated_at,
          deleted_at: row.deleted_at ?? null,
          activity,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Create ───────────────────────────────────────────────────────────────

  async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const branchResult = await assertBranchBelongsToOrg(supabase, orgId, input.branch_id);
      if (!branchResult.success) return branchResult as { success: false; error: string };

      const assigneeResult = await assertUserIsActiveOrgMember(supabase, orgId, input.assigned_to);
      if (!assigneeResult.success) return assigneeResult as { success: false; error: string };

      const { data: inserted, error } = await supabase
        .from("planning_tasks")
        .insert({
          organization_id: orgId,
          created_by: userId,
          updated_by: userId,
          title: input.title,
          description_plain: input.description_plain ?? null,
          description_rich: input.description_rich
            ? (() => {
                try {
                  return JSON.parse(input.description_rich);
                } catch {
                  return null;
                }
              })()
            : null,
          status: "open",
          priority: input.priority ?? "normal",
          branch_id: input.branch_id ?? null,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_at ?? null,
        })
        .select(
          `id, organization_id, task_number, title, description_plain, description_rich,
           status, priority, branch_id, assigned_to, due_at, started_at, completed_at,
           cancelled_at, created_by, updated_by, created_at, updated_at, deleted_at,
           assignee:users!assigned_to(first_name, last_name, email, avatar_url, avatar_path),
           creator:users!created_by(first_name, last_name, email)`
        )
        .single();

      if (error) return { success: false, error: error.message };

      const row = inserted as any;
      const taskId = row.id as string;

      await insertActivity(supabase, orgId, taskId, userId, "task_created", "Task created");

      if (input.assigned_to) {
        await insertActivity(
          supabase,
          orgId,
          taskId,
          userId,
          "assigned",
          "Task assigned",
          { from: null, to: input.assigned_to },
          input.branch_id ?? null
        );
      }

      const signedAvatarUrls = await batchSignAvatarUrls(collectAvatarSignEntries([row]));
      const mappedRow = mapTaskRow(row, signedAvatarUrls);

      return {
        success: true,
        data: {
          id: row.id,
          organization_id: row.organization_id,
          task_number: row.task_number,
          title: row.title,
          description_plain: row.description_plain ?? null,
          description_rich: row.description_rich ?? null,
          status: mappedRow.status,
          priority: mappedRow.priority,
          branch_id: mappedRow.branch_id,
          assigned_to: mappedRow.assigned_to,
          assignee_name: mappedRow.assignee_name,
          assignee_email: mappedRow.assignee_email,
          assignee_avatar_url: mappedRow.assignee_avatar_url,
          assignee_profile_href: mappedRow.assignee_profile_href,
          created_by: mappedRow.created_by,
          creator_name: mappedRow.creator_name,
          creator_email: mappedRow.creator_email,
          updated_by: row.updated_by ?? null,
          due_at: mappedRow.due_at,
          started_at: mappedRow.started_at,
          completed_at: mappedRow.completed_at,
          cancelled_at: mappedRow.cancelled_at,
          created_at: mappedRow.created_at,
          updated_at: mappedRow.updated_at,
          deleted_at: row.deleted_at ?? null,
          activity: [],
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Update ───────────────────────────────────────────────────────────────

  async update(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: UpdateTaskInput,
    previous: {
      title: string;
      priority: TaskPriority;
      due_at: string | null;
      description_plain: string | null;
    }
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const branchResult = await assertBranchBelongsToOrg(supabase, orgId, input.branch_id);
      if (!branchResult.success) return branchResult as { success: false; error: string };

      const { error } = await supabase
        .from("planning_tasks")
        .update({
          title: input.title,
          description_plain: input.description_plain ?? null,
          description_rich: input.description_rich
            ? (() => {
                try {
                  return JSON.parse(input.description_rich);
                } catch {
                  return null;
                }
              })()
            : null,
          priority: input.priority,
          branch_id: input.branch_id ?? null,
          due_at: input.due_at ?? null,
          updated_by: userId,
        })
        .eq("id", input.id)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      // Write activity for each changed field
      if (input.title !== previous.title) {
        await insertActivity(supabase, orgId, input.id, userId, "title_changed", "Title updated", {
          from: previous.title,
          to: input.title,
        });
      }
      if (input.priority !== previous.priority) {
        await insertActivity(
          supabase,
          orgId,
          input.id,
          userId,
          "priority_changed",
          "Priority changed",
          { from: previous.priority, to: input.priority }
        );
      }
      if ((input.due_at ?? null) !== (previous.due_at ?? null)) {
        await insertActivity(
          supabase,
          orgId,
          input.id,
          userId,
          "due_date_changed",
          "Due date updated",
          { from: previous.due_at, to: input.due_at ?? null }
        );
      }
      if ((input.description_plain ?? null) !== (previous.description_plain ?? null)) {
        await insertActivity(
          supabase,
          orgId,
          input.id,
          userId,
          "description_changed",
          "Description updated"
        );
      }

      return PlanningTasksService.getDetail(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Change status ────────────────────────────────────────────────────────

  async changeStatus(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    taskId: string,
    newStatus: TaskStatus,
    previousStatus: TaskStatus
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const now = new Date().toISOString();
      const patch: Record<string, unknown> = {
        status: newStatus,
        updated_by: userId,
      };

      let activityType = "status_changed";
      let message = `Status changed from ${previousStatus} to ${newStatus}`;

      if (newStatus === "in_progress" && previousStatus === "open") {
        patch.started_at = now;
        activityType = "status_changed";
      }
      if (newStatus === "completed") {
        patch.completed_at = now;
        patch.cancelled_at = null;
        activityType = "completed";
        message = "Task marked as completed";
      }
      if (newStatus === "cancelled") {
        patch.cancelled_at = now;
        patch.completed_at = null;
        activityType = "cancelled";
        message = "Task cancelled";
      }
      if (
        newStatus === "open" &&
        (previousStatus === "completed" || previousStatus === "cancelled")
      ) {
        patch.completed_at = null;
        patch.cancelled_at = null;
        activityType = "reopened";
        message = "Task reopened";
      }

      const { error } = await supabase
        .from("planning_tasks")
        .update(patch)
        .eq("id", taskId)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await insertActivity(supabase, orgId, taskId, userId, activityType, message, {
        from: previousStatus,
        to: newStatus,
      });

      return PlanningTasksService.getDetail(supabase, orgId, taskId);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Assign ───────────────────────────────────────────────────────────────

  async assign(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: AssignTaskInput,
    previousAssignee: string | null
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const assigneeResult = await assertUserIsActiveOrgMember(supabase, orgId, input.assigned_to);
      if (!assigneeResult.success) return assigneeResult as { success: false; error: string };

      const { error } = await supabase
        .from("planning_tasks")
        .update({ assigned_to: input.assigned_to, updated_by: userId })
        .eq("id", input.id)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      const activityType = input.assigned_to ? "assigned" : "unassigned";
      const message = input.assigned_to ? "Task assigned" : "Task unassigned";
      await insertActivity(supabase, orgId, input.id, userId, activityType, message, {
        from: previousAssignee,
        to: input.assigned_to,
      });

      return PlanningTasksService.getDetail(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Soft delete ──────────────────────────────────────────────────────────

  async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    taskId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({ deleted_at: new Date().toISOString(), updated_by: userId })
        .eq("id", taskId)
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      await insertActivity(supabase, orgId, taskId, userId, "archived", "Task archived");
      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },
};
