"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { QR_EXPORT, QR_READ, WAREHOUSE_LOCATIONS_MANAGE } from "@/lib/constants/permissions";
import type { PermissionSnapshot } from "@/lib/types/permissions";
import { labelConfigSchema } from "@/lib/qr/label-config-schema";
import type { LabelConfig } from "@/lib/qr/label-config";
import {
  QR_LABEL_TARGET_TYPES,
  QrLabelTemplatesService,
  QrPrintBatchesService,
  type QrLabelLayout,
  type QrLabelTargetType,
  type QrLabelTemplate,
  type QrPrintBatch,
} from "@/server/services/qr-labels.service";
import { QrAssignmentsService } from "@/server/services/qr.service";

// QR label templates and print runs (docs/QR_LABELS_PLAN.md, Q3).

type Result<T> = { success: true; data: T } | { success: false; error: string };

const targetTypeSchema = z.enum(QR_LABEL_TARGET_TYPES).nullable();

const saveSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string().trim().min(1).max(120),
  targetType: targetTypeSchema,
  format: z.enum(["pdf", "zpl"]),
  config: labelConfigSchema,
  isDefault: z.boolean().optional(),
});

const idSchema = z.object({ id: z.string().uuid() });
const duplicateSchema = z.object({
  id: z.string().uuid(),
  name: z.string().trim().min(1).max(120),
});

const optionsSchema = z.object({
  targetType: targetTypeSchema.optional(),
  qrCodeIds: z.array(z.string().uuid()).max(200).optional(),
  /** Objects of targetType; their codes are looked up for "as before". */
  targetIds: z.array(z.string().uuid()).max(200).optional(),
});

async function orgContext() {
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return null;
  return {
    orgId: context.app.activeOrgId,
    userId: context.user.user?.id ?? null,
    snapshot: context.user.permissionSnapshot,
  };
}

/** Same rule as the RLS policy: qr.export, or the location manager for location templates. */
function canEditType(snapshot: PermissionSnapshot, targetType: QrLabelTargetType | null) {
  return (
    checkPermission(snapshot, QR_EXPORT) ||
    (targetType === "warehouse.location" && checkPermission(snapshot, WAREHOUSE_LOCATIONS_MANAGE))
  );
}

