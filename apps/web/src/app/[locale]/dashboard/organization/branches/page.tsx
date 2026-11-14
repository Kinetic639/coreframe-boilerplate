import { cookies } from "next/headers";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  BRANCHES_CREATE,
  BRANCHES_DELETE,
  BRANCHES_READ,
  BRANCHES_UPDATE,
  WAREHOUSE_STRUCTURE_MANAGE,
} from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgBranchesService } from "@/server/services/organization.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { BranchesWorkspace } from "./_components/branches-workspace";
import {
  branchColumnSet,
  branchHref,
  loadBranchState,
  migrateBranchSearchParams,
} from "./_components/branches-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function cookieValue(value: string | undefined) {
  try {
    return value ? decodeURIComponent(value) : null;
  } catch {
    return null;
  }
}

/** The organization's branches (Kolor Sensu list), all loaded; the address picks. */
export default async function BranchesPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.organizationManagement.branches"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  const can = (permission: string) => checkPermission(context.user.permissionSnapshot, permission);
  if (!can(BRANCHES_READ)) {
    return redirect({ href: "/dashboard/organization/profile", locale });
  }

  const path = getPathname({ locale, href: "/dashboard/organization/branches" });
  const migration = migrateBranchSearchParams(searchParams ? await searchParams : {});
  const state = loadBranchState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(branchHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const result = await OrgBranchesService.listBranches(supabase, orgId);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    create: t("createButton"),
    column_branch: t("columns.name"),
    column_number: t("columns.number"),
    column_slug: t("columns.slug"),
    column_public_maps: t("columns.publicMaps"),
    column_created_at: t("columns.created"),
    maps_tak: pl ? "Włączone" : "On",
    maps_nie: pl ? "Wyłączone" : "Off",
    within_7d: pl ? "Ostatnie 7 dni" : "Last 7 days",
    within_30d: pl ? "Ostatnie 30 dni" : "Last 30 days",
    within_90d: pl ? "Ostatnie 90 dni" : "Last 90 days",
    edit: t("actions.edit"),
    delete: t("actions.delete"),
    confirmDelete: pl ? "Usunąć oddział {name}?" : "Delete the branch {name}?",
    dialogTitleCreate: t("dialog.titleCreate"),
    dialogTitleEdit: t("dialog.titleEdit"),
    dialogName: t("dialog.name"),
    dialogNamePlaceholder: t("dialog.namePlaceholder"),
    dialogSlugPlaceholder: t("dialog.slugPlaceholder"),
    dialogSlugHint: t("dialog.slugHint"),
    dialogCreate: t("dialog.create"),
    cancel: t("dialog.cancel"),
    saving: t("dialog.saving"),
    save: t("dialog.save"),
    search: pl ? "Szukaj nazwy, slugu, numeru…" : "Search name, slug, number…",
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak oddziałów dla tych filtrów" : "No branches match these filters",
    emptyAll: pl ? "Brak oddziałów" : "No branches yet",
    notFound: pl ? "Nie ma takiego oddziału" : "No such branch",
    loadError: pl ? "Nie udało się wczytać oddziałów" : "Could not load the branches",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "oddziałów" : "branches",
  };

  const set = branchColumnSet(labels);
  const cookie = `ambra_org_branches_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);

  return (
    <BranchesWorkspace
      initialBranches={result.success ? result.data : []}
      path={path}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      labels={labels}
      canCreate={can(BRANCHES_CREATE)}
      canUpdate={can(BRANCHES_UPDATE)}
      canDelete={can(BRANCHES_DELETE)}
      // Units and warehouses: also the warehouse manager (warehouse.structure.manage).
      canManageStructure={can(BRANCHES_UPDATE) || can(WAREHOUSE_STRUCTURE_MANAGE)}
    />
  );
}
