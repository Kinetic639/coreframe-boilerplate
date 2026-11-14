import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_MANAGE, MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgRolesService } from "@/server/services/organization.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import { RolesWorkspace } from "./_components/roles-workspace";
import {
  loadRoleState,
  migrateRoleSearchParams,
  roleColumnSet,
  roleHref,
} from "./_components/roles-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The organization's roles (Kolor Sensu list), all loaded; the address picks. */
export default async function RolesPage({ searchParams }: PageProps = {}) {
  const [locale, context, t, tUsers] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.organizationManagement.roles"),
    getTranslations("modules.organizationManagement.items.users"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({
      href: { pathname: "/dashboard/access-denied", query: { reason: "members_read_required" } },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/organization/users/roles" });
  const migration = migrateRoleSearchParams(searchParams ? await searchParams : {});
  const state = loadRoleState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(roleHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [rolesResult, catalogResult] = await Promise.all([
    OrgRolesService.listRoles(supabase, orgId),
    OrgRolesService.listPermissionCatalog(supabase),
  ]);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: tUsers("roles"),
    column_role: t("columns.name"),
    column_scope: t("columns.scope"),
    column_permissions: t("columns.permissionCount"),
    column_description: t("columns.description"),
    column_kind: pl ? "Rodzaj" : "Kind",
    kind_systemowa: pl ? "Systemowe" : "System",
    kind_wlasna: pl ? "Własne" : "Custom",
    confirmDelete: pl ? "Usunąć rolę {name}?" : "Delete the role {name}?",
    search: pl ? "Szukaj nazwy, opisu…" : "Search name, description…",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak ról dla tych filtrów" : "No roles match these filters",
    notFound: pl ? "Nie ma takiej roli" : "No such role",
    loadError: pl ? "Nie udało się wczytać ról" : "Could not load the roles",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "ról" : "roles",
  };

  const set = roleColumnSet(labels);
  const cookie = `ambra_org_roles_${context.user.user.id}_${orgId}`;
  const { layout, widths } = await savedColumns(set, cookie);

  return (
    <RolesWorkspace
      initialRoles={rolesResult.success ? rolesResult.data : []}
      permissionCatalog={catalogResult.success ? catalogResult.data : []}
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
