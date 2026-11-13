import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { MEMBERS_MANAGE, MEMBERS_READ } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { OrgPositionsService } from "@/server/services/organization.service";
import { savedColumns } from "@/components/kolor-sensu/data-table/saved-columns";
import { PositionsWorkspace } from "./_components/positions-workspace";
import {
  loadPositionState,
  migratePositionSearchParams,
  positionColumnSet,
  positionHref,
} from "./_components/positions-state";
import "@/components/kolor-sensu/data-table/ambra-list.css";

type PageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

/** The organization's positions (Kolor Sensu list), all loaded; the address picks. */
export default async function PositionsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.organizationManagement.positions"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, MEMBERS_READ)) {
    return redirect({ href: "/dashboard/organization/users/members", locale });
  }

  const path = getPathname({ locale, href: "/dashboard/organization/users/positions" });
  const migration = migratePositionSearchParams(searchParams ? await searchParams : {});
  const state = loadPositionState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(positionHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const result = await OrgPositionsService.listPositions(supabase, orgId);

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("title"),
    create: t("createButton"),
    column_position: t("columns.name"),
    column_description: t("columns.description"),
    column_created_at: pl ? "Utworzono" : "Created",
    noDescription: t("detail.noDescription"),
    edit: t("actions.edit"),
    delete: t("actions.delete"),
    confirmDelete: pl ? "Usunąć stanowisko {name}?" : "Delete the position {name}?",
    dialogTitleCreate: t("dialog.titleCreate"),
    dialogTitleEdit: t("dialog.titleEdit"),
    dialogName: t("dialog.name"),
    dialogNamePlaceholder: t("dialog.namePlaceholder"),
    dialogDescriptionPlaceholder: t("dialog.descriptionPlaceholder"),
    dialogCreate: t("dialog.create"),
    cancel: t("dialog.cancel"),
    saving: t("dialog.saving"),
    save: t("dialog.save"),
    search: pl ? "Szukaj nazwy, opisu…" : "Search name, description…",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak stanowisk dla tego wyszukiwania" : "No positions match this search",
    emptyAll: t("empty"),
    notFound: pl ? "Nie ma takiego stanowiska" : "No such position",
    loadError: pl ? "Nie udało się wczytać stanowisk" : "Could not load the positions",
    retry: pl ? "Spróbuj ponownie" : "Try again",
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "stanowisk" : "positions",
  };

  const set = positionColumnSet(labels);
  const cookie = `ambra_org_positions_${context.user.user.id}_${orgId}`;
  const { layout, widths } = await savedColumns(set, cookie);

  return (
    <PositionsWorkspace
      initialPositions={result.success ? result.data : []}
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
