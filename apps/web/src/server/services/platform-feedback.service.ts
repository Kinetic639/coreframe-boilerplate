import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import type { PaginatedResult } from "@/lib/data-view/types";
import {
  isAllowedFeedbackFile,
  type FeedbackAttachment,
  type FeedbackContext,
  type FeedbackDetail,
  type FeedbackKind,
  type FeedbackListRow,
  type FeedbackPriority,
  type FeedbackStatus,
  type ListFeedbackInput,
  type UploadedFeedbackFile,
} from "@/lib/platform-feedback/types";
import type { ServiceResult } from "./organization.service";

const BUCKET = "platform-feedback";
const SIGNED_URL_TTL_SECONDS = 60 * 60;

function dbError(scope: string, error: { message?: string; code?: string } | null): string {
  console.error(`[PlatformFeedbackService.${scope}]`, error);
  if (error?.code === "42501") return "FORBIDDEN";
  if (error?.code === "P0002") return "NOT_FOUND";
  return "UNEXPECTED";
}

/**
 * Reports to the platform admin. Every read and write runs as the signed-in
 * user: the database decides who sees what (reporter: own reports without
 * internal notes; platform admin: everything).
 */
export class PlatformFeedbackService {
  static async list(
    supabase: SupabaseClient,
    input: ListFeedbackInput
  ): Promise<ServiceResult<PaginatedResult<FeedbackListRow>>> {
    const { data, error } = await supabase.rpc("platform_feedback_list", {
      p_scope: input.scope,
      p_search: input.search?.trim() || null,
      p_status: input.statuses?.length ? input.statuses : null,
      p_kind: input.kind ?? null,
      p_priority: input.priority ?? null,
      p_limit: input.pageSize,
      p_offset: (input.page - 1) * input.pageSize,
    });
    if (error) return { success: false, error: dbError("list", error) };
    const result = data as { rows: FeedbackListRow[]; total: number };
    return {
      success: true,
      data: {
        rows: result.rows,
        totalCount: Number(result.total),
        page: input.page,
        pageSize: input.pageSize,
      },
    };
  }

  static async get(
    supabase: SupabaseClient,
    feedbackId: string
  ): Promise<ServiceResult<FeedbackDetail | null>> {
    const { data, error } = await supabase.rpc("platform_feedback_get", {
      p_feedback_id: feedbackId,
    });
    if (error) return { success: false, error: dbError("get", error) };
    if (!data) return { success: true, data: null };

    const detail = data as Omit<FeedbackDetail, "attachments"> & {
      attachments: Omit<FeedbackAttachment, "url">[];
    };
    const paths = detail.attachments.map((a) => a.storage_path);
    const urls = new Map<string, string>();
    if (paths.length > 0) {
      const { data: signed } = await supabase.storage
        .from(BUCKET)
        .createSignedUrls(paths, SIGNED_URL_TTL_SECONDS);
      for (const item of signed ?? []) {
        if (item.path && item.signedUrl) urls.set(item.path, item.signedUrl);
      }
    }
    return {
      success: true,
      data: {
        ...detail,
        context: (detail.context ?? {}) as FeedbackContext,
        attachments: detail.attachments.map((a) => ({
          ...a,
          url: urls.get(a.storage_path) ?? null,
        })),
      },
    };
  }

  static async create(
    supabase: SupabaseClient,
    input: {
      kind: FeedbackKind;
      title: string;
      bodyPlain: string;
      bodyRich: unknown;
      organizationId: string | null;
      branchId: string | null;
      context: FeedbackContext;
    }
  ): Promise<ServiceResult<{ id: string; number: number }>> {
    const { data, error } = await supabase.rpc("platform_feedback_create", {
      p_kind: input.kind,
      p_title: input.title,
      p_body_plain: input.bodyPlain,
      p_body_rich: input.bodyRich ?? null,
      p_organization_id: input.organizationId,
      p_branch_id: input.branchId,
      p_context: input.context,
    });
    if (error) return { success: false, error: dbError("create", error) };
    return { success: true, data: data as { id: string; number: number } };
  }

  static async addMessage(
    supabase: SupabaseClient,
    input: { feedbackId: string; bodyPlain: string; bodyRich: unknown; isInternal: boolean }
  ): Promise<ServiceResult<{ id: string }>> {
    const { data, error } = await supabase.rpc("platform_feedback_add_message", {
      p_feedback_id: input.feedbackId,
      p_body_plain: input.bodyPlain,
      p_body_rich: input.bodyRich ?? null,
      p_is_internal: input.isInternal,
    });
    if (error) return { success: false, error: dbError("addMessage", error) };
    return { success: true, data: data as { id: string } };
  }

  static async update(
    supabase: SupabaseClient,
    input: { feedbackId: string; status?: FeedbackStatus; priority?: FeedbackPriority }
  ): Promise<ServiceResult<null>> {
    const { error } = await supabase.rpc("platform_feedback_update", {
      p_feedback_id: input.feedbackId,
      p_status: input.status ?? null,
      p_priority: input.priority ?? null,
    });
    if (error) return { success: false, error: dbError("update", error) };
    return { success: true, data: null };
  }

  /**
   * Records files the browser already uploaded into the report's folder
   * (on the report, or on a message). The database checks the folder and
   * access; the storage policy checked the upload.
   */
  static async registerFiles(
    supabase: SupabaseClient,
    feedbackId: string,
    messageId: string | null,
    files: UploadedFeedbackFile[]
  ): Promise<ServiceResult<{ registered: number; rejected: string[] }>> {
    let registered = 0;
    const rejected: string[] = [];
    for (const file of files) {
      if (!isAllowedFeedbackFile(file) || !file.path.startsWith(`${feedbackId}/`)) {
        rejected.push(file.name);
        continue;
      }
      const { error } = await supabase.rpc("platform_feedback_add_attachment", {
        p_feedback_id: feedbackId,
        p_message_id: messageId,
        p_storage_path: file.path,
        p_file_name: file.name,
        p_content_type: file.type,
        p_size_bytes: file.size,
      });
      if (error) {
        console.error("[PlatformFeedbackService.registerFiles]", error);
        rejected.push(file.name);
        continue;
      }
      registered += 1;
    }
    return { success: true, data: { registered, rejected } };
  }
}
