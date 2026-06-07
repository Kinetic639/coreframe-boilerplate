import { NextResponse } from "next/server";
import { checkPermission } from "@/lib/utils/permissions";
import { getCommentTargetDescriptor } from "@/server/comments/target-registry";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { AttachmentsService } from "@/server/services/attachments.service";
import { createClient } from "@/utils/supabase/server";

type AttachmentFileParams = {
  attachmentId: string;
  fileName: string;
};

function contentDisposition(mode: "inline" | "attachment", fileName: string): string {
  const fallback = fileName.replace(/[^\w.\- ]+/g, "_");
  return `${mode}; filename="${fallback}"; filename*=UTF-8''${encodeURIComponent(fileName)}`;
}

export async function attachmentFileResponse(request: Request, params: AttachmentFileParams) {
  const context = await loadDashboardContextV2();
  if (!context?.app.activeOrgId) return new NextResponse("Unauthorized", { status: 401 });

  const supabase = await createClient();
  const result = await AttachmentsService.getById(
    supabase,
    context.app.activeOrgId,
    context.user.user?.id ?? "",
    params.attachmentId
  );

  if (!result.success) return new NextResponse("Not found", { status: 404 });

  const attachment = result.data;
  const descriptor = getCommentTargetDescriptor(attachment.target_type);
  if (!descriptor) return new NextResponse("Not found", { status: 404 });

  if (!checkPermission(context.user.permissionSnapshot, descriptor.requiredReadPermission)) {
    return new NextResponse("Forbidden", { status: 403 });
  }

  if (!attachment.download_url) return new NextResponse("Not found", { status: 404 });

  const upstream = await fetch(attachment.download_url, { cache: "no-store" });
  if (!upstream.ok || !upstream.body) return new NextResponse("Not found", { status: 404 });

  const url = new URL(request.url);
  const mode = url.searchParams.get("download") === "1" ? "attachment" : "inline";

  return new NextResponse(upstream.body, {
    status: 200,
    headers: {
      "Content-Type": attachment.content_type,
      "Content-Length": String(attachment.size_bytes),
      "Content-Disposition": contentDisposition(mode, attachment.file_name),
      "Cache-Control": "private, no-store",
    },
  });
}
