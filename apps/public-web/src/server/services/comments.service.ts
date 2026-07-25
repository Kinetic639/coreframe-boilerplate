import "server-only";

import type { SupabaseClient } from "@supabase/supabase-js";
import {
  type AddCommentInput,
  type CommentVisibility,
  type ListCommentsInput,
  normalizeCommentRichText,
} from "@/lib/validations/comments";
import {
  getCommentTargetDescriptor,
  type CommentTargetDescriptor,
} from "@/server/comments/target-registry";
import {
  OrgMemberPublicProfileService,
  type OrgMemberPublicProfile,
} from "./org-member-public-profile.service";
import type { ServiceResult } from "./organization.service";

export interface AppCommentAuthor {
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  profile_href: string | null;
}

export interface AppComment {
  id: string;
  org_id: string;
  target_type: string;
  target_id: string;
  body_plain: string;
  body_rich: unknown | null;
  visibility: CommentVisibility;
  kind: "comment" | "system";
  parent_comment_id: string | null;
  metadata: Record<string, unknown>;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
  author: AppCommentAuthor | null;
  is_own: boolean;
}

export interface PaginatedComments {
  rows: AppComment[];
  totalCount: number;
  nextCursor: string | null;
}

type AppCommentRow = {
  id: string;
  org_id: string;
  target_type: string;
  target_id: string;
  body_plain: string;
  body_rich: unknown | null;
  visibility: CommentVisibility;
  kind: "comment" | "system";
  parent_comment_id: string | null;
  metadata: Record<string, unknown> | null;
  created_by: string;
  updated_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
};

async function getCurrentUserId(supabase: SupabaseClient): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

function mapValidationError(error?: CommentTargetValidationResultError): string {
  switch (error) {
    case "WRONG_ORG":
      return "Comment target does not belong to the active organization";
    case "SOFT_DELETED":
      return "Comment target is no longer available";
    case "UNSUPPORTED_TYPE":
      return "Unsupported comment target type";
    case "NOT_FOUND":
    default:
      return "Comment target not found";
  }
}

type CommentTargetValidationResultError =
  | "NOT_FOUND"
  | "WRONG_ORG"
  | "SOFT_DELETED"
  | "UNSUPPORTED_TYPE";

async function validateTarget(
  descriptor: CommentTargetDescriptor,
  supabase: SupabaseClient,
  orgId: string,
  targetId: string
): Promise<ServiceResult<null>> {
  const validation = await descriptor.validate({ supabase, orgId, targetId });
  if (!validation.valid) {
    return { success: false, error: mapValidationError(validation.error) };
  }
  return { success: true, data: null };
}

function profileMap(profiles: OrgMemberPublicProfile[]): Map<string, OrgMemberPublicProfile> {
  return new Map(profiles.map((profile) => [profile.user_id, profile]));
}

function encodeCursor(row: AppCommentRow | undefined): string | null {
  if (!row) return null;
  return `${row.created_at}|${row.id}`;
}

function decodeCursor(cursor: string | undefined): { createdAt: string; id: string } | null {
  if (!cursor) return null;
  const [createdAt, id] = cursor.split("|");
  if (!createdAt || !id) return null;
  return { createdAt, id };
}

async function enrichRows(
  supabase: SupabaseClient,
  orgId: string,
  rows: AppCommentRow[],
  currentUserId: string | null
): Promise<ServiceResult<AppComment[]>> {
  const authorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const profilesResult = await OrgMemberPublicProfileService.listProfiles(
    supabase,
    orgId,
    authorIds
  );
  if (!profilesResult.success) return profilesResult as { success: false; error: string };

  const profilesById = profileMap(profilesResult.data);

  return {
    success: true,
    data: rows.map((row) => {
      const profile = profilesById.get(row.created_by);
      return {
        ...row,
        metadata: row.metadata ?? {},
        author: profile
          ? {
              user_id: profile.user_id,
              name: profile.display_name,
              email: profile.email,
              avatar_url: profile.avatar_url,
              profile_href: profile.profile_href,
            }
          : {
              user_id: row.created_by,
              name: "Former member",
              email: null,
              avatar_url: null,
              profile_href: null,
            },
        is_own: Boolean(currentUserId && row.created_by === currentUserId),
      };
    }),
  };
}

