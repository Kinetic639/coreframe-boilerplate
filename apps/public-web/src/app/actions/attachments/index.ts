"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  deleteAttachmentSchema,
  listAttachmentsSchema,
  MAX_ATTACHMENT_BATCH_SIZE,
  type ListAttachmentsInput,
} from "@/lib/validations/attachments";
import { getCommentTargetDescriptor } from "@/server/comments/target-registry";
import { AttachmentsService, type AppAttachment } from "@/server/services/attachments.service";

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

function firstZodError(error: { issues?: Array<{ message: string }>; message: string }): string {
  return error.issues?.[0]?.message ?? error.message;
}

function filesFromFormData(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter(
      (value): value is File =>
        typeof value === "object" &&
        value !== null &&
        "name" in value &&
        "size" in value &&
        "type" in value &&
        typeof value.size === "number" &&
        value.size > 0
    )
    .slice(0, MAX_ATTACHMENT_BATCH_SIZE);
}

export async function listAttachmentsForTargetAction(
  rawInput: unknown
): Promise<ActionResult<AppAttachment[]>> {
  try {
    const parsed = listAttachmentsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const descriptor = getCommentTargetDescriptor(parsed.data.targetType);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    if (!checkPermission(ctx.context.user.permissionSnapshot, descriptor.requiredReadPermission)) {
      return { success: false, error: "Insufficient permissions" };
    }

    return AttachmentsService.listForTarget(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    console.error("[listAttachmentsForTargetAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function uploadAttachmentsAction(
  formData: FormData
): Promise<ActionResult<AppAttachment[]>> {
  try {
    const rawInput: ListAttachmentsInput = {
      targetType: String(formData.get("targetType") ?? ""),
      targetId: String(formData.get("targetId") ?? ""),
    };
    const parsed = listAttachmentsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const descriptor = getCommentTargetDescriptor(parsed.data.targetType);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const attachPermission =
      descriptor.requiredAttachmentPermission ?? descriptor.requiredCommentPermission;
    if (!checkPermission(ctx.context.user.permissionSnapshot, attachPermission)) {
      return { success: false, error: "Insufficient permissions" };
    }

    const files = filesFromFormData(formData);
    if (files.length === 0) return { success: false, error: "No files selected" };

    return AttachmentsService.uploadForTarget(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      parsed.data,
      files
    );
  } catch (error) {
    console.error("[uploadAttachmentsAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function deleteAttachmentAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = deleteAttachmentSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    return AttachmentsService.softDelete(
      ctx.supabase,
      ctx.orgId,
      ctx.userId,
      parsed.data.attachmentId
    );
  } catch (error) {
    console.error("[deleteAttachmentAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}
