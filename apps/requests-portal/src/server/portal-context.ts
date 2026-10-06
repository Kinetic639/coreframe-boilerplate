import { cache } from "react";
import { cookies } from "next/headers";
import {
  HELPDESK_TICKETS_CREATE,
  HELPDESK_TICKETS_MANAGE,
  HELPDESK_TICKETS_READ,
  HELPDESK_TICKET_TYPES_MANAGE,
} from "@repo/contracts/permissions";
import { createClient } from "@/utils/supabase/server";

/** Cookie holding the branch picked in the header switcher; absent = all branches. */
export const ACTIVE_BRANCH_COOKIE = "rp_branch";

export type PortalBranch = { id: string; name: string };

export type PortalContext = {
  user: {
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    displayName: string;
    initials: string;
    avatarUrl: string | null;
  };
  org: { id: string; name: string };
  /** Branches where the user may read requests, in creation order. */
  branches: PortalBranch[];
  /** Branch picked in the switcher, or null for "all my branches". */
  activeBranchId: string | null;
  /** Branch ids the current view covers (the active one, or all of `branches`). */
  scopeBranchIds: string[];
  /** Permission checks, org-wide grants included. */
  can: {
    create: (branchId: string) => boolean;
    manage: (branchId: string) => boolean;
    manageTypes: boolean;
  };
};

export type PortalContextResult =
  | { status: "ok"; context: PortalContext }
  | { status: "signed-out" }
  | { status: "no-access"; email: string };

function initialsOf(first: string | null, last: string | null, email: string): string {
  const fromName = `${first?.[0] ?? ""}${last?.[0] ?? ""}`.toUpperCase();
  return fromName || email.slice(0, 2).toUpperCase();
}

/**
 * Who is signed in and what they may see in the portal -- the portal's lightweight
 * counterpart to Ambra's loadDashboardContextV2. Org and branches come from the
 * user's compiled permissions (user_effective_permissions), so an advisor whose only
 * role is branch-scoped ("Doradca (portal)") still resolves to their organization.
 * Data access itself is enforced by RLS; this only decides what to render.
 */
export const loadPortalContext = cache(async (): Promise<PortalContextResult> => {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "signed-out" };
  const email = user.email ?? "";

  const [{ data: uep }, { data: prefs }, { data: profile }] = await Promise.all([
    supabase
      .from("user_effective_permissions")
      .select("organization_id, branch_id, permission_slug_exact")
      .eq("user_id", user.id),
    supabase
      .from("user_preferences")
      .select("organization_id")
      .eq("user_id", user.id)
      .maybeSingle(),
    supabase
      .from("users")
      .select("first_name, last_name, avatar_url")
      .eq("id", user.id)
      .maybeSingle(),
  ]);

  const rows = uep ?? [];
  const canRead = (r: (typeof rows)[number]) => r.permission_slug_exact === HELPDESK_TICKETS_READ;
  const orgIds = [...new Set(rows.filter(canRead).map((r) => r.organization_id))];
  const orgId =
    prefs?.organization_id && orgIds.includes(prefs.organization_id)
      ? prefs.organization_id
      : orgIds[0];
  if (!orgId) return { status: "no-access", email };

  const orgPerms = new Set<string>();
  const branchPerms = new Map<string, Set<string>>();
  for (const r of rows) {
    if (r.organization_id !== orgId) continue;
    if (!r.branch_id) {
      orgPerms.add(r.permission_slug_exact);
    } else {
      const set = branchPerms.get(r.branch_id) ?? new Set<string>();
      set.add(r.permission_slug_exact);
      branchPerms.set(r.branch_id, set);
    }
  }
  const has = (slug: string, branchId: string) =>
    orgPerms.has(slug) || (branchPerms.get(branchId)?.has(slug) ?? false);

  const [{ data: org }, { data: allBranches }] = await Promise.all([
    supabase.from("organizations").select("id, name").eq("id", orgId).maybeSingle(),
    supabase
      .from("branches")
      .select("id, name")
      .eq("organization_id", orgId)
      .is("deleted_at", null)
      .order("created_at", { ascending: true }),
  ]);

  const branches = (allBranches ?? []).filter((b) => has(HELPDESK_TICKETS_READ, b.id));
  if (!org || branches.length === 0) return { status: "no-access", email };

  const picked = (await cookies()).get(ACTIVE_BRANCH_COOKIE)?.value ?? null;
  const activeBranchId = branches.some((b) => b.id === picked) ? picked : null;

  const firstName = profile?.first_name ?? null;
  const lastName = profile?.last_name ?? null;
  const fullName = [firstName, lastName].filter(Boolean).join(" ");

  return {
    status: "ok",
    context: {
      user: {
        id: user.id,
        email,
        firstName,
        lastName,
        displayName: fullName || email,
        initials: initialsOf(firstName, lastName, email),
        avatarUrl: profile?.avatar_url ?? null,
      },
      org: { id: org.id, name: org.name },
      branches,
      activeBranchId,
      scopeBranchIds: activeBranchId ? [activeBranchId] : branches.map((b) => b.id),
      can: {
        create: (branchId) => has(HELPDESK_TICKETS_CREATE, branchId),
        manage: (branchId) => has(HELPDESK_TICKETS_MANAGE, branchId),
        manageTypes: orgPerms.has(HELPDESK_TICKET_TYPES_MANAGE),
      },
    },
  };
});

/** For pages and actions behind the portal layout: the layout already handled the other cases. */
export async function requirePortalContext(): Promise<PortalContext> {
  const result = await loadPortalContext();
  if (result.status !== "ok") throw new Error(`Portal context unavailable: ${result.status}`);
  return result.context;
}
