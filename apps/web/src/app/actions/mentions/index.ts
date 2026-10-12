"use server";

import { z } from "zod";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { MENTION_PERSON, UUID_RE, type MentionPerson } from "@/lib/mentions";

type ActionResult<T> = { success: true; data: T } | { success: false; error: string };

/**
 * Table (and its organization column) behind each mentionable object type;
 * reads go through the viewer's RLS.
 */
const MENTION_TABLES: Record<string, { table: string; orgColumn: string }> = {
  repairOrder: { table: "repair_orders", orgColumn: "organization_id" },
  item: { table: "inventory_products", orgColumn: "organization_id" },
  // Help Desk names the column differently
  ticket: { table: "helpdesk_tickets", orgColumn: "org_id" },
  task: { table: "planning_tasks", orgColumn: "organization_id" },
  document: { table: "inventory_movement_headers", orgColumn: "organization_id" },
  container: { table: "inventory_containers", orgColumn: "organization_id" },
  location: { table: "warehouse_locations", orgColumn: "organization_id" },
  party: { table: "crm_parties", orgColumn: "organization_id" },
  contact: { table: "crm_contacts", orgColumn: "organization_id" },
};

const refsSchema = z
  .array(z.object({ type: z.string().max(40), id: z.string().regex(UUID_RE) }))
  .max(200);

async function getContext() {
  const supabase = await createClient();
  const context = await loadDashboardContextV2();
  const orgId = context?.app.activeOrgId;
  const userId = context?.user.user?.id;
  if (!orgId || !userId) return null;
  return { supabase, orgId, userId };
}

/**
 * People who can be mentioned: the active members of the organization
 * (`org_member_directory`, readable by every member), the caller excluded.
 */
export async function listMentionPeopleAction(): Promise<ActionResult<MentionPerson[]>> {
  try {
    const ctx = await getContext();
    if (!ctx) return { success: false, error: "Unauthorized" };
    const { data, error } = await ctx.supabase.rpc("org_member_directory", { p_org: ctx.orgId });
    if (error) {
      console.error("[listMentionPeopleAction]", error);
      return { success: false, error: "Failed" };
    }
    const rows = (data ?? []) as {
      user_id: string;
      first_name: string | null;
      last_name: string | null;
      email: string | null;
      avatar_url: string | null;
      job_title: string | null;
    }[];
    return {
      success: true,
      data: rows
        .filter((row) => row.user_id !== ctx.userId)
        .map((row) => ({
          userId: row.user_id,
          firstName: row.first_name,
          lastName: row.last_name,
          email: row.email,
          avatarUrl: row.avatar_url,
          jobTitle: row.job_title,
        })),
    };
  } catch (error) {
    console.error("[listMentionPeopleAction]", error);
    return { success: false, error: "Failed" };
  }
}

/**
 * Which of the mentioned objects the viewer may open. A mention is written by
 * someone else (who had access); the reader's own RLS decides whether the chip
 * links to the object or shows "no access". Returns the readable `type:id` keys.
 */
export async function resolveMentionsAction(rawRefs: unknown): Promise<ActionResult<string[]>> {
  try {
    const parsed = refsSchema.safeParse(rawRefs);
    if (!parsed.success) return { success: false, error: "Invalid input" };
    const ctx = await getContext();
    if (!ctx) return { success: false, error: "Unauthorized" };

    const idsByType = new Map<string, Set<string>>();
    for (const ref of parsed.data as { type: string; id: string }[]) {
      if (ref.type === MENTION_PERSON || !(ref.type in MENTION_TABLES)) continue;
      const ids = idsByType.get(ref.type) ?? new Set<string>();
      ids.add(ref.id);
      idsByType.set(ref.type, ids);
    }

    const readable = await Promise.all(
      [...idsByType.entries()].map(async ([type, ids]) => {
        const { table, orgColumn } = MENTION_TABLES[type];
        const { data, error } = await ctx.supabase
          .from(table)
          .select("id")
          .eq(orgColumn, ctx.orgId)
          .is("deleted_at", null)
          .in("id", [...ids]);
        if (error) {
          console.error("[resolveMentionsAction]", type, error);
          return [];
        }
        return ((data ?? []) as { id: string }[]).map((row) => `${type}:${row.id}`);
      })
    );
    return { success: true, data: readable.flat() };
  } catch (error) {
    console.error("[resolveMentionsAction]", error);
    return { success: false, error: "Failed" };
  }
}