export class CommentsService {
  static async listForTarget(
    supabase: SupabaseClient,
    orgId: string,
    input: ListCommentsInput
  ): Promise<ServiceResult<PaginatedComments>> {
    const descriptor = getCommentTargetDescriptor(input.targetType);
    if (!descriptor) return { success: false, error: "Unsupported comment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, input.targetId);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const currentUserId = await getCurrentUserId(supabase);
    const pageSize = input.pageSize;

    let query = supabase
      .from("app_comments")
      .select(
        [
          "id, org_id, target_type, target_id, body_plain, body_rich, visibility, kind,",
          "parent_comment_id, metadata, created_by, updated_by, created_at, updated_at, deleted_at",
        ].join("")
      )
      .eq("org_id", orgId)
      .eq("target_type", input.targetType)
      .eq("target_id", input.targetId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true })
      .order("id", { ascending: true })
      .limit(pageSize + 1);

    const cursor = decodeCursor(input.cursor);
    if (cursor) {
      query = query.or(
        `created_at.gt.${cursor.createdAt},and(created_at.eq.${cursor.createdAt},id.gt.${cursor.id})`
      );
    }

    const countQuery = supabase
      .from("app_comments")
      .select("id", { count: "exact", head: true })
      .eq("org_id", orgId)
      .eq("target_type", input.targetType)
      .eq("target_id", input.targetId)
      .is("deleted_at", null);

    const [{ data, error }, { count, error: countError }] = await Promise.all([query, countQuery]);

    if (error) return { success: false, error: error.message };
    if (countError) return { success: false, error: countError.message };

    const rows = ((data ?? []) as unknown as AppCommentRow[]).slice(0, pageSize);
    const hasMore = (data ?? []).length > pageSize;
    const enriched = await enrichRows(supabase, orgId, rows, currentUserId);
    if (!enriched.success) return enriched as { success: false; error: string };

    return {
      success: true,
      data: {
        rows: enriched.data,
        totalCount: count ?? enriched.data.length,
        nextCursor: hasMore ? encodeCursor(rows[rows.length - 1]) : null,
      },
    };
  }

  static async add(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: AddCommentInput
  ): Promise<ServiceResult<AppComment>> {
    const descriptor = getCommentTargetDescriptor(input.targetType);
    if (!descriptor) return { success: false, error: "Unsupported comment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, input.targetId);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const bodyRich = normalizeCommentRichText(input.bodyRich);
    if (input.bodyRich !== undefined && input.bodyRich !== null && !bodyRich) {
      return { success: false, error: "Comment rich text contains unsupported content" };
    }

    const { data, error } = await supabase
      .from("app_comments")
      .insert({
        org_id: orgId,
        target_type: input.targetType,
        target_id: input.targetId,
        body_plain: input.bodyPlain,
        body_rich: bodyRich,
        visibility: input.visibility,
        kind: "comment",
        created_by: userId,
      })
      .select(
        [
          "id, org_id, target_type, target_id, body_plain, body_rich, visibility, kind,",
          "parent_comment_id, metadata, created_by, updated_by, created_at, updated_at, deleted_at",
        ].join("")
      )
      .single();

    if (error) return { success: false, error: error.message };

    const enriched = await enrichRows(supabase, orgId, [data as unknown as AppCommentRow], userId);
    if (!enriched.success) return enriched as { success: false; error: string };

    if (descriptor.afterCommentCreated) {
      await descriptor.afterCommentCreated({
        supabase,
        orgId,
        targetId: input.targetId,
        actorId: userId,
        visibility: input.visibility,
      });
    }

    return { success: true, data: enriched.data[0] };
  }
}
