import "server-only";

import { randomUUID } from "node:crypto";
import type { SupabaseClient } from "@supabase/supabase-js";
import {
  isAllowedAttachmentMimeType,
  MAX_ATTACHMENT_FILE_SIZE,
  type ListAttachmentsInput,
} from "@/lib/validations/attachments";
import {
  attachmentVariantPaths,
  isVariantPathOf,
  type AttachmentImageMeta,
} from "@/lib/attachments/image-variants";
import { getSharedAttachmentUrl } from "@/server/storage/attachment-signed-url";
import { createServiceClient } from "@/utils/supabase/service";
import {
  getCommentTargetDescriptor,
  type CommentTargetDescriptor,
} from "@/server/comments/target-registry";
import {
  OrgMemberPublicProfileService,
  type OrgMemberPublicProfile,
} from "./org-member-public-profile.service";
import type { ServiceResult } from "./organization.service";

const ATTACHMENTS_BUCKET = "app-attachments";

export interface AppAttachmentAuthor {
  user_id: string;
  name: string;
  email: string | null;
  avatar_url: string | null;
  profile_href: string | null;
}

export interface AppAttachment {
  id: string;
  org_id: string;
  target_type: string;
  target_id: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  metadata: Record<string, unknown>;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
  download_url: string | null;
  author: AppAttachmentAuthor | null;
  is_own: boolean;
}

type AppAttachmentRow = {
  id: string;
  org_id: string;
  target_type: string;
  target_id: string;
  bucket_id: string;
  storage_path: string;
  file_name: string;
  content_type: string;
  size_bytes: number;
  metadata: Record<string, unknown> | null;
  created_by: string;
  created_at: string;
  deleted_at: string | null;
};

function mapTargetError(error?: "NOT_FOUND" | "WRONG_ORG" | "SOFT_DELETED" | "UNSUPPORTED_TYPE") {
  switch (error) {
    case "WRONG_ORG":
      return "Attachment target does not belong to the active organization";
    case "SOFT_DELETED":
      return "Attachment target is no longer available";
    case "UNSUPPORTED_TYPE":
      return "Unsupported attachment target type";
    case "NOT_FOUND":
    default:
      return "Attachment target not found";
  }
}

async function validateTarget(
  descriptor: CommentTargetDescriptor,
  supabase: SupabaseClient,
  orgId: string,
  targetId: string
): Promise<ServiceResult<null>> {
  const validation = await descriptor.validate({ supabase, orgId, targetId });
  if (!validation.valid) {
    return { success: false, error: mapTargetError(validation.error) };
  }
  return { success: true, data: null };
}

function sanitizeFileName(name: string): string {
  const trimmed = name.trim() || "attachment";
  return trimmed.replace(/[^\w.\-()[\] ]+/g, "_").slice(0, 180);
}

function extensionFromName(name: string): string {
  const match = /\.([a-zA-Z0-9]{1,12})$/.exec(name);
  return match ? `.${match[1].toLowerCase()}` : "";
}

function buildStoragePath(orgId: string, userId: string, file: File): string {
  const safeName = sanitizeFileName(file.name);
  const extension = extensionFromName(safeName);
  return `${orgId}/${userId}/${randomUUID()}${extension}`;
}

export interface UploadedAttachmentFile {
  storagePath: string;
  fileName: string;
  contentType: string;
  size: number;
  image?: {
    width: number;
    height: number;
    variants: Array<{
      name: "thumb" | "card";
      path: string;
      width: number;
      height: number;
      size: number;
      contentType: string;
    }>;
  };
}

/** Image size and small versions to keep in app_attachments.metadata. */
function imageMetadata(file: UploadedAttachmentFile): AttachmentImageMeta | null {
  if (!file.image || !file.contentType.startsWith("image/")) return null;
  const variants: AttachmentImageMeta["variants"] = {};
  for (const variant of file.image.variants) {
    variants[variant.name] = {
      path: variant.path,
      width: variant.width,
      height: variant.height,
      size: variant.size,
      content_type: variant.contentType,
    };
  }
  return { width: file.image.width, height: file.image.height, variants };
}

function profileMap(profiles: OrgMemberPublicProfile[]): Map<string, OrgMemberPublicProfile> {
  return new Map(profiles.map((profile) => [profile.user_id, profile]));
}

/**
 * A link to a file from a row the caller already read under row-level security
 * (the same rule as the storage policy). The link is shared for 50 minutes, so
 * lists do not sign every file again on each load and the storage CDN can
 * serve repeat views from cache.
 */
function signedUrl(_supabase: SupabaseClient, storagePath: string): Promise<string | null> {
  return getSharedAttachmentUrl(storagePath);
}

