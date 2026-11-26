import type { PortalSupabase } from "@/utils/supabase/server";
import type { PortalContext } from "@/server/portal-context";
import { listAttachments, toAttachments, type AttachmentRow } from "./attachments.service";
import { listComments } from "./comments.service";
import {
  getRequest,
  portalRpc,
  rpcRowToListItem,
  toPerson,
  type RpcRequestRow,
} from "./requests.service";
import type {
  PersonRef,
  RequestAttachment,
  RequestComment,
  RequestDetail,
  RequestEvent,
  ServiceResult,
} from "./types";

/** Everything a request card shows, loaded and cached as one piece. */
export type RequestView = {
  request: RequestDetail;
  events: RequestEvent[];
  comments: RequestComment[];
  attachments: RequestAttachment[];
};

type UserRow = Parameters<typeof toPerson>[0];

export type RpcComment = {
  id: string;
  body_plain: string | null;
  body_rich: unknown | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  author: UserRow;
};

type RpcView = RpcRequestRow & {
  description_plain: string | null;
  description_rich: unknown | null;
  closed_at: string | null;
  responders: UserRow[];
  acceptors: UserRow[];
  activity: Array<{
    id: string;
    event_type: string;
    payload: Record<string, unknown> | null;
    created_at: string;
    actor: UserRow;
  }>;
  comments: RpcComment[];
  attachments: AttachmentRow[];
};

const people = (rows: UserRow[]) => rows.map(toPerson).filter((p): p is PersonRef => !!p);

export function rpcComment(c: RpcComment, ctx: PortalContext): RequestComment {
  return {
    id: c.id,
    author: toPerson(c.author),
    bodyPlain: c.body_plain ?? "",
    bodyRich: c.body_rich ?? null,
    createdAt: c.created_at,
    updatedAt: c.updated_at,
    isMine: c.created_by === ctx.user.id,
  };
}

/**
 * A request card in one database request (portal_request_view) plus one storage request
 * for the file links. Falls back to the separate queries while the function is missing.
 * null when the request does not exist or the user may not see it.
 */
export async function getRequestView(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string
): Promise<ServiceResult<RequestView | null>> {
  const { data: v, error } = await portalRpc<RpcView | null>(supabase, "portal_request_view", {
    p_org_id: ctx.org.id,
    p_ticket_id: ticketId,
  });
  if (error) return getRequestViewLegacy(supabase, ctx, ticketId);
  if (!v || !v.branch_id || !ctx.branches.some((b) => b.id === v.branch_id)) {
    return { ok: true, data: null };
  }

  const item = rpcRowToListItem(v, ctx);
  const open = v.status !== "closed" && v.status !== "cancelled";
  return {
    ok: true,
    data: {
      request: {
        ...item,
        status: v.status,
        descriptionPlain: v.description_plain,
        descriptionRich: v.description_rich,
        responders: people(v.responders ?? []),
        acceptors: people(v.acceptors ?? []),
        acceptedAt: v.accepted_at,
        closedAt: v.closed_at,
        canClose: item.isMine && open,
      },
      events: (v.activity ?? []).map((e) => ({
        id: e.id,
        type: e.event_type,
        actor: toPerson(e.actor),
        payload: e.payload ?? {},
        createdAt: e.created_at,
      })),
      comments: (v.comments ?? []).map((c) => rpcComment(c, ctx)),
      attachments: await toAttachments(supabase, ctx, v.attachments ?? []),
    },
  };
}

async function getRequestViewLegacy(
  supabase: PortalSupabase,
  ctx: PortalContext,
  ticketId: string
): Promise<ServiceResult<RequestView | null>> {
  const [detail, comments, attachments] = await Promise.all([
    getRequest(supabase, ctx, ticketId),
    listComments(supabase, ctx, ticketId),
    listAttachments(supabase, ctx, ticketId),
  ]);
  if (!detail.ok) return detail;
  if (!detail.data) return { ok: true, data: null };
  return {
    ok: true,
    data: {
      ...detail.data,
      comments: comments.ok ? comments.data : [],
      attachments: attachments.ok ? attachments.data : [],
    },
  };
}
