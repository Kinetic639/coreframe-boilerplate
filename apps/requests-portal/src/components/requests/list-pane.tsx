import { createClient } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import { listRequests, listTypeOptions } from "@/server/requests/requests.service";
import { parseListParams, type ListSearchParams } from "@/server/requests/list-params";
import { RequestList } from "./request-list";

/** Loads and renders the request list for the current URL query. */
export async function ListPane({
  ctx,
  searchParams,
  selectedId,
}: {
  ctx: PortalContext;
  searchParams: ListSearchParams;
  selectedId?: string;
}) {
  const input = parseListParams(searchParams);
  const supabase = await createClient();
  const [list, types] = await Promise.all([
    listRequests(supabase, ctx, input),
    listTypeOptions(supabase, ctx),
  ]);
  if (!list.ok) throw new Error(list.error);
  return (
    <RequestList
      input={input}
      items={list.data.items}
      total={list.data.total}
      types={types}
      selectedId={selectedId}
    />
  );
}
