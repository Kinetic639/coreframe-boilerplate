import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
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

async function insertActivity(
  supabase: SupabaseClient,
  orgId: string,
  taskId: string,
  actorId: string,
  activityType: string,
  message: string,
  metadata: Record<string, unknown> | null = null,
  branchId: string | null = null
): Promise<void> {
  await supabase.from("planning_task_activity").insert({
    organization_id: orgId,
    task_id: taskId,
    activity_type: activityType,
    actor_id: actorId,
    message,
    metadata,
    branch_id: branchId,
  });
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

      let query = supabase
        .from("planning_tasks")
        .select(
          `id, organization_id, task_number, title, status, priority,
           branch_id, assigned_to, due_at, started_at, completed_at, cancelled_at,
           created_by, created_at, updated_at,
           assignee:users!planning_tasks_assigned_to_fkey(first_name, last_name, email),
           creator:users!planning_tasks_created_by_fkey(first_name, last_name, email)`,
          { count: "exact" }
        )
        .eq("organization_id", orgId)
        .is("deleted_at", null);

      if (filters.status?.length) query = query.in("status", filters.status);
      if (filters.priority?.length) query = query.in("priority", filters.priority);
      if (filters.branch_id !== undefined) {
        filters.branch_id === null
          ? (query = query.is("branch_id", null))
          : (query = query.eq("branch_id", filters.branch_id));
      }
      if (filters.assigned_to !== undefined) {
        filters.assigned_to === null
          ? (query = query.is("assigned_to", null))
          : (query = query.eq("assigned_to", filters.assigned_to));
      }
      if (filters.search) {
        query = query.or(`title.ilike.%${filters.search}%,task_number.ilike.%${filters.search}%`);
      }

      const sortField = params.sort?.field ?? "created_at";
      const sortAsc = params.sort?.direction === "asc";
      query = query.order(sortField, { ascending: sortAsc }).range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;
      if (error) return { success: false, error: error.message };

      const rows: PlanningTaskListRow[] = (data ?? []).map((r) => {
        const row = r as any;
        const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
        const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
        return {
          id: row.id,
          organization_id: row.organization_id,
          task_number: row.task_number,
          title: row.title,
          status: row.status as TaskStatus,
          priority: row.priority as TaskPriority,
          branch_id: row.branch_id ?? null,
          assigned_to: row.assigned_to ?? null,
          assignee_name: assignee
            ? displayName(assignee.first_name, assignee.last_name, assignee.email)
            : null,
          assignee_email: assignee?.email ?? null,
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
      });

      return { success: true, data: { rows, totalCount: count ?? 0, page, pageSize } };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  // ── Get detail ───────────────────────────────────────────────────────────

  async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    taskId: string
  ): Promise<ServiceResult<PlanningTaskDetail>> {
    try {
      const { data: raw, error } = await supabase
        .from("planning_tasks")
        .select(
          `id, organization_id, task_number, title, description_plain, description_rich,
           status, priority, branch_id, assigned_to, due_at, started_at, completed_at,
           cancelled_at, created_by, updated_by, created_at, updated_at, deleted_at,
           assignee:users!planning_tasks_assigned_to_fkey(first_name, last_name, email),
           creator:users!planning_tasks_created_by_fkey(first_name, last_name, email)`
        )
        .eq("organization_id", orgId)
        .eq("id", taskId)
        .is("deleted_at", null)
        .single();

      if (error) return { success: false, error: error.message };
      if (!raw) return { success: false, error: "Not found" };

      const row = raw as any;
      const assignee = Array.isArray(row.assignee) ? row.assignee[0] : row.assignee;
      const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;

      // Fetch activity
      const { data: activityRaw } = await supabase
        .from("planning_task_activity")
        .select(
          `id, organization_id, task_id, activity_type, actor_id, message, metadata, created_at,
           actor:users!planning_task_activity_actor_id_fkey(first_name, last_name, email)`
        )
        .eq("task_id", taskId)
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
          status: row.status as TaskStatus,
          priority: row.priority as TaskPriority,
          branch_id: row.branch_id ?? null,
          assigned_to: row.assigned_to ?? null,
          assignee_name: assignee
            ? displayName(assignee.first_name, assignee.last_name, assignee.email)
            : null,
          assignee_email: assignee?.email ?? null,
          created_by: row.created_by,
          creator_name: creator
            ? displayName(creator.first_name, creator.last_name, creator.email)
            : null,
          creator_email: creator?.email ?? null,
          updated_by: row.updated_by ?? null,
          due_at: row.due_at ?? null,
          started_at: row.started_at ?? null,
          completed_at: row.completed_at ?? null,
          cancelled_at: row.cancelled_at ?? null,
          created_at: row.created_at,
          updated_at: row.updated_at,
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
      const { data: inserted, error } = await supabase
        .from("planning_tasks")
        .insert({
          organization_id: orgId,
          created_by: userId,
          updated_by: userId,
          title: input.title,
          description_plain: input.description_plain ?? null,
          description_rich: (input.description_rich as object | null) ?? null,
          status: "open",
          priority: input.priority ?? "normal",
          branch_id: input.branch_id ?? null,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_at ?? null,
        })
        .select("id, organization_id")
        .single();

      if (error) return { success: false, error: error.message };

      const taskId = (inserted as any).id as string;

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

      return PlanningTasksService.getDetail(supabase, orgId, taskId);
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
      const { error } = await supabase
        .from("planning_tasks")
        .update({
          title: input.title,
          description_plain: input.description_plain ?? null,
          description_rich: (input.description_rich as object | null) ?? null,
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
