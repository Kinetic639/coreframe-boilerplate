import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_MANAGE, MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  OrgMembersService,
  OrgPositionsService,
  OrgRolesService,
  OrgBranchesService,
} from "@/server/services/organization.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import { MembersWorkspace } from "../_components/members-workspace";
import {
  loadMemberState,
  memberColumnSet,
  memberHref,
  migrateMemberSearchParams,
} from "../_components/members-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The organization's members (Kolor Sensu list), all loaded; the address picks. */
export default async function MembersPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.organizationManagement.members"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/organization/users/members" });
  const migration = migrateMemberSearchParams(searchParams ? await searchParams : {});
  const state = loadMemberState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(memberHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [membersResult, positionsResult, assignmentsResult, rolesResult, branchesResult] =
    await Promise.all([
      OrgMembersService.listMembers(supabase, orgId),
      OrgPositionsService.listPositions(supabase, orgId),
      OrgPositionsService.listAssignmentsForOrg(supabase, orgId),
      OrgRolesService.listRoles(supabase, orgId),
      OrgBranchesService.listBranches(supabase, orgId),
    ]);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    column_member: t("columns.member"),
    column_status: t("columns.status"),
    column_roles: t("columns.roles"),
    column_position: t("columns.position"),
    column_joined_at: t("columns.joined"),
    confirmRemove: pl ? "Usunąć {name} z organizacji?" : "Remove {name} from the organization?",
    search: pl ? "Szukaj imienia, nazwiska, e-maila…" : "Search name, email…",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak członków dla tych filtrów" : "No members match these filters",
    emptyAll: pl ? "Organizacja nie ma jeszcze członków" : "The organization has no members yet",
    notFound: pl ? "Nie ma takiego członka" : "No such member",
    loadError: pl ? "Nie udało się wczytać członków" : "Could not load the members",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "członków" : "members",
  };

  const set = memberColumnSet(labels);
  const cookie = `ambra_org_members_${context.user.user.id}_${orgId}`;
  const { layout, widths } = await savedColumns(set, cookie);

  return (
    <MembersWorkspace
      initialMembers={membersResult.success ? membersResult.data : []}
      initialPositions={positionsResult.success ? positionsResult.data : []}
      initialAssignments={assignmentsResult.success ? assignmentsResult.data : []}
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
      path={path}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      labels={labels}
      canManage={checkPermission(context.user.permissionSnapshot, MEMBERS_MANAGE)}
    />
  );
}