async function enrichRows(
  supabase: SupabaseClient,
  orgId: string,
  rows: AppAttachmentRow[],
  currentUserId: string,
  options: { includeSignedUrls?: boolean } = {}
): Promise<ServiceResult<AppAttachment[]>> {
  const authorIds = Array.from(new Set(rows.map((row) => row.created_by).filter(Boolean)));
  const [profilesResult, signedUrls] = await Promise.all([
    OrgMemberPublicProfileService.listProfiles(supabase, orgId, authorIds),
    options.includeSignedUrls
      ? Promise.all(rows.map((row) => signedUrl(supabase, row.storage_path)))
      : Promise.resolve(rows.map(() => null)),
  ]);
  if (!profilesResult.success) return profilesResult as { success: false; error: string };

  const profilesById = profileMap(profilesResult.data);

  return {
    success: true,
    data: rows.map((row, index) => {
      const profile = profilesById.get(row.created_by);
      return {
        ...row,
        metadata: row.metadata ?? {},
        download_url: signedUrls[index] ?? null,
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
        is_own: row.created_by === currentUserId,
      };
    }),
  };
}

function validateFile(file: File): string | null {
  if (file.size <= 0) return "Empty files cannot be attached";
  if (file.size > MAX_ATTACHMENT_FILE_SIZE) return "File is too large";
  if (!isAllowedAttachmentMimeType(file.type)) return "File type is not allowed";
  return null;
}

export class AttachmentsService {
  static async getById(
    supabase: SupabaseClient,
    orgId: string,
    currentUserId: string,
    attachmentId: string
  ): Promise<ServiceResult<AppAttachment>> {
    const { data, error } = await supabase
      .from("app_attachments")
      .select(
        [
          "id, org_id, target_type, target_id, bucket_id, storage_path, file_name, content_type,",
          "size_bytes, metadata, created_by, created_at, deleted_at",
        ].join("")
      )
      .eq("org_id", orgId)
      .eq("id", attachmentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (error) return { success: false, error: error.message };
    if (!data) return { success: false, error: "Attachment not found" };

    const row = data as unknown as AppAttachmentRow;
    const descriptor = getCommentTargetDescriptor(row.target_type);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, row.target_id);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const enriched = await enrichRows(supabase, orgId, [row], currentUserId, {
      includeSignedUrls: true,
    });
    if (!enriched.success) {
      return {
        success: false,
        error: (enriched as { success: false; error: string }).error,
      };
    }

    return { success: true, data: enriched.data[0] };
  }

