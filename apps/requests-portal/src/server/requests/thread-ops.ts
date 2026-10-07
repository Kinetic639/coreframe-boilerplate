import { z } from "zod";
import { extractPlainText, normalizeRichText } from "@repo/rich-text/rich-text-utils";
import { commentSchema, LIMITS } from "@/lib/validation/requests";
import type { PortalContext } from "@/server/portal-context";
import { createClient } from "@/utils/supabase/server";
import { deleteOwnAttachment, listAttachments, uploadAttachment } from "./attachments.service";
import { addComment, listComments, updateOwnComment } from "./comments.service";
import type { RequestAttachment, RequestComment } from "./types";

/**
 * Thread mutations behind the /api/requests route handlers. They are plain fetch endpoints
 * on purpose: a Server Action whose response sets a cookie (next-intl locale, Supabase token
 * refresh) makes Next re-render the whole route, which reset scroll and showed skeletons.
 */

export type ThreadData = { comments: RequestComment[]; attachments: RequestAttachment[] };
export type OpResult = { ok: true } | { ok: false; error: string };

function filesFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, LIMITS.maxFiles);
}

function richFrom(raw: string | undefined) {
  if (!raw) return null;
  try {
    return normalizeRichText(JSON.parse(raw));
  } catch {
    return undefined;
  }
}

export async function loadThread(ctx: PortalContext, ticketId: string): Promise<ThreadData | null> {
  const supabase = await createClient();
  const [comments, attachments] = await Promise.all([
    listComments(supabase, ctx, ticketId),
    listAttachments(supabase, ctx, ticketId),
  ]);
  if (!comments.ok || !attachments.ok) return null;
  return { comments: comments.data, attachments: attachments.data };
}

/** New public reply; files sent with it are tied to the comment (metadata.comment_id). */
export async function postComment(
  ctx: PortalContext,
  ticketId: string,
  formData: FormData
): Promise<OpResult> {
  const parsed = commentSchema.safeParse({
    ticketId,
    body: formData.get("body")?.toString() ?? "",
    bodyRich: formData.get("bodyRich")?.toString() || undefined,
  });
  if (!parsed.success) return { ok: false, error: "empty" };
  const rich = richFrom(parsed.data.bodyRich);
  if (rich === undefined) return { ok: false, error: "empty" };
  const body = (rich ? extractPlainText(rich) : parsed.data.body).slice(0, LIMITS.bodyMax);
  const files = filesFrom(formData);
  if (!body && files.length === 0) return { ok: false, error: "empty" };

  const supabase = await createClient();
  let commentId: string | undefined;
  if (body) {
    const res = await addComment(supabase, ctx, ticketId, body, rich ?? undefined);
    if (!res.ok) return { ok: false, error: res.error };
    commentId = res.data.id;
  }
  for (const file of files) {
    const up = await uploadAttachment(supabase, ctx, ticketId, file, { commentId });
    if (!up.ok) return { ok: false, error: `attachment:${up.error}` };
  }
  return { ok: true };
}

const editSchema = z.object({
  bodyRich: z.string().max(200_000),
  removeIds: z.string().max(10_000).optional(),
});

/** Edit of one's own reply: text, removed files, newly added files. */
export async function editComment(
  ctx: PortalContext,
  ticketId: string,
  commentId: string,
  formData: FormData
): Promise<OpResult> {
  const parsed = editSchema.safeParse({
    bodyRich: formData.get("bodyRich")?.toString() ?? "",
    removeIds: formData.get("removeIds")?.toString() || undefined,
  });
  if (!parsed.success) return { ok: false, error: "invalid" };
  const rich = richFrom(parsed.data.bodyRich);
  let removeIds: string[] = [];
  try {
    removeIds = parsed.data.removeIds
      ? z.array(z.string().uuid()).parse(JSON.parse(parsed.data.removeIds))
      : [];
  } catch {
    return { ok: false, error: "invalid" };
  }
  const body = rich ? extractPlainText(rich).slice(0, LIMITS.bodyMax) : "";
  if (!rich || !body) return { ok: false, error: "empty" };

  const supabase = await createClient();
  const res = await updateOwnComment(supabase, ctx, commentId, body, rich);
  if (!res.ok) return { ok: false, error: res.error };
  for (const id of removeIds) {
    const del = await deleteOwnAttachment(supabase, ctx, id);
    if (!del.ok) return { ok: false, error: `attachment:${del.error}` };
  }
  for (const file of filesFrom(formData)) {
    const up = await uploadAttachment(supabase, ctx, ticketId, file, { commentId });
    if (!up.ok) return { ok: false, error: `attachment:${up.error}` };
  }
  return { ok: true };
}
