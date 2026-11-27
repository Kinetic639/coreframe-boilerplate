import { cookies, headers } from "next/headers";
import "@/components/data-table/ambra-list.css";
import { parseLayout, parseWidths } from "@/components/data-table/columns";
import { requestColumnSet, requestColumnsCookie } from "@/components/requests/request-columns";
import { RealtimeRefresh } from "@/components/requests/realtime-refresh";
import { RequestsScope } from "@/components/requests/requests-scope";
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
  const [ctx, supabase, h, jar] = await Promise.all([
    requirePortalContext(),
    createClient(),
    headers(),
    cookies(),
  ]);
  const search = new URLSearchParams(h.get(LIST_QUERY_HEADER) ?? "");
  const input = parseListParams(Object.fromEntries(search));
  const [list, types] = await Promise.all([
    listRequests(supabase, ctx, input),
    listTypeOptions(supabase, ctx),
  ]);
  if (!list.ok) throw new Error(list.error);

  const scope = `${ctx.org.id}:${ctx.activeBranchId ?? "all"}`;
  // The columns as the user left them (order, hidden, widths), like the ERP lists.
  const cookie = requestColumnsCookie(ctx.user.id, ctx.org.id);
  const set = requestColumnSet({});
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  return (
    <RequestsScope scope={scope}>
      <RequestsShell
        initial={list.data}
        initialKey={listKey(toQuery(input))}
        renderedAt={Date.now()}
        types={types}
        branches={ctx.branches.map((b) => ({ id: b.id, name: b.name }))}
        layout={layout}
        widths={widths}
        cookie={cookie}
        canCreate={ctx.branches.some((b) => ctx.can.create(b.id))}
      >
        {children}
      </RequestsShell>
      <RealtimeRefresh orgId={ctx.org.id} />
    </RequestsScope>
  );
}

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}
