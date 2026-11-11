import { randomUUID } from "node:crypto";
import type { PortalSupabase } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import { TICKET_TARGET } from "./requests.service";
import type { RequestAttachment, ServiceResult } from "./types";

export const ATTACHMENTS_BUCKET = "app-attachments";
/** Mirrors apps/web lib/validations/attachments.ts, capped by the 10 MB server-action body limit. */
export const MAX_ATTACHMENT_BYTES = 10 * 1024 * 1024;
export const ALLOWED_ATTACHMENT_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
  "application/pdf",
] as const;
const SIGNED_URL_TTL_SECONDS = 60 * 60;

export async function listAttachments(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string
): Promise<ServiceResult<RequestAttachment[]>> {
  const { data, error } = await supabase
    .from("app_attachments")
    .select(
      "id, storage_path, file_name, content_type, size_bytes, metadata, created_by, created_at"
    )
    .eq("org_id", ctx.org.id)
    .eq("target_type", TICKET_TARGET)
    .eq("target_id", ticketId)
    .is("deleted_at", null)
    .order("created_at", { ascending: true });
  if (error) return { ok: false, error: error.message };

  const rows = data ?? [];
  const { data: signed } = rows.length
    ? await supabase.storage.from(ATTACHMENTS_BUCKET).createSignedUrls(
        rows.map((r) => r.storage_path),
        SIGNED_URL_TTL_SECONDS
      )
    : { data: [] };
  const urlByPath = new Map((signed ?? []).map((s) => [s.path, s.signedUrl]));

  return {
    ok: true,
    data: rows.map((r) => ({
      id: r.id,
      commentId:
        typeof (r.metadata as Record<string, unknown> | null)?.comment_id === "string"
          ? ((r.metadata as Record<string, unknown>).comment_id as string)
          : null,
      isMine: r.created_by === ctx.user.id,
      fileName: r.file_name,
      contentType: r.content_type,
      sizeBytes: Number(r.size_bytes),
      url: urlByPath.get(r.storage_path) ?? null,
      createdAt: r.created_at,
    })),
  };
}

function extensionOf(name: string): string {
  const m = /\.([a-z0-9]{1,8})$/i.exec(name);
  return m ? `.${m[1]!.toLowerCase()}` : "";
}

/** Same storage layout as Ambra ({org}/{user}/{uuid}.ext) so its Help Desk shows the file too. */
export async function uploadAttachment(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string,
  file: File,
  opts: { commentId?: string } = {}
): Promise<ServiceResult<{ id: string }>> {
  if (file.size === 0) return { ok: false, error: "empty" };
  if (file.size > MAX_ATTACHMENT_BYTES) return { ok: false, error: "too_large" };
  if (!(ALLOWED_ATTACHMENT_TYPES as readonly string[]).includes(file.type)) {
    return { ok: false, error: "type" };
  }

  const path = `${ctx.org.id}/${ctx.user.id}/${randomUUID()}${extensionOf(file.name)}`;
  const { error: upError } = await supabase.storage
    .from(ATTACHMENTS_BUCKET)
    .upload(path, file, { contentType: file.type, upsert: false });
  if (upError) return { ok: false, error: upError.message };

  const { data, error } = await supabase
    .from("app_attachments")
    .insert({
      org_id: ctx.org.id,
      target_type: TICKET_TARGET,
      target_id: ticketId,
      bucket_id: ATTACHMENTS_BUCKET,
      storage_path: path,
      file_name: file.name.slice(0, 200),
      content_type: file.type,
      size_bytes: file.size,
      metadata: opts.commentId ? { comment_id: opts.commentId } : {},
      created_by: ctx.user.id,
    })
    .select("id")
    .single();
  if (error) {
    await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
    return { ok: false, error: error.message };
  }

  await supabase.from("helpdesk_ticket_activity").insert({
    ticket_id: ticketId,
    org_id: ctx.org.id,
    actor_id: ctx.user.id,
    event_type: "attachment_added",
    payload: { file_name: file.name, attachment_id: data.id },
  });
  return { ok: true, data: { id: data.id } };
}

/** Author removes their own file (soft delete + storage object), like Ambra's softDelete. */
export async function deleteOwnAttachment(
  supabase: PortalSupabase,
  ctx: PortalContext,
  attachmentId: string
): Promise<ServiceResult<null>> {
  // Only the author's own files from the portal (moderation stays in Ambra).
  const { data: row } = await supabase
    .from("app_attachments")
    .select("id")
    .eq("id", attachmentId)
    .eq("org_id", ctx.org.id)
    .eq("target_type", TICKET_TARGET)
    .eq("created_by", ctx.user.id)
    .is("deleted_at", null)
    .maybeSingle();
  if (!row) return { ok: false, error: "not_found" };

  // A plain UPDATE of deleted_at fails RLS (the SELECT policy hides deleted rows), hence the
  // soft_delete_app_attachment function (migration 20261007063558). It returns the storage path.
  // Not in the generated types yet, hence the narrowed rpc signature.
  const rpc = supabase.rpc as unknown as (
    fn: "soft_delete_app_attachment",
    args: { p_attachment_id: string }
  ) => Promise<{ data: string | null; error: { message: string } | null }>;
  const { data: path, error } = await rpc.call(supabase, "soft_delete_app_attachment", {
    p_attachment_id: attachmentId,
  });
  if (error) return { ok: false, error: error.message };
  if (path) await supabase.storage.from(ATTACHMENTS_BUCKET).remove([path]);
  return { ok: true, data: null };
}
