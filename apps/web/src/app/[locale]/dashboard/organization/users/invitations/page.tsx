import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { INVITES_CANCEL, INVITES_CREATE, INVITES_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import {
  OrgBranchesService,
  OrgInvitationsService,
  OrgRolesService,
} from "@/server/services/organization.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import { InvitationsWorkspace } from "./_components/invitations-workspace";
import {
  invitationColumnSet,
  invitationHref,
  loadInvitationState,
  migrateInvitationSearchParams,
} from "./_components/invitations-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The organization's invitations (Kolor Sensu list), all loaded; the address picks. */
export default async function InvitationsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t, tUsers] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("adminInvitations"),
    getTranslations("modules.organizationManagement.items.users"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  const can = (permission: string) => checkPermission(context.user.permissionSnapshot, permission);
  if (!can(INVITES_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "invites_read_required" } },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/organization/users/invitations" });
  const migration = migrateInvitationSearchParams(searchParams ? await searchParams : {});
  const state = loadInvitationState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(invitationHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [invitationsResult, rolesResult, branchesResult] = await Promise.all([
    OrgInvitationsService.listInvitations(supabase, orgId),
    OrgRolesService.listRoles(supabase, orgId),
    OrgBranchesService.listBranches(supabase, orgId),
  ]);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: tUsers("invitations"),
    column_invitation: t("columns.email"),
    column_status: t("columns.status"),
    column_roles: t("columns.roles"),
    column_created_at: pl ? "Wysłano" : "Sent",
    column_expires_at: t("columns.expires"),
    search: pl ? "Szukaj e-maila, osoby, roli…" : "Search email, person, role…",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak zaproszeń dla tych filtrów" : "No invitations match these filters",
    emptyAll: t("noInvitations"),
    notFound: pl ? "Nie ma takiego zaproszenia" : "No such invitation",
    loadError: pl ? "Nie udało się wczytać zaproszeń" : "Could not load the invitations",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "zaproszeń" : "invitations",
  };

  const set = invitationColumnSet(labels);
  const cookie = `ambra_org_invitations_${context.user.user.id}_${orgId}`;
  const { layout, widths } = await savedColumns(set, cookie);

  return (
    <InvitationsWorkspace
      initialInvitations={invitationsResult.success ? invitationsResult.data : []}
      initialRoles={rolesResult.success ? rolesResult.data : []}
      initialBranches={branchesResult.success ? branchesResult.data : []}
      path={path}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      labels={labels}
      canCreate={can(INVITES_CREATE)}
      canCancel={can(INVITES_CANCEL)}
    />
  );
}
