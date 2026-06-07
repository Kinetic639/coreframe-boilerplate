import { attachmentFileResponse } from "@/server/attachments/file-response";

type RouteContext = {
  params: Promise<{
    attachmentId: string;
    fileName: string;
  }>;
};

export async function GET(request: Request, { params }: RouteContext) {
  return attachmentFileResponse(request, await params);
}
