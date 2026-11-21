/**
 * QR label templates, layouts and print runs (docs/QR_LABELS_PLAN.md, Q3).
 *
 * - Layout: immutable format + LabelConfig, deduplicated by hash in the
 *   database. Recorded through qr_label_layout_ensure() (service role) after
 *   the caller's permission check.
 * - Template: a name + target type pointing at its current layout. Editing
 *   moves the pointer to another layout; old prints keep theirs.
 * - Print batch: one print run. "new" made the codes it printed, "reprint"
 *   printed existing codes again. Codes remember their latest run
 *   (last_print_batch_id), so the next reprint can look the same.
 */

import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createServiceClient } from "@/utils/supabase/service";
import type { LabelConfig } from "@/lib/qr/label-config";
import { QrCodesService } from "@/server/services/qr.service";
import type { QrCode, ServiceResult } from "@/server/services/qr.service";

import type { QrLabelFormat, QrLabelTargetType } from "@/lib/qr/label-templates";

export {
  QR_LABEL_TARGET_TYPES,
  zplSizeForConfig,
  type QrLabelFormat,
  type QrLabelTargetType,
} from "@/lib/qr/label-templates";

export interface QrLabelLayout {
  id: string;
  format: QrLabelFormat;
  config: LabelConfig;
}

export interface QrLabelTemplate {
  id: string;
  organization_id: string;
  name: string;
  target_type: QrLabelTargetType | null;
  layout_id: string;
  is_default: boolean;
  created_at: string;
  updated_at: string;
  layout: QrLabelLayout | null;
}

export interface QrPrintBatch {
  id: string;
  organization_id: string;
  name: string | null;
  kind: "new" | "reprint";
  quantity: number;
  layout_id: string | null;
  template_id: string | null;
  created_by: string | null;
  created_at: string;
  template?: { id: string; name: string } | null;
  layout?: QrLabelLayout | null;
}

const TEMPLATE_SELECT = "*, layout:qr_label_layouts(id, format, config)";

function serviceClient(client?: SupabaseClient): SupabaseClient {
  return client ?? (createServiceClient() as unknown as SupabaseClient);
}

/** The error of a failed result, typed for any other result. */
function failed(result: unknown): { success: false; error: string } {
  return { success: false, error: (result as { error: string }).error };
}

function cleanName(name: string): string {
  return name.trim().slice(0, 120);
}

export class QrLabelLayoutsService {
  /**
   * The id of the layout with this format + config, created the first time.
   * Server only: the caller must already have checked permissions.
   */
  static async ensure(
    orgId: string,
    format: QrLabelFormat,
    config: LabelConfig,
    createdBy: string | null,
    client?: SupabaseClient
  ): Promise<ServiceResult<string>> {
    const { data, error } = await serviceClient(client).rpc("qr_label_layout_ensure", {
      p_organization_id: orgId,
      p_format: format,
      p_config: config,
      p_created_by: createdBy,
    });
    if (error || !data) return { success: false, error: error?.message ?? "Layout not saved" };
    return { success: true, data: data as string };
  }
}

