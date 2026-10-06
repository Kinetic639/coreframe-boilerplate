import { headers } from "next/headers";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { RequestsShell } from "@/components/requests/requests-shell";
import { requirePortalContext } from "@/server/portal-context";
import {
  LIST_QUERY_HEADER,
  listKey,
  parseListParams,
  toQuery,
} from "@/server/requests/list-params";
import { listRequests, listTypeOptions } from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

/**
 * List + detail split for "/" and "/[ticketId]". As a layout it is not re-rendered when
 * another ticket is opened, so only the detail segment loads. Layouts get no searchParams,
 * so the list query for the first render comes from the header set in proxy.ts.
 */
export default async function RequestsLayout({ children }: { children: React.ReactNode }) {
  const [ctx, supabase, h] = await Promise.all([requirePortalContext(), createClient(), headers()]);
  const search = new URLSearchParams(h.get(LIST_QUERY_HEADER) ?? "");
  const input = parseListParams(Object.fromEntries(search));
  const [list, types] = await Promise.all([
    listRequests(supabase, ctx, input),
    listTypeOptions(supabase, ctx),
  ]);
  if (!list.ok) throw new Error(list.error);

  return (
    <>
      <RequestsShell initial={list.data} initialKey={listKey(toQuery(input))} types={types}>
        {children}
      </RequestsShell>
      <AutoRefresh />
    </>
  );
}