export async function listQrLabelTemplatesAction(): Promise<Result<QrLabelTemplate[]>> {
  try {
    const ctx = await orgContext();
    if (!ctx) return { success: false, error: "No active organization" };
    const supabase = await createClient();
    return await QrLabelTemplatesService.list(supabase, ctx.orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/** Create (no id) or save a template. A changed layout becomes a new layout version. */
export async function saveQrLabelTemplateAction(
  rawInput: unknown
): Promise<Result<QrLabelTemplate>> {
  try {
    const ctx = await orgContext();
    if (!ctx) return { success: false, error: "No active organization" };
    const parsed = saveSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const input = parsed.data;
    if (!canEditType(ctx.snapshot, input.targetType))
      return { success: false, error: "Unauthorized" };

    const supabase = await createClient();
    const config = input.config as LabelConfig;

    if (!input.id) {
      return await QrLabelTemplatesService.create(supabase, ctx.orgId, {
        name: input.name,
        targetType: input.targetType,
        format: input.format,
        config,
        isDefault: input.isDefault,
        userId: ctx.userId,
      });
    }

    const existing = await QrLabelTemplatesService.get(supabase, ctx.orgId, input.id);
    if (!existing.success) return { success: false, error: (existing as { error: string }).error };
    if (!existing.data) return { success: false, error: "Template not found" };
    if (!canEditType(ctx.snapshot, existing.data.target_type)) {
      return { success: false, error: "Unauthorized" };
    }

    const saved = await QrLabelTemplatesService.update(supabase, ctx.orgId, input.id, {
      name: input.name,
      ...(input.targetType !== existing.data.target_type ? { targetType: input.targetType } : {}),
      format: input.format,
      config,
      userId: ctx.userId,
    });
    if (!saved.success) return saved;

    if (input.isDefault && !saved.data.is_default) {
      const def = await QrLabelTemplatesService.setDefault(supabase, saved.data.id);
      if (!def.success) return { success: false, error: (def as { error: string }).error };
      saved.data.is_default = true;
    }
    return saved;
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

async function editableTemplate(rawId: unknown) {
  const ctx = await orgContext();
  if (!ctx) return { error: "No active organization" } as const;
  const parsed = idSchema.safeParse(rawId);
  if (!parsed.success) return { error: "Invalid input" } as const;
  const supabase = await createClient();
  const existing = await QrLabelTemplatesService.get(supabase, ctx.orgId, parsed.data.id);
  if (!existing.success) return { error: (existing as { error: string }).error } as const;
  if (!existing.data) return { error: "Template not found" } as const;
  if (!canEditType(ctx.snapshot, existing.data.target_type))
    return { error: "Unauthorized" } as const;
  return { ctx, supabase, template: existing.data } as const;
}

export async function duplicateQrLabelTemplateAction(
  rawInput: unknown
): Promise<Result<QrLabelTemplate>> {
  try {
    const parsed = duplicateSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const found = await editableTemplate({ id: parsed.data.id });
    if ("error" in found) return { success: false, error: found.error as string };
    return await QrLabelTemplatesService.duplicate(
      found.supabase,
      found.ctx.orgId,
      found.template.id,
      parsed.data.name,
      found.ctx.userId
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteQrLabelTemplateAction(rawInput: unknown): Promise<Result<null>> {
  try {
    const found = await editableTemplate(rawInput);
    if ("error" in found) return { success: false, error: found.error as string };
    return await QrLabelTemplatesService.remove(
      found.supabase,
      found.ctx.orgId,
      found.template.id,
      found.ctx.userId
    );
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export async function setDefaultQrLabelTemplateAction(rawInput: unknown): Promise<Result<null>> {
  try {
    const found = await editableTemplate(rawInput);
    if ("error" in found) return { success: false, error: found.error as string };
    return await QrLabelTemplatesService.setDefault(found.supabase, found.template.id);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

/** Latest blank-label print runs (for "print again"). */
export async function listQrPrintBatchesAction(): Promise<Result<QrPrintBatch[]>> {
  try {
    const ctx = await orgContext();
    if (!ctx) return { success: false, error: "No active organization" };
    if (!checkPermission(ctx.snapshot, QR_READ)) return { success: false, error: "Unauthorized" };
    const supabase = await createClient();
    return await QrPrintBatchesService.list(supabase, ctx.orgId);
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}

export interface QrPrintOptions {
  /** Templates usable here: this object type's and the general ones. */
  templates: QrLabelTemplate[];
  /** The layout these codes were last printed with, when they share one. */
  previous: { layout: QrLabelLayout; templateId: string | null } | null;
  /** What to preselect: "previous", a template id, or null (built-in layout). */
  suggested: string | null;
}

/**
 * Layout choices for printing labels of existing codes. Preselects: the
 * codes' last print → the object type's default template → the general
 * default template → the built-in layout.
 */
export async function getQrPrintOptionsAction(rawInput: unknown): Promise<Result<QrPrintOptions>> {
  try {
    const ctx = await orgContext();
    if (!ctx) return { success: false, error: "No active organization" };
    const parsed = optionsSchema.safeParse(rawInput ?? {});
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const targetType = parsed.data.targetType ?? null;

    const supabase = await createClient();
    const all = await QrLabelTemplatesService.list(supabase, ctx.orgId);
    if (!all.success) return { success: false, error: (all as { error: string }).error };
    const templates = all.data.filter(
      (t) => t.target_type === null || t.target_type === targetType
    );

    let qrCodeIds = parsed.data.qrCodeIds ?? [];
    if (qrCodeIds.length === 0 && targetType && parsed.data.targetIds?.length) {
      const assignments = await QrAssignmentsService.getActiveForTargets(
        supabase,
        targetType,
        parsed.data.targetIds
      );
      if (assignments.success) {
        // "As before" only when every object already has a code.
        if (assignments.data.size === new Set(parsed.data.targetIds).size) {
          qrCodeIds = [...assignments.data.values()].map((a) => a.qr_code_id);
        }
      }
    }

    let previous: QrPrintOptions["previous"] = null;
    if (qrCodeIds.length > 0) {
      const last = await QrPrintBatchesService.lastLayoutOf(supabase, ctx.orgId, qrCodeIds);
      if (last.success) previous = last.data;
    }

    const fallback = QrLabelTemplatesService.pickDefault(templates, targetType);
    return {
      success: true,
      data: {
        templates,
        previous,
        suggested: previous ? "previous" : (fallback?.id ?? null),
      },
    };
  } catch {
    return { success: false, error: "Unexpected error" };
  }
}
