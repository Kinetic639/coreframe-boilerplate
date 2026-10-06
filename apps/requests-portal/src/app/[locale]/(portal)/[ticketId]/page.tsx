import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { AutoRefresh } from "@/components/requests/auto-refresh";
import { ListPane } from "@/components/requests/list-pane";
import { RequestDetailView } from "@/components/requests/request-detail";
import { requirePortalContext } from "@/server/portal-context";
import { listAttachments } from "@/server/requests/attachments.service";
import { listComments } from "@/server/requests/comments.service";
import type { ListSearchParams } from "@/server/requests/list-params";
import { getRequest } from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
  searchParams: Promise<ListSearchParams>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function generateMetadata({ params }: Props) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return {};
  const ctx = await requirePortalContext();
  const res = await getRequest(await createClient(), ctx, ticketId);
  return res.ok && res.data
    ? { title: `${res.data.request.number} · ${res.data.request.title}` }
    : {};
}

export default async function RequestPage({ params, searchParams }: Props) {
  const { locale, ticketId } = await params;
  setRequestLocale(locale);
  if (!UUID.test(ticketId)) notFound();

  const [ctx, sp, supabase] = await Promise.all([
    requirePortalContext(),
    searchParams,
    createClient(),
  ]);
  const [detail, comments, attachments] = await Promise.all([
    getRequest(supabase, ctx, ticketId),
    listComments(supabase, ctx, ticketId),
    listAttachments(supabase, ctx, ticketId),
  ]);
  if (!detail.ok) throw new Error(detail.error);
  if (!detail.data) notFound();
  const { request, events } = detail.data;

  return (
    <div className="flex flex-1 lg:grid lg:grid-cols-[minmax(380px,480px)_1fr]">
      <div className="hidden min-w-0 border-r border-stone-200 lg:block">
        <ListPane ctx={ctx} searchParams={sp} selectedId={request.id} />
      </div>
      <div className="min-w-0 flex-1 bg-stone-50">
        <RequestDetailView
          request={request}
          comments={comments.ok ? comments.data : []}
          attachments={attachments.ok ? attachments.data : []}
          events={events}
          branchName={ctx.branches.find((b) => b.id === request.branchId)?.name ?? null}
        />
      </div>
      <AutoRefresh />
    </div>
  );
}