  static async listForTarget(
    supabase: SupabaseClient,
    orgId: string,
    currentUserId: string,
    input: ListAttachmentsInput
  ): Promise<ServiceResult<AppAttachment[]>> {
    const descriptor = getCommentTargetDescriptor(input.targetType);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, input.targetId);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const { data, error } = await supabase
      .from("app_attachments")
      .select(
        [
          "id, org_id, target_type, target_id, bucket_id, storage_path, file_name, content_type,",
          "size_bytes, metadata, created_by, created_at, deleted_at",
        ].join("")
      )
      .eq("org_id", orgId)
      .eq("target_type", input.targetType)
      .eq("target_id", input.targetId)
      .is("deleted_at", null)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false });

    if (error) return { success: false, error: error.message };
    return enrichRows(
      supabase,
      orgId,
      (data ?? []) as unknown as AppAttachmentRow[],
      currentUserId
    );
  }

  static async uploadForTarget(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: ListAttachmentsInput,
    files: File[]
  ): Promise<ServiceResult<AppAttachment[]>> {
    const descriptor = getCommentTargetDescriptor(input.targetType);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, input.targetId);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const invalid = files.map(validateFile).find(Boolean);
    if (invalid) return { success: false, error: invalid };

    const rows: AppAttachmentRow[] = [];

    for (const file of files) {
      const storagePath = buildStoragePath(orgId, userId, file);
      const { error: uploadError } = await supabase.storage
        .from(ATTACHMENTS_BUCKET)
        .upload(storagePath, file, {
          contentType: file.type,
          upsert: false,
        });

      if (uploadError) return { success: false, error: uploadError.message };

      const { data, error: insertError } = await supabase
        .from("app_attachments")
        .insert({
          org_id: orgId,
          target_type: input.targetType,
          target_id: input.targetId,
          bucket_id: ATTACHMENTS_BUCKET,
          storage_path: storagePath,
          file_name: sanitizeFileName(file.name),
          content_type: file.type,
          size_bytes: file.size,
          created_by: userId,
          metadata: {
            original_name: file.name,
          },
        })
        .select(
          [
            "id, org_id, target_type, target_id, bucket_id, storage_path, file_name, content_type,",
            "size_bytes, metadata, created_by, created_at, deleted_at",
          ].join("")
        )
        .single();

      if (insertError) {
        await supabase.storage.from(ATTACHMENTS_BUCKET).remove([storagePath]);
        return { success: false, error: insertError.message };
      }

      const row = data as unknown as AppAttachmentRow;
      rows.push(row);

      await descriptor.afterAttachmentCreated?.({
        supabase,
        orgId,
        targetId: input.targetId,
        actorId: userId,
        attachmentId: row.id,
        fileName: row.file_name,
      });
    }

    return enrichRows(supabase, orgId, rows, userId);
  }

  /**
   * Files the browser already put into storage itself (one request per file,
   * so no request-size limit of the server gets in the way). Each path must be
   * in the caller's own folder of this organization, which is also what the
   * storage policy allowed them to upload to.
   */
  static async registerUploaded(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    input: ListAttachmentsInput,
    files: UploadedAttachmentFile[]
  ): Promise<ServiceResult<AppAttachment[]>> {
    const descriptor = getCommentTargetDescriptor(input.targetType);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, input.targetId);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    const ownFolder = new RegExp(`^${orgId}/${userId}/[0-9a-f-]{36}(\\.[a-z0-9]{1,12})?$`);
    for (const file of files) {
      if (!ownFolder.test(file.storagePath)) return { success: false, error: "Invalid file path" };
      if (file.size <= 0) return { success: false, error: "Empty files cannot be attached" };
      if (file.size > MAX_ATTACHMENT_FILE_SIZE)
        return { success: false, error: "File is too large" };
      if (!isAllowedAttachmentMimeType(file.contentType)) {
        return { success: false, error: "File type is not allowed" };
      }
      // Small versions must sit next to the file itself (same folder, same name).
      for (const variant of file.image?.variants ?? []) {
        if (!isVariantPathOf(file.storagePath, variant.path, variant.name)) {
          return { success: false, error: "Invalid file path" };
        }
      }
    }

    const rows: AppAttachmentRow[] = [];
    for (const file of files) {
      const { data, error } = await supabase
        .from("app_attachments")
        .insert({
          org_id: orgId,
          target_type: input.targetType,
          target_id: input.targetId,
          bucket_id: ATTACHMENTS_BUCKET,
          storage_path: file.storagePath,
          file_name: sanitizeFileName(file.fileName),
          content_type: file.contentType,
          size_bytes: file.size,
          created_by: userId,
          metadata: { original_name: file.fileName, ...imageMetadata(file) },
        })
        .select(
          [
            "id, org_id, target_type, target_id, bucket_id, storage_path, file_name, content_type,",
            "size_bytes, metadata, created_by, created_at, deleted_at",
          ].join("")
        )
        .single();

      if (error) return { success: false, error: error.message };

      const row = data as unknown as AppAttachmentRow;
      rows.push(row);

      await descriptor.afterAttachmentCreated?.({
        supabase,
        orgId,
        targetId: input.targetId,
        actorId: userId,
        attachmentId: row.id,
        fileName: row.file_name,
      });
    }

    return enrichRows(supabase, orgId, rows, userId, { includeSignedUrls: true });
  }

  static async softDelete(
    supabase: SupabaseClient,
    orgId: string,
    userId: string,
    attachmentId: string
  ): Promise<ServiceResult<{ id: string }>> {
    const { data: existing, error: existingError } = await supabase
      .from("app_attachments")
      .select("id, org_id, target_type, target_id, storage_path, metadata, created_by, deleted_at")
      .eq("org_id", orgId)
      .eq("id", attachmentId)
      .is("deleted_at", null)
      .maybeSingle();

    if (existingError) return { success: false, error: existingError.message };
    if (!existing) return { success: false, error: "Attachment not found" };

    const row = existing as {
      id: string;
      target_type: string;
      target_id: string;
      storage_path: string;
      metadata: unknown;
      created_by: string;
    };
    const descriptor = getCommentTargetDescriptor(row.target_type);
    if (!descriptor) return { success: false, error: "Unsupported attachment target type" };

    const targetResult = await validateTarget(descriptor, supabase, orgId, row.target_id);
    if (!targetResult.success) return targetResult as { success: false; error: string };

    // A plain UPDATE of deleted_at fails RLS (the SELECT policy hides deleted rows), so the
    // soft delete goes through soft_delete_app_attachment (migration 20261007063558), which
    // checks author-or-moderator itself and returns the storage path. Not in the generated
    // types yet, hence the narrowed rpc signature. (deleted_by is set from auth.uid() there.)
    void userId;
    const rpc = supabase.rpc as unknown as (
      fn: "soft_delete_app_attachment",
      args: { p_attachment_id: string }
    ) => Promise<{ data: string | null; error: { message: string } | null }>;
    const { data: path, error } = await rpc.call(supabase, "soft_delete_app_attachment", {
      p_attachment_id: attachmentId,
    });

    if (error) return { success: false, error: error.message };

    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path ?? row.storage_path]);
    // The small versions have no row of their own, so the storage policy does not
    // let the user remove them; the soft delete above already checked the right to.
    const variantPaths = attachmentVariantPaths(row.storage_path, row.metadata);
    if (variantPaths.length > 0) {
      const { error: variantError } = await createServiceClient()
        .storage.from(ATTACHMENTS_BUCKET)
        .remove(variantPaths);
      if (variantError) {
        console.error("[AttachmentsService.softDelete] Failed to remove image versions", {
          attachmentId,
          error: variantError.message,
        });
      }
    }
    return { success: true, data: { id: attachmentId } };
  }
}
