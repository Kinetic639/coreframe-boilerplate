import { cookies } from "next/headers";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { HELPDESK_TICKET_TYPES_MANAGE } from "@/lib/constants/permissions";
import { createClient } from "@/utils/supabase/server";
import { HelpdeskTicketTypesService } from "@/server/services/helpdesk-ticket-types.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { TICKET_PRIORITIES } from "@/lib/validations/helpdesk";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { ticketTypeColumnSet } from "./_components/ticket-types-table";
import { TicketTypesView } from "./_components/ticket-types-view";
import {
  loadTicketTypeState,
  migrateTicketTypeSearchParams,
  ticketTypeHref,
} from "./_components/ticket-types-state";
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

export default async function HelpDeskTicketTypesPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.helpDesk"),
  ]);

  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });

  if (!checkPermission(context.user.permissionSnapshot, HELPDESK_TICKET_TYPES_MANAGE)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "helpdesk_ticket_types_manage_required" },
      },
      locale,
    });
  }

  const path = getPathname({ locale, href: "/dashboard/help-desk/ticket-types" });
  const migration = migrateTicketTypeSearchParams(searchParams ? await searchParams : {});
  const state = loadTicketTypeState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(ticketTypeHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const supabase = await createClient();
  const orgId = context.app.activeOrgId;
  const [typesResult, membersResult, settingsResult] = await Promise.all([
    HelpdeskTicketTypesService.listWithDetails(supabase, orgId),
    OrgMembersService.listMembers(supabase, orgId),
    HelpdeskTicketTypesService.getSettings(supabase, orgId),
  ]);

  const members = membersResult.success
    ? membersResult.data.map((m) => ({
        user_id: m.user_id,
        name: [m.user_first_name, m.user_last_name].filter(Boolean).join(" ") || null,
        email: m.user_email,
        avatar_url: m.user_avatar_url ?? null,
      }))
    : [];
  const settings = settingsResult.success ? settingsResult.data : null;
  const priorityConfigs = settings?.priority_configs ?? null;
  const pl = locale === "pl";

  const labels: Record<string, string> = {
    locale,
    title: t("pages.ticketTypes.title"),
    type: pl ? "Typ" : "Type",
    name: t("ticketTypes.name"),
    scope: t("ticketTypes.scope"),
    scopeOrg: t("ticketTypes.scopeOrg"),
    scopeBranch: t("ticketTypes.scopeBranch"),
    branch: t("ticketTypes.branchLabel"),
    priority: t("tickets.fields.priority"),
    responders: pl ? "Odpowiedzialni" : "Responders",
    acceptance: t("tickets.fields.requiresAcceptance"),
    status: pl ? "Stan" : "State",
    active: pl ? "Aktywny" : "Active",
    inactive: t("ticketTypes.inactive"),
    order: pl ? "Kolejność" : "Order",
    updatedAt: pl ? "Zaktualizowano" : "Updated",
    system: pl ? "Typ systemowy" : "System type",
    tak: pl ? "Tak" : "Yes",
    nie: pl ? "Nie" : "No",
    create: t("ticketTypes.createType"),
    viewType: t("ticketTypes.viewType"),
    preview: pl ? "Podgląd" : "Preview",
    edit: t("ticketTypes.editType"),
    delete: pl ? "Usuń" : "Delete",
    deleting: pl ? "Usuwanie…" : "Deleting…",
    cancel: t("tickets.cancel"),
    deleteConfirm: t("ticketTypes.deleteConfirm"),
    deleteConfirmDescription: t("ticketTypes.deleteConfirmDescription"),
    deleteSuccess: t("ticketTypes.deleteSuccess"),
    close: pl ? "Zamknij szczegóły" : "Close details",
    search: pl ? "Szukaj nazwy lub opisu…" : "Search name or description…",
    empty: typesResult.success
      ? pl
        ? "Brak typów pasujących do wyszukiwania i filtrów."
        : "No types match the search and filters."
      : pl
        ? "Nie udało się wczytać danych."
        : "Could not load data.",
    notFound: pl ? "Typ nie istnieje lub nie jest dostępny." : "Type not found or unavailable.",
    countSuffix: pl ? "typów" : "types",
  };
  for (const priority of TICKET_PRIORITIES) {
    labels[`priority_${priority}`] =
      priorityConfigs?.[priority]?.label ??
      t(`tickets.priority.${priority}` as Parameters<typeof t>[0]);
  }

  const set = ticketTypeColumnSet(labels);
  const cookie = `ambra_helpdesk_types_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);
  const typePathTemplate = getPathname({
    locale,
    href: {
      pathname: "/dashboard/help-desk/ticket-types/[typeId]",
      params: { typeId: "__TYPE__" },
    },
  });

  return (
    <TicketTypesView
      types={typesResult.success ? typesResult.data : []}
      path={path}
      set={set}
      layout={layout}
      widths={widths}
      cookie={cookie}
      labels={labels}
      members={members}
      branches={context.app.availableBranches.map((b) => ({ id: b.id, name: b.name }))}
      priorityConfigs={priorityConfigs}
      typePathTemplate={typePathTemplate}
    />
  );
}