export class QrLabelTemplatesService {
  static async list(
    supabase: SupabaseClient,
    orgId: string
  ): Promise<ServiceResult<QrLabelTemplate[]>> {
    const { data, error } = await supabase
      .from("qr_label_templates")
      .select(TEMPLATE_SELECT)
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("name");
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as QrLabelTemplate[] };
  }

  static async get(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<QrLabelTemplate | null>> {
    const { data, error } = await supabase
      .from("qr_label_templates")
      .select(TEMPLATE_SELECT)
      .eq("organization_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as QrLabelTemplate | null) ?? null };
  }

  /**
   * The template a label of this object type is printed with when nothing
   * else is known: the type's default, then the organization's general
   * default (target_type NULL).
   */
  static pickDefault(
    templates: QrLabelTemplate[],
    targetType: QrLabelTargetType | null
  ): QrLabelTemplate | null {
    const defaults = templates.filter((t) => t.is_default);
    return (
      (targetType ? defaults.find((t) => t.target_type === targetType) : undefined) ??
      defaults.find((t) => t.target_type === null) ??
      null
    );
  }

  static async create(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      name: string;
      targetType: QrLabelTargetType | null;
      format: QrLabelFormat;
      config: LabelConfig;
      isDefault?: boolean;
      userId: string | null;
    }
  ): Promise<ServiceResult<QrLabelTemplate>> {
    const layout = await QrLabelLayoutsService.ensure(
      orgId,
      input.format,
      input.config,
      input.userId
    );
    if (!layout.success) return failed(layout);

    const { data, error } = await supabase
      .from("qr_label_templates")
      .insert({
        organization_id: orgId,
        name: cleanName(input.name),
        target_type: input.targetType,
        layout_id: layout.data,
        created_by: input.userId,
        updated_by: input.userId,
      })
      .select(TEMPLATE_SELECT)
      .single();
    if (error) return { success: false, error: error.message };

    const template = data as QrLabelTemplate;
    if (input.isDefault) {
      const def = await QrLabelTemplatesService.setDefault(supabase, template.id);
      if (!def.success) return failed(def);
      template.is_default = true;
    }
    return { success: true, data: template };
  }

  /** Rename, retarget and/or save a new layout (a new layout version). */
  static async update(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    input: {
      name?: string;
      targetType?: QrLabelTargetType | null;
      format?: QrLabelFormat;
      config?: LabelConfig;
      userId: string | null;
    }
  ): Promise<ServiceResult<QrLabelTemplate>> {
    const patch: Record<string, unknown> = {
      updated_by: input.userId,
      updated_at: new Date().toISOString(),
    };
    if (input.name !== undefined) patch.name = cleanName(input.name);
    if (input.targetType !== undefined) {
      patch.target_type = input.targetType;
      // A default belongs to its type; moving the template drops it.
      patch.is_default = false;
    }
    if (input.config) {
      const layout = await QrLabelLayoutsService.ensure(
        orgId,
        input.format ?? "pdf",
        input.config,
        input.userId
      );
      if (!layout.success) return failed(layout);
      patch.layout_id = layout.data;
    }

    const { data, error } = await supabase
      .from("qr_label_templates")
      .update(patch)
      .eq("organization_id", orgId)
      .eq("id", id)
      .is("deleted_at", null)
      .select(TEMPLATE_SELECT)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Template not found" };
    return { success: true, data: data as QrLabelTemplate };
  }

  static async duplicate(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    name: string,
    userId: string | null
  ): Promise<ServiceResult<QrLabelTemplate>> {
    const source = await QrLabelTemplatesService.get(supabase, orgId, id);
    if (!source.success) return failed(source);
    if (!source.data) return { success: false, error: "Template not found" };

    const { data, error } = await supabase
      .from("qr_label_templates")
      .insert({
        organization_id: orgId,
        name: cleanName(name),
        target_type: source.data.target_type,
        layout_id: source.data.layout_id,
        created_by: userId,
        updated_by: userId,
      })
      .select(TEMPLATE_SELECT)
      .single();
    if (error) return { success: false, error: error.message };
    return { success: true, data: data as QrLabelTemplate };
  }

  /** Soft delete. Print runs keep their layout; only the name goes. */
  static async remove(
    supabase: SupabaseClient,
    orgId: string,
    id: string,
    userId: string | null
  ): Promise<ServiceResult<null>> {
    // No RETURNING: a deleted row is hidden by the SELECT policy.
    const { error } = await supabase
      .from("qr_label_templates")
      .update({
        deleted_at: new Date().toISOString(),
        is_default: false,
        updated_by: userId,
        updated_at: new Date().toISOString(),
      })
      .eq("organization_id", orgId)
      .eq("id", id)
      .is("deleted_at", null);
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  }

  static async setDefault(supabase: SupabaseClient, id: string): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("qr_label_template_set_default", {
      p_template_id: id,
    });
    if (error) return { success: false, error: error.message };
    return { success: true, data: null };
  }
}

export class QrPrintBatchesService {
  /**
   * New blank labels: one batch row, then `quantity` new codes that belong
   * to it. Needs qr.create (RLS on both inserts).
   */
  static async createNew(
    supabase: SupabaseClient,
    orgId: string,
    input: {
      quantity: number;
      name: string | null;
      layoutId: string;
      templateId: string | null;
      userId: string | null;
    }
  ): Promise<ServiceResult<{ batch: QrPrintBatch; codes: QrCode[] }>> {
    const { data, error } = await supabase
      .from("qr_print_batches")
      .insert({
        organization_id: orgId,
        name: input.name ? cleanName(input.name) : null,
        kind: "new",
        quantity: input.quantity,
        layout_id: input.layoutId,
        template_id: input.templateId,
        created_by: input.userId,
      })
      .select("*")
      .single();
    if (error) return { success: false, error: error.message };
    const batch = data as QrPrintBatch;

    const codes = await QrCodesService.createBatch(supabase, orgId, {
      count: input.quantity,
      createdBy: input.userId,
      batchId: batch.id,
    });
    if (!codes.success) return failed(codes);
    return { success: true, data: { batch, codes: codes.data } };
  }

