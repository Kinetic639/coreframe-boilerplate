import React from "react";
import { createClient } from "@/utils/supabase/server";
import { getUserRolesFromJWT } from "@/utils/auth/getUserRolesFromJWT";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";
import { getAllWidgets } from "@/modules";
import { WidgetRenderer } from "@/modules/WidgetRenderer";
import { UserRoleFromToken } from "@/lib/types/user";
import PermissionDebug from "@/components/debug/PermissionDebug";

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const roles: UserRoleFromToken[] = token ? getUserRolesFromJWT(token) : [];

  // Pobierz aktywną organizację z pierwszej roli (w przyszłości z kontekstu)
  const activeOrgId = roles.find((r) => r.org_id)?.org_id;

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
                {r.role}{" "}
                {r.org_id ? `(org: ${r.org_id})` : r.branch_id ? `(branch: ${r.branch_id})` : ""}
              </li>
            ))
          ) : (
            <li>Brak ról</li>
          )}
        </ul>
      </div>

      {/* 🔐 Przykładowe sprawdzenia dostępu */}
      <HasAnyRoleServer
        checks={[{ role: "org_owner", scope: "org", id: "37386a4a-61de-486a-bcda-70272a732c21" }]}
        fallback={<p className="text-red-500">Nie jesteś właścicielem organizacji.</p>}
      >
        <div className="border bg-green-100 p-4">✅ Dostęp: org_owner organizacji</div>
      </HasAnyRoleServer>

      <HasAnyRoleServer
        checks={[{ role: "member", scope: "branch" }]}
        fallback={<p className="text-red-500">Nie jesteś członkiem żadnego oddziału.</p>}
      >
        <div className="border bg-blue-100 p-4">✅ Dostęp: member w dowolnym oddziale</div>
      </HasAnyRoleServer>

      <HasAnyRoleServer
        checks={[{ role: "member", scope: "org", id: "37386a4a-61de-486a-bcda-70272a732c21" }]}
        fallback={<p className="text-red-500">Nie jesteś członkiem tej organizacji.</p>}
      >
        <div className="border bg-yellow-100 p-4">✅ Dostęp: member organizacji</div>
      </HasAnyRoleServer>

      <HasAnyRoleServer
        checks={[
          { role: "admin", scope: "org" },
          { role: "admin", scope: "branch" },
        ]}
        fallback={<p className="text-red-500">Brak roli administratora.</p>}
      >
        <div className="border bg-purple-100 p-4">✅ Dostęp: dowolny admin</div>
      </HasAnyRoleServer>
      <div className="space-y-4">
        <h1 className="text-xl font-bold">Dashboard</h1>
        <PermissionDebug />
      </div>
    </div>
  );
}
