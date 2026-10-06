"use server";

import { revalidatePath } from "next/cache";
import { getLocale } from "next-intl/server";
import { z } from "zod";
import { redirect } from "@/i18n/navigation";
import {
  commentSchema,
  createRequestSchema,
  LIMITS,
  orderNumberSchema,
  warehouseSchema,
} from "@/lib/validation/requests";
import { requirePortalContext } from "@/server/portal-context";
import { uploadAttachment } from "@/server/requests/attachments.service";
import { addComment } from "@/server/requests/comments.service";
import { parseListParams, type ListSearchParams } from "@/server/requests/list-params";
import {
  closeOwnRequest,
  createRequest,
  listRequests,
  lookupOrder,
  type OrderLookup,
} from "@/server/requests/requests.service";
import type { RequestListItem } from "@/server/requests/types";
import { createClient } from "@/utils/supabase/server";

export type ActionState = { error?: string; fieldErrors?: Record<string, string> } | null;

function filesFrom(formData: FormData): File[] {
  return formData
    .getAll("files")
    .filter((f): f is File => f instanceof File && f.size > 0)
    .slice(0, LIMITS.maxFiles);
}

export async function createRequestAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requirePortalContext();
  const parsed = createRequestSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) {
    const fieldErrors: Record<string, string> = {};
    for (const issue of parsed.error.issues) fieldErrors[String(issue.path[0])] = issue.message;
    return { fieldErrors };
  }
  const v = parsed.data;
  if (!ctx.branches.some((b) => b.id === v.branchId) || !ctx.can.create(v.branchId)) {
    return { error: "forbidden" };
  }

  const supabase = await createClient();
  const created = await createRequest(supabase, ctx, {
    branchId: v.branchId,
    typeId: v.typeId,
    title: v.title,
    description: v.description || null,
    orderNumber: v.orderNumber || null,
    warehouse: v.warehouse || null,
  });
  if (!created.ok) return { error: created.error };

  for (const file of filesFrom(formData)) {
    const up = await uploadAttachment(supabase, ctx, created.data.id, file);
    if (!up.ok) console.error("[createRequestAction] attachment failed:", up.error);
  }

  revalidatePath("/", "layout");
  redirect({
    href: { pathname: "/[ticketId]", params: { ticketId: created.data.id } },
    locale: await getLocale(),
  });
  return null;
}

export async function lookupOrderAction(nr: string, mag: string): Promise<OrderLookup | null> {
  const n = orderNumberSchema.safeParse(nr);
  const m = warehouseSchema.safeParse(mag);
  if (!n.success || !m.success) return null;
  const ctx = await requirePortalContext();
  return lookupOrder(await createClient(), ctx, n.data, m.data);
}

export async function addCommentAction(
  _prev: ActionState,
  formData: FormData
): Promise<ActionState> {
  const ctx = await requirePortalContext();
  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  const files = filesFrom(formData);
  if (!parsed.success || (!parsed.data.body && files.length === 0)) return { error: "empty" };

  const supabase = await createClient();
  const { ticketId, body } = parsed.data;
  if (body) {
    const res = await addComment(supabase, ctx, ticketId, body);
    if (!res.ok) return { error: res.error };
  }
  for (const file of files) {
    const up = await uploadAttachment(supabase, ctx, ticketId, file);
    if (!up.ok) return { error: `attachment:${up.error}` };
  }
  revalidatePath("/", "layout");
  return null;
}

export async function closeRequestAction(
  ticketId: string,
  outcome: "closed" | "cancelled"
): Promise<ActionState> {
  const id = z.string().uuid().safeParse(ticketId);
  if (!id.success || (outcome !== "closed" && outcome !== "cancelled")) return { error: "invalid" };
  const ctx = await requirePortalContext();
  const res = await closeOwnRequest(await createClient(), ctx, id.data, outcome);
  if (!res.ok) return { error: res.error };
  revalidatePath("/", "layout");
  return null;
}

/** List page data for the client list (filters changed without a page navigation). */
export async function listRequestsAction(
  query: ListSearchParams
): Promise<{ items: RequestListItem[]; total: number } | null> {
  const ctx = await requirePortalContext();
  const res = await listRequests(await createClient(), ctx, parseListParams(query));
  return res.ok ? res.data : null;
}