  /**
   * Existing codes printed again. Runs with the service role (codes are not
   * writable by a plain exporter); the caller has checked permissions and
   * that the codes belong to the organization. Best effort for callers: a
   * failure here must not lose a label that was already generated.
   */
  static async recordReprint(
    orgId: string,
    input: {
      qrCodeIds: string[];
      layoutId: string;
      templateId: string | null;
      userId: string | null;
    },
    client?: SupabaseClient
  ): Promise<ServiceResult<QrPrintBatch>> {
    const ids = [...new Set(input.qrCodeIds)];
    if (ids.length === 0) return { success: false, error: "No codes" };
    const supabase = serviceClient(client);

    const { data, error } = await supabase
      .from("qr_print_batches")
      .insert({
        organization_id: orgId,
        kind: "reprint",
        quantity: Math.min(ids.length, 1000),
        layout_id: input.layoutId,
        template_id: input.templateId,
        created_by: input.userId,
      })
      .select("*")
      .single();
    if (error) return { success: false, error: error.message };
    const batch = data as QrPrintBatch;

    const { error: updateError } = await supabase
      .from("qr_codes")
      .update({ last_print_batch_id: batch.id })
      .eq("organization_id", orgId)
      .in("id", ids);
    if (updateError) return { success: false, error: updateError.message };

    return { success: true, data: batch };
  }

  static async list(
    supabase: SupabaseClient,
    orgId: string,
    limit = 50
  ): Promise<ServiceResult<QrPrintBatch[]>> {
    const { data, error } = await supabase
      .from("qr_print_batches")
      .select("*, template:qr_label_templates(id, name)")
      .eq("organization_id", orgId)
      .eq("kind", "new")
      .order("created_at", { ascending: false })
      .limit(limit);
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as QrPrintBatch[] };
  }

  static async get(
    supabase: SupabaseClient,
    orgId: string,
    id: string
  ): Promise<ServiceResult<QrPrintBatch | null>> {
    const { data, error } = await supabase
      .from("qr_print_batches")
      .select("*, layout:qr_label_layouts(id, format, config)")
      .eq("organization_id", orgId)
      .eq("id", id)
      .maybeSingle();
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data as QrPrintBatch | null) ?? null };
  }

  /** Active codes a "new" batch created, oldest first (same order as printed). */
  static async listCodes(
    supabase: SupabaseClient,
    orgId: string,
    batchId: string
  ): Promise<ServiceResult<QrCode[]>> {
    const { data, error } = await supabase
      .from("qr_codes")
      .select("*")
      .eq("organization_id", orgId)
      .eq("batch_id", batchId)
      .eq("status", "active")
      .is("deleted_at", null)
      .order("created_at")
      .order("id");
    if (error) return { success: false, error: error.message };
    return { success: true, data: (data ?? []) as QrCode[] };
  }

  /**
   * The layout these codes were last printed with -- only when they all
   * share one (otherwise "as before" means nothing for the set).
   */
  static async lastLayoutOf(
    supabase: SupabaseClient,
    orgId: string,
    qrCodeIds: string[]
  ): Promise<ServiceResult<{ layout: QrLabelLayout; templateId: string | null } | null>> {
    if (qrCodeIds.length === 0) return { success: true, data: null };
    const { data, error } = await supabase
      .from("qr_codes")
      .select(
        "id, last_print_batch:qr_print_batches!qr_codes_last_print_batch_id_fkey(id, template_id, layout:qr_label_layouts(id, format, config))"
      )
      .eq("organization_id", orgId)
      .in("id", qrCodeIds);
    if (error) return { success: false, error: error.message };

    type Row = {
      last_print_batch: {
        template_id: string | null;
        layout: QrLabelLayout | null;
      } | null;
    };
    const rows = (data ?? []) as unknown as Row[];
    if (rows.length === 0) return { success: true, data: null };
    const first = rows[0].last_print_batch;
    if (!first?.layout) return { success: true, data: null };
    const same = rows.every((r) => r.last_print_batch?.layout?.id === first.layout!.id);
    if (!same) return { success: true, data: null };
    return { success: true, data: { layout: first.layout, templateId: first.template_id } };
  }
}
