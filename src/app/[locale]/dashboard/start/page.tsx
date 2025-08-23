import React from "react";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";
import { getAllWidgets } from "@/modules";
import { WidgetRenderer } from "@/modules/WidgetRenderer";
import PermissionDebug from "@/components/debug/PermissionDebug";
import { PermissionTestComponent } from "@/components/debug/PermissionTestComponent";
import { getTranslations } from "next-intl/server";
import { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

type Props = {
  params: Promise<{ locale: string }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { locale } = await params;
  const t = await getTranslations({ locale, namespace: "metadata.dashboard.start" });
  const common = await getTranslations({ locale, namespace: "metadata.common" });

  return {
    title: `${t("title")}${common("separator")}${common("appName")}`,
    description: t("description"),
    robots: {
      index: false,
      follow: false,
    },
  };
}

export default async function StartPage() {
  const userContext = await loadUserContextServer();
  const appContext = await loadAppContextServer();

  if (!userContext || !appContext) {
    const locale = await getLocale();
    return redirect({ href: "/sign-in", locale });
  }

  const { roles, permissions } = userContext;
  const { activeOrgId, activeOrg } = appContext;

  // Pobierz widgety
  const widgets = activeOrgId ? await getAllWidgets(activeOrgId) : [];

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Start</h1>

      {/* 🟩 Widgety */}
      {widgets.length > 0 && (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {widgets.map((widget) => (
            <WidgetRenderer key={widget.id} widget={widget} />
          ))}
        </div>
      )}

      {/* 📋 Role użytkownika */}
      <div>
        <h2 className="text-lg font-semibold">Role użytkownika:</h2>
        <ul className="list-inside list-disc">
          {roles.length > 0 ? (
            roles.map((r, i) => (
              <li key={i}>
                <strong>{r.role}</strong>{" "}
                {r.org_id
                  ? `(organizacja: ${r.org_id})`
                  : r.branch_id
                    ? `(oddział: ${r.branch_id})`
                    : ""}
              </li>
            ))
          ) : (
            <li>Brak ról</li>
          )}
        </ul>
      </div>

      {/* 🔑 Uprawnienia użytkownika */}
      <div>
        <h2 className="text-lg font-semibold">Uprawnienia użytkownika:</h2>
        {permissions.length > 0 ? (
          <div className="mt-2 grid grid-cols-2 gap-2">
            {permissions.map((permission, i) => (
              <span key={i} className="rounded bg-blue-100 px-2 py-1 text-sm text-blue-800">
                {permission}
              </span>
            ))}
          </div>
        ) : (
          <p>Brak uprawnień</p>
        )}
      </div>

      {/* 🏢 Informacje o organizacji */}
      <div>
        <h2 className="text-lg font-semibold">Aktualna organizacja:</h2>
        {activeOrg ? (
          <div className="rounded bg-gray-100 p-4">
            <p>
              <strong>Nazwa:</strong> {activeOrg.name}
            </p>
            <p>
              <strong>Slug:</strong> {activeOrg.slug}
            </p>
            <p>
              <strong>ID:</strong> {activeOrgId}
            </p>
          </div>
        ) : (
          <p className="text-red-500">Brak aktywnej organizacji</p>
        )}
      </div>

      {/* 🔐 Przykładowe sprawdzenia dostępu */}
      {activeOrgId && (
        <HasAnyRoleServer
          checks={[{ role: "org_owner", scope: "org", id: activeOrgId }]}
          fallback={<p className="text-red-500">Nie jesteś właścicielem organizacji.</p>}
        >
          <div className="border bg-green-100 p-4">✅ Jesteś właścicielem organizacji</div>
        </HasAnyRoleServer>
      )}

      <HasAnyRoleServer
        checks={[{ role: "member", scope: "branch" }]}
        fallback={<p className="text-red-500">Nie jesteś członkiem żadnego oddziału.</p>}
      >
        <div className="border bg-blue-100 p-4">✅ Dostęp: member w dowolnym oddziale</div>
      </HasAnyRoleServer>

      {activeOrgId && (
        <HasAnyRoleServer
          checks={[{ role: "org_admin", scope: "org", id: activeOrgId }]}
          fallback={<p className="text-red-500">Nie jesteś administratorem organizacji.</p>}
        >
          <div className="border bg-purple-100 p-4">✅ Dostęp: administrator organizacji</div>
        </HasAnyRoleServer>
      )}
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Debug Components</h1>
        <PermissionDebug />
        <PermissionTestComponent />
      </div>
    </div>
  );
}
