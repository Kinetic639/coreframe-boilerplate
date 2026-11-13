import { cookies } from "next/headers";
import { dehydrate, HydrationBoundary, QueryClient } from "@tanstack/react-query";
import { redirect as redirectUrl } from "next/navigation";
import { getLocale, getTranslations } from "next-intl/server";
import { getPathname, redirect } from "@/i18n/navigation";
import { toUnsafeI18nHref } from "@/lib/i18n/unsafe-href";
import { createClient } from "@/utils/supabase/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import {
  CRM_CONTACTS_CREATE,
  CRM_CONTACTS_DELETE,
  CRM_CONTACTS_READ,
  CRM_CONTACTS_UPDATE,
  MEMBERS_READ,
} from "@/lib/constants/permissions";
import { ContactsDirectoryService } from "@/server/services/contacts-directory.service";
import { OrgMembersService } from "@/server/services/organization.service";
import { parseLayout, parseWidths } from "@/components/kolor-sensu/data-table/columns";
import { contactKeys } from "./_components/contacts-query";
import { contactColumnSet } from "./_components/contacts-table";
import { ContactsWorkspace } from "./_components/contacts-workspace";
import {
  contactHref,
  contactListParams,
  loadContactState,
  migrateContactSearchParams,
} from "./_components/contacts-state";
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

/**
 * Contacts (Kolor Sensu list): employees and external contacts, the search,
 * the kind, the name order, the page and the open contact in the address.
 * The server puts the first page in the list's cache; the list fetches the
 * rest.
 */
export default async function CrmContactsPage({ searchParams }: PageProps = {}) {
  const [locale, context, t] = await Promise.all([
    getLocale(),
    loadDashboardContextV2(),
    getTranslations("modules.crm"),
  ]);
  if (!context?.app.activeOrgId) return redirect({ href: "/sign-in", locale });
  if (!checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_READ)) {
    return redirect({
      href: {
        pathname: "/dashboard/access-denied",
        query: { reason: "crm_contacts_read_required" },
      },
      locale,
    });
  }

  const path = getPathname({ locale, href: toUnsafeI18nHref("/dashboard/crm/contacts") });
  const migration = migrateContactSearchParams(searchParams ? await searchParams : {});
  const state = loadContactState(migration.params);
  if (migration.changed || state.strona < 1) {
    return redirectUrl(contactHref(path, state, { strona: Math.max(1, state.strona) }));
  }

  const orgId = context.app.activeOrgId;
  const supabase = await createClient();
  const canReadMembers = checkPermission(context.user.permissionSnapshot, MEMBERS_READ);
  const [result, membersResult] = await Promise.all([
    // Employees (from their profiles) + external contacts in one list
    ContactsDirectoryService.list(supabase, orgId, contactListParams(state)),
    canReadMembers
      ? OrgMembersService.listMembers(supabase, orgId)
      : Promise.resolve({ success: true as const, data: [] }),
  ]);
  if (result.success) {
    const lastPage = Math.max(1, Math.ceil(result.data.totalCount / state.wierszy));
    if (state.strona > lastPage) {
      return redirectUrl(contactHref(path, state, { strona: lastPage }));
    }
  }

  // The first page goes straight into the list's cache (no request on the
  // client); a failed read is left to the client, which retries.
  const queryClient = new QueryClient();
  if (result.success) queryClient.setQueryData(contactKeys.list(orgId, state), result.data);

  const memberOptions = membersResult.success
    ? membersResult.data
        .filter((member) => member.status === "active")
        .map((member) => {
          const name = [member.user_first_name, member.user_last_name].filter(Boolean).join(" ");
          return {
            userId: member.user_id,
            label: name || member.user_email || member.user_id,
            email: member.user_email,
          };
        })
    : [];

  const pl = locale === "pl";
  const labels: Record<string, string> = {
    locale,
    title: t("pages.contacts.title"),
    newContact: t("actions.newContact"),
    column_contact: t("fields.name"),
    column_kind: t("directory.kindFilter.label"),
    column_email: t("fields.email"),
    column_phone: t("fields.phone"),
    column_job_title: t("fields.jobTitle"),
    column_branch: t("directory.branchField"),
    kind_member: t("directory.kinds.member"),
    kind_external: t("directory.kinds.external"),
    filter_member: t("directory.kindFilter.member"),
    filter_external: t("directory.kindFilter.external"),
    visibility_private: t("visibility.private"),
    visibility_branch: t("visibility.branch"),
    visibility_organization: t("visibility.organization"),
    search: pl ? "Szukaj imienia, nazwiska, e-maila…" : "Search name, email…",
    preview: pl ? "Podgląd" : "Preview",
    close: pl ? "Zamknij" : "Close",
    empty: pl ? "Brak kontaktów dla tych filtrów" : "No contacts match these filters",
    emptyAll: pl ? "Brak kontaktów" : "No contacts yet",
    loadError: t("errors.loadRetry"),
    notFound: pl ? "Nie udało się wczytać kontaktu" : "Could not load the contact",
    retry: t("errors.tryAgain"),
    loading: pl ? "Wczytywanie…" : "Loading…",
    countSuffix: pl ? "kontaktów" : "contacts",
  };

  const set = contactColumnSet(labels);
  const cookie = `ambra_crm_contacts_${context.user.user.id}_${orgId}`;
  const jar = await cookies();
  const layout = parseLayout(set, cookieValue(jar.get(cookie)?.value));
  const widths = parseWidths(cookieValue(jar.get(`${cookie}_widths`)?.value), set);

  return (
    <HydrationBoundary state={dehydrate(queryClient)}>
      <ContactsWorkspace
        orgId={orgId}
        path={path}
        set={set}
        layout={layout}
        widths={widths}
        cookie={cookie}
        labels={labels}
        memberOptions={memberOptions}
        canCreate={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_CREATE)}
        canUpdate={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_UPDATE)}
        canDelete={checkPermission(context.user.permissionSnapshot, CRM_CONTACTS_DELETE)}
      />
    </HydrationBoundary>
  );
}
