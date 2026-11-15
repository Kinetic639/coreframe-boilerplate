import { NextRequest, NextResponse } from "next/server";
import { listSavedViewsAction } from "@/app/actions/saved-views";

// A list's saved views, read with a plain GET: server actions run one at a
// time per page, so reading through one waits behind the list's own actions.

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  const result = await listSavedViewsAction({
    listKey: request.nextUrl.searchParams.get("list") ?? "",
  });
  return NextResponse.json(result, {
    status: result.success ? 200 : 400,
    headers: { "Cache-Control": "no-store" },
  });
}
