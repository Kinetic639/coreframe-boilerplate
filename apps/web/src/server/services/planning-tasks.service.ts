import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import type {
  TaskStatus,
  TaskPriority,
  TaskListFilters,
  CreateTaskInput,
  UpdateTaskInput,
  ChangeTaskStatusInput,
  AssignTaskInput,
} from "@/lib/validations/planning";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface PlanningTaskListRow {
  id: string;
  org_id: string;
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
  created_at: string;
  updated_at: string;
}

export interface PlanningTaskDetail extends PlanningTaskListRow {
  description: string | null;
  deleted_at: string | null;
}

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

// ---------------------------------------------------------------------------
// Service
// ---------------------------------------------------------------------------

export const PlanningTasksService = {
  async listForDataView(
    supabase: SupabaseClient,
    orgId: string,
    params: DataViewListParams,
    filters: TaskListFilters = {}
  ): Promise<ActionResult<PaginatedResult<PlanningTaskListRow>>> {
    try {
      const page = params.page ?? 1;
      const pageSize = params.pageSize ?? 20;
      const offset = (page - 1) * pageSize;

      let query = supabase
        .from("planning_tasks")
        .select(
          `
          id, org_id, title, status, priority, branch_id, assigned_to,
          due_at, created_by, created_at, updated_at,
          assignee:profiles!planning_tasks_assigned_to_fkey(first_name, last_name, email),
          creator:profiles!planning_tasks_created_by_fkey(first_name, last_name, email)
        `,
          { count: "exact" }
        )
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (filters.status?.length) {
        query = query.in("status", filters.status);
      }
      if (filters.priority?.length) {
        query = query.in("priority", filters.priority);
      }
      if (filters.branch_id !== undefined) {
        if (filters.branch_id === null) {
          query = query.is("branch_id", null);
        } else {
          query = query.eq("branch_id", filters.branch_id);
        }
      }
      if (filters.assigned_to !== undefined) {
        if (filters.assigned_to === null) {
          query = query.is("assigned_to", null);
        } else {
          query = query.eq("assigned_to", filters.assigned_to);
        }
      }
      if (filters.search) {
        query = query.ilike("title", `%${filters.search}%`);
      }

      const sortField = params.sort?.field ?? "created_at";
      const sortDir = params.sort?.direction === "asc";
      query = query.order(sortField, { ascending: sortDir }).range(offset, offset + pageSize - 1);

      const { data, error, count } = await query;

      if (error) return { success: false, error: error.message };

      const rows: PlanningTaskListRow[] = (data ?? []).map((r) => {
        const assignee = Array.isArray(r.assignee) ? r.assignee[0] : r.assignee;
        const creator = Array.isArray(r.creator) ? r.creator[0] : r.creator;
        return {
          id: r.id,
          org_id: r.org_id,
          title: r.title,
          status: r.status as TaskStatus,
          priority: r.priority as TaskPriority,
          branch_id: r.branch_id ?? null,
          assigned_to: r.assigned_to ?? null,
          assignee_name: assignee
            ? [assignee.first_name, assignee.last_name].filter(Boolean).join(" ") || null
            : null,
          assignee_email: assignee?.email ?? null,
          created_by: r.created_by,
          creator_name: creator
            ? [creator.first_name, creator.last_name].filter(Boolean).join(" ") || null
            : null,
          creator_email: creator?.email ?? null,
          due_at: r.due_at ?? null,
          created_at: r.created_at,
          updated_at: r.updated_at,
        };
      });

      return {
        success: true,
        data: {
          rows,
          totalCount: count ?? 0,
          page,
          pageSize,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async getDetail(
    supabase: SupabaseClient,
    orgId: string,
    taskId: string
  ): Promise<ActionResult<PlanningTaskDetail>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .select(
          `
          id, org_id, title, description, status, priority, branch_id, assigned_to,
          due_at, created_by, created_at, updated_at, deleted_at,
          assignee:profiles!planning_tasks_assigned_to_fkey(first_name, last_name, email),
          creator:profiles!planning_tasks_created_by_fkey(first_name, last_name, email)
        `
        )
        .eq("org_id", orgId)
        .eq("id", taskId)
        .is("deleted_at", null)
        .single();

      if (error) return { success: false, error: error.message };
      if (!data) return { success: false, error: "Not found" };

      const assignee = Array.isArray(data.assignee) ? data.assignee[0] : data.assignee;
      const creator = Array.isArray(data.creator) ? data.creator[0] : data.creator;

      return {
        success: true,
        data: {
          id: data.id,
          org_id: data.org_id,
          title: data.title,
          description: data.description ?? null,
          status: data.status as TaskStatus,
          priority: data.priority as TaskPriority,
          branch_id: data.branch_id ?? null,
          assigned_to: data.assigned_to ?? null,
          assignee_name: assignee
            ? [assignee.first_name, assignee.last_name].filter(Boolean).join(" ") || null
            : null,
          assignee_email: assignee?.email ?? null,
          created_by: data.created_by,
          creator_name: creator
            ? [creator.first_name, creator.last_name].filter(Boolean).join(" ") || null
            : null,
          creator_email: creator?.email ?? null,
          due_at: data.due_at ?? null,
          created_at: data.created_at,
          updated_at: data.updated_at,
          deleted_at: data.deleted_at ?? null,
        },
      };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async create(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: CreateTaskInput
  ): Promise<ActionResult<PlanningTaskDetail>> {
    try {
      const { data, error } = await supabase
        .from("planning_tasks")
        .insert({
          org_id: orgId,
          created_by: userId,
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          branch_id: input.branch_id ?? null,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_at ?? null,
        })
        .select("id")
        .single();

      if (error) return { success: false, error: error.message };

      return PlanningTasksService.getDetail(supabase, orgId, data.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async update(
    supabase: SupabaseClient,
    orgId: string,
    input: UpdateTaskInput
  ): Promise<ActionResult<PlanningTaskDetail>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({
          title: input.title,
          description: input.description ?? null,
          status: input.status,
          priority: input.priority,
          branch_id: input.branch_id ?? null,
          assigned_to: input.assigned_to ?? null,
          due_at: input.due_at ?? null,
        })
        .eq("id", input.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      return PlanningTasksService.getDetail(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async changeStatus(
    supabase: SupabaseClient,
    orgId: string,
    input: ChangeTaskStatusInput
  ): Promise<ActionResult<PlanningTaskDetail>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({ status: input.status })
        .eq("id", input.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      return PlanningTasksService.getDetail(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async assign(
    supabase: SupabaseClient,
    orgId: string,
    input: AssignTaskInput
  ): Promise<ActionResult<PlanningTaskDetail>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({ assigned_to: input.assigned_to })
        .eq("id", input.id)
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      return PlanningTasksService.getDetail(supabase, orgId, input.id);
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },

  async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    taskId: string
  ): Promise<ActionResult<void>> {
    try {
      const { error } = await supabase
        .from("planning_tasks")
        .update({ deleted_at: new Date().toISOString() })
        .eq("id", taskId)
        .eq("org_id", orgId)
        .is("deleted_at", null);

      if (error) return { success: false, error: error.message };

      return { success: true, data: undefined };
    } catch (e) {
      return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
    }
  },
};
