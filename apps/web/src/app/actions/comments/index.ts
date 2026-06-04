"use server";

import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { addCommentSchema, listCommentsSchema } from "@/lib/validations/comments";
import { getCommentTargetDescriptor } from "@/server/comments/target-registry";
import {
  CommentsService,
  type AppComment,
  type PaginatedComments,
} from "@/server/services/comments.service";

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

function firstZodError(error: { errors?: Array<{ message: string }>; message: string }): string {
  return error.errors?.[0]?.message ?? error.message;
}

export async function listCommentsForTargetAction(
  rawInput: unknown
): Promise<ActionResult<PaginatedComments>> {
  try {
    const parsed = listCommentsSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const descriptor = getCommentTargetDescriptor(parsed.data.targetType);
    if (!descriptor) return { success: false, error: "Unsupported comment target type" };

    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    if (!checkPermission(ctx.context.user.permissionSnapshot, descriptor.requiredReadPermission)) {
      return { success: false, error: "Insufficient permissions" };
    }

    return CommentsService.listForTarget(ctx.supabase, ctx.orgId, parsed.data);
  } catch (error) {
    console.error("[listCommentsForTargetAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}

export async function addCommentAction(rawInput: unknown): Promise<ActionResult<AppComment>> {
  try {
    const parsed = addCommentSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: firstZodError(parsed.error) };

    const descriptor = getCommentTargetDescriptor(parsed.data.targetType);
    if (!descriptor) return { success: false, error: "Unsupported comment target type" };

    const ctx = await getAuthedContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    if (
      !checkPermission(ctx.context.user.permissionSnapshot, descriptor.requiredCommentPermission)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }

    if (
      parsed.data.visibility === "internal" &&
      descriptor.requiredModeratePermission &&
      !checkPermission(ctx.context.user.permissionSnapshot, descriptor.requiredModeratePermission)
    ) {
      return { success: false, error: "Insufficient permissions" };
    }

    return CommentsService.add(ctx.supabase, ctx.orgId, ctx.userId, parsed.data);
  } catch (error) {
    console.error("[addCommentAction] Unexpected error", error);
    return { success: false, error: "Unexpected error" };
  }
}
