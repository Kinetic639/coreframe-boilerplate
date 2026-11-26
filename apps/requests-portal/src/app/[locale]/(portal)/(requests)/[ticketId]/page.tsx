import { cache } from "react";
import { notFound } from "next/navigation";
import { setRequestLocale } from "next-intl/server";
import { RequestDetailView } from "@/components/requests/request-detail";
import { requirePortalContext } from "@/server/portal-context";
import { getRequestView } from "@/server/requests/view.service";
import { createClient } from "@/utils/supabase/server";

type Props = {
  params: Promise<{ locale: string; ticketId: string }>;
};

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** One load per render, shared by the title and the page. */
const loadView = cache(async (ticketId: string) => {
  const [ctx, supabase] = await Promise.all([requirePortalContext(), createClient()]);
  return { ctx, res: await getRequestView(supabase, ctx, ticketId) };
});

export async function generateMetadata({ params }: Props) {
  const { ticketId } = await params;
  if (!UUID.test(ticketId)) return {};
  const { res } = await loadView(ticketId);
  return res.ok && res.data
    ? { title: `${res.data.request.number} · ${res.data.request.title}` }
    : {};
}

/** Detail pane only: the list lives in the (requests) layout and is not re-rendered here. */
export default async function RequestPage({ params }: Props) {
  const { locale, ticketId } = await params;
  setRequestLocale(locale);
  if (!UUID.test(ticketId)) notFound();

  const { ctx, res } = await loadView(ticketId);
  if (!res.ok) throw new Error(res.error);
  if (!res.data) notFound();
  const view = res.data;

  return (
    <RequestDetailView
      key={view.request.id}
      initial={view}
      branchName={ctx.branches.find((b) => b.id === view.request.branchId)?.name ?? null}
      viewer={{
        id: ctx.user.id,
        name: ctx.user.displayName,
        initials: ctx.user.initials,
        avatarUrl: ctx.user.avatarUrl,
      }}
    />
  );
}
