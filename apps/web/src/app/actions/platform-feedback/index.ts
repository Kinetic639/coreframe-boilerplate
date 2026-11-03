"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { PlatformFeedbackService } from "@/server/services/platform-feedback.service";
import type { PaginatedResult } from "@/lib/data-view/types";
import {
  addFeedbackMessageSchema,
  createFeedbackSchema,
  listFeedbackSchema,
  updateFeedbackSchema,
  uploadedFeedbackFilesSchema,
  type FeedbackDetail,
  type FeedbackListRow,
  type FeedbackPriority,
  type FeedbackStatus,
  type ListFeedbackInput,
  type UploadedFeedbackFile,
} from "@/lib/platform-feedback/types";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

async function authed() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user ? { supabase, userId: user.id } : null;
}

/** A new report, with the page, organization and branch it was made in. Files follow. */
export async function createFeedbackAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string; number: number }>> {
  try {
    const parsed = createFeedbackSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID" };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };

    const dashboard = await loadDashboardContextV2().catch(() => null);
    return PlatformFeedbackService.create(ctx.supabase, {
      kind: parsed.data.kind,
      title: parsed.data.title,
      bodyPlain: parsed.data.bodyPlain,
      bodyRich: parsed.data.bodyRich,
      organizationId: dashboard?.app.activeOrgId ?? null,
      branchId: dashboard?.app.activeBranchId ?? null,
      context: {
        ...parsed.data.context,
        appVersion: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) ?? null,
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? null,
      },
    });
  } catch (error) {
    console.error("[createFeedbackAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}

/** An answer in the thread (an internal note only for the platform admin). Files follow. */
export async function addFeedbackMessageAction(
  rawInput: unknown
): Promise<ActionResult<{ id: string }>> {
  try {
    const parsed = addFeedbackMessageSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID" };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };
    return PlatformFeedbackService.addMessage(
      ctx.supabase,
      parsed.data as {
        feedbackId: string;
        bodyPlain: string;
        bodyRich: unknown;
        isInternal: boolean;
      }
    );
  } catch (error) {
    console.error("[addFeedbackMessageAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}

const registerFilesSchema = z.object({
  feedbackId: z.string().uuid(),
  messageId: z.string().uuid().nullable(),
  files: uploadedFeedbackFilesSchema,
});

/** Records files the browser uploaded into the report's folder. */
export async function registerFeedbackFilesAction(
  rawInput: unknown
): Promise<ActionResult<{ registered: number; rejected: string[] }>> {
  try {
    const parsed = registerFilesSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID" };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };
    return PlatformFeedbackService.registerFiles(
      ctx.supabase,
      parsed.data.feedbackId,
      parsed.data.messageId,
      parsed.data.files as UploadedFeedbackFile[]
    );
  } catch (error) {
    console.error("[registerFeedbackFilesAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}

/** Status / priority -- platform admin only (checked by the database). */
export async function updateFeedbackAction(rawInput: unknown): Promise<ActionResult<null>> {
  try {
    const parsed = updateFeedbackSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID" };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };
    return PlatformFeedbackService.update(
      ctx.supabase,
      parsed.data as { feedbackId: string; status?: FeedbackStatus; priority?: FeedbackPriority }
    );
  } catch (error) {
    console.error("[updateFeedbackAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}

export async function listFeedbackAction(
  rawInput: unknown
): Promise<ActionResult<PaginatedResult<FeedbackListRow>>> {
  try {
    const parsed = listFeedbackSchema.safeParse(rawInput);
    if (!parsed.success) return { success: false, error: "INVALID" };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };
    return PlatformFeedbackService.list(ctx.supabase, parsed.data as ListFeedbackInput);
  } catch (error) {
    console.error("[listFeedbackAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}

export async function getFeedbackAction(
  feedbackId: string
): Promise<ActionResult<FeedbackDetail | null>> {
  try {
    if (!z.string().uuid().safeParse(feedbackId).success) return { success: true, data: null };
    const ctx = await authed();
    if (!ctx) return { success: false, error: "UNAUTHORIZED" };
    return PlatformFeedbackService.get(ctx.supabase, feedbackId);
  } catch (error) {
    console.error("[getFeedbackAction]", error);
    return { success: false, error: "UNEXPECTED" };
  }
}
