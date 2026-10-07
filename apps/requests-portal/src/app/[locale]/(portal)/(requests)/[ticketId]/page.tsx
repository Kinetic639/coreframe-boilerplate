import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RequestDetailView } from "@/components/requests/request-detail";
import { requirePortalContext } from "@/server/portal-context";
import { listAttachments } from "@/server/requests/attachments.service";
import { listComments } from "@/server/requests/comments.service";
import { getRequest } from "@/server/requests/requests.service";
import { createClient } from "@/utils/supabase/server";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
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

/** Detail pane only: the list lives in the (requests) layout and is not re-rendered here. */
export default async function RequestPage({ params }: Props) {
  const { locale, ticketId } = await params;
  setRequestLocale(locale);
  if (!UUID.test(ticketId)) notFound();

  const [ctx, supabase] = await Promise.all([requirePortalContext(), createClient()]);
  const [detail, comments, attachments] = await Promise.all([
    getRequest(supabase, ctx, ticketId),
    listComments(supabase, ctx, ticketId),
    listAttachments(supabase, ctx, ticketId),
  ]);
  if (!detail.ok) throw new Error(detail.error);
  if (!detail.data) notFound();
  const { request, events } = detail.data;

  return (
    <RequestDetailView
      request={request}
      comments={comments.ok ? comments.data : []}
      attachments={attachments.ok ? attachments.data : []}
      events={events}
      branchName={ctx.branches.find((b) => b.id === request.branchId)?.name ?? null}
      viewer={{
        id: ctx.user.id,
        name: ctx.user.displayName,
        initials: ctx.user.initials,
        avatarUrl: ctx.user.avatarUrl,
      }}
    />
  );
}
