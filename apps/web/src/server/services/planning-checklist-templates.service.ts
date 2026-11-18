import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { ChecklistTemplate, ChecklistTemplateItem, KanbanChecklist } from "@/lib/types/kanban";
import type {
  ApplyChecklistTemplateInput,
  ChecklistToTemplateInput,
  SaveChecklistTemplateData,
} from "@/lib/validations/kanban";
import { KanbanBoardsService, type ServiceResult } from "@/server/services/kanban-boards.service";

const TEMPLATE_FIELDS = `id, title, items, created_by, updated_at,
  creator:users!created_by(first_name, last_name, email)`;

function failure(e: unknown): { success: false; error: string } {
  return { success: false, error: e instanceof Error ? e.message : "Unexpected error" };
}

function displayName(first?: string | null, last?: string | null, email?: string | null) {
  return [first, last].filter(Boolean).join(" ") || email || null;
}

/** The stored items, as far as they make sense (the column is free JSON). */
function mapItems(value: unknown): ChecklistTemplateItem[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((raw) => {
      const item = (raw ?? {}) as Record<string, unknown>;
      const title = typeof item.title === "string" ? item.title.trim() : "";
      const offset = item.due_offset_days;
      return {
        title,
        assigned_to: typeof item.assigned_to === "string" ? item.assigned_to : null,
        due_offset_days:
          typeof offset === "number" && Number.isInteger(offset) && offset >= 0 ? offset : null,
      };
    })
    .filter((item) => item.title.length > 0);
}

function mapTemplate(row: any): ChecklistTemplate {
  const creator = Array.isArray(row.creator) ? row.creator[0] : row.creator;
  return {
    id: row.id,
    title: row.title,
    items: mapItems(row.items),
    created_by: row.created_by ?? null,
    creator_name: creator
      ? displayName(creator.first_name, creator.last_name, creator.email)
      : null,
    updated_at: row.updated_at,
  };
}

/** Checklist templates: reusable lists that are copied into a task's checklists. */
export const PlanningChecklistTemplatesService = {
  async list(supabase: SupabaseClient, orgId: string): Promise<ServiceResult<ChecklistTemplate[]>> {
    try {
      const { data, error } = await supabase
        .from("planning_checklist_templates")
        .select(TEMPLATE_FIELDS)
        .eq("organization_id", orgId)
        .order("title", { ascending: true });
      if (error) return { success: false, error: error.message };
      return { success: true, data: (data ?? []).map(mapTemplate) };
    } catch (e) {
      return failure(e);
    }
  },

  /** A new template (no id) or new contents for an existing one. */
  async save(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: SaveChecklistTemplateData
  ): Promise<ServiceResult<ChecklistTemplate>> {
    try {
      const items = input.items.map((item) => ({
        title: item.title.trim(),
        assigned_to: item.assigned_to ?? null,
        due_offset_days: item.due_offset_days ?? null,
      }));
      const query = input.id
        ? supabase
            .from("planning_checklist_templates")
            .update({ title: input.title.trim(), items })
            .eq("organization_id", orgId)
            .eq("id", input.id)
        : supabase.from("planning_checklist_templates").insert({
            organization_id: orgId,
            title: input.title.trim(),
            items,
            created_by: userId,
          });
      const { data, error } = await query.select(TEMPLATE_FIELDS).single();
      if (error) {
        // No row back from an update: someone else's template, or gone.
        if (error.code === "PGRST116") return { success: false, error: "TEMPLATE_NOT_EDITABLE" };
        return { success: false, error: error.message };
      }
      return { success: true, data: mapTemplate(data) };
    } catch (e) {
      return failure(e);
    }
  },

  async remove(
    supabase: SupabaseClient,
    orgId: string,
    templateId: string
  ): Promise<ServiceResult<void>> {
    try {
      const { data, error } = await supabase
        .from("planning_checklist_templates")
        .delete()
        .eq("organization_id", orgId)
        .eq("id", templateId)
        .select("id");
      if (error) return { success: false, error: error.message };
      if (!data?.length) return { success: false, error: "TEMPLATE_NOT_EDITABLE" };
      return { success: true, data: undefined };
    } catch (e) {
      return failure(e);
    }
  },

  /** The template becomes a new checklist at the end of the task's checklists. */
  async apply(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: ApplyChecklistTemplateInput
  ): Promise<ServiceResult<KanbanChecklist>> {
    try {
      const { data: listId, error } = await supabase.rpc("planning_apply_checklist_template", {
        p_task_id: input.task_id as string,
        p_template_id: input.template_id as string,
      });
      if (error) return { success: false, error: error.message };

      const lists = await KanbanBoardsService.listChecklists(
        supabase,
        orgId,
        input.task_id as string
      );
      if (!lists.success) return { success: false, error: (lists as { error: string }).error };
      const list = lists.data.find((item) => item.id === listId);
      if (!list) return { success: false, error: "Checklist not found" };

      await KanbanBoardsService.recordCardActivity(
        supabase,
        orgId,
        null,
        input.task_id as string,
        userId,
        "checklist_added",
        { title: list.title }
      );
      return { success: true, data: list };
    } catch (e) {
      return failure(e);
    }
  },

  /** A task's checklist, saved as a template (its items and their people; no dates). */
  async fromChecklist(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: ChecklistToTemplateInput
  ): Promise<ServiceResult<ChecklistTemplate>> {
    try {
      const { data, error } = await supabase
        .from("planning_task_checklist_items")
        .select("title, assigned_to, position, created_at")
        .eq("organization_id", orgId)
        .eq("checklist_id", input.checklist_id as string)
        .order("position", { ascending: true })
        .order("created_at", { ascending: true });
      if (error) return { success: false, error: error.message };
      const items = ((data ?? []) as Array<{ title: string; assigned_to: string | null }>)
        .slice(0, 200)
        .map((row) => ({
          title: row.title.slice(0, 500),
          assigned_to: row.assigned_to ?? null,
          due_offset_days: null,
        }));
      return PlanningChecklistTemplatesService.save(supabase, orgId, userId, {
        title: input.title as string,
        items,
      });
    } catch (e) {
      return failure(e);
    }
  },
};
