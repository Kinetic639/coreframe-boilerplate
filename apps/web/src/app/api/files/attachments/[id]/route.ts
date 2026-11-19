import { NextRequest, NextResponse } from "next/server";
import { attachmentVariantPath, type AttachmentVariant } from "@/lib/attachments/image-variants";
import {
  ATTACHMENT_URL_REUSE_SECONDS,
  getSharedAttachmentUrl,
} from "@/server/storage/attachment-signed-url";
import { createClient } from "@/utils/supabase/server";

// A stable address for an attachment's file, e.g. a card cover or a list
// thumbnail: /api/files/attachments/<id>?v=thumb|card. It checks access as the
// signed-in user (the attachment row is under the same row-level rule as the
// storage object) and redirects to a signed link that is shared for 50 minutes,
// so the storage CDN and the browser can serve the file from cache. The redirect
// is cached privately by the browser, so a refetch keeps the same image address
// and the image does not reload or flicker. A file never changes under its id.
//
// ?v=thumb (160 px) and ?v=card (640 px) point at the small versions made when
// the image was uploaded; files without them fall back to the stored file.

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const VARIANTS = new Set<AttachmentVariant>(["thumb", "card"]);

function notFound() {
  return new NextResponse(null, { status: 404, headers: { "Cache-Control": "no-store" } });
}

export async function GET(request: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  if (!UUID.test(id)) return notFound();

  const requested = request.nextUrl.searchParams.get("v") as AttachmentVariant | null;
  const variant = requested && VARIANTS.has(requested) ? requested : null;

  const supabase = await createClient();
  const { data: row } = await supabase
    .from("app_attachments")
    .select("storage_path, metadata")
    .eq("id", id)
    .is("deleted_at", null)
    .maybeSingle();
  const attachment = row as { storage_path?: string; metadata?: unknown } | null;
  if (!attachment?.storage_path) return notFound();

  const path =
    (variant && attachmentVariantPath(attachment.storage_path, attachment.metadata, variant)) ||
    attachment.storage_path;

  const signedUrl = await getSharedAttachmentUrl(path);
  if (!signedUrl) return notFound();

  return NextResponse.redirect(signedUrl, {
    status: 302,
    headers: { "Cache-Control": `private, max-age=${ATTACHMENT_URL_REUSE_SECONDS}` },
  });
}
