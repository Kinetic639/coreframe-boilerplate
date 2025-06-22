import React from "react";
import { createClient } from "@/utils/supabase/server";
import { getUserRolesFromJWT, UserRole } from "@/utils/auth/getUserRolesFromJWT";
import HasAnyRoleServer from "@/components/auth/HasAnyRoleServer";

async function simulateLoading(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export default async function DeliveriesPage() {
  const supabase = await createClient();
  const {
    data: { session },
  } = await supabase.auth.getSession();

  const token = session?.access_token;
  const roles: UserRole[] = token ? getUserRolesFromJWT(token) : [];

  await simulateLoading(2000);

  return (
    <div className="space-y-6">
      <h1 className="text-xl font-bold">Start</h1>

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

      {/* Przykład 1: tylko dla org_owner danej organizacji */}
      <HasAnyRoleServer
        checks={[{ role: "org_owner", scope: "org", id: "37386a4a-61de-486a-bcda-70272a732c21" }]}
        fallback={<p className="text-red-500">Nie jesteś właścicielem organizacji.</p>}
      >
        <div className="border bg-green-100 p-4">✅ Dostęp: org_owner organizacji</div>
      </HasAnyRoleServer>

      {/* Przykład 2: member jakiegokolwiek oddziału */}
      <HasAnyRoleServer
        checks={[{ role: "member", scope: "branch" }]}
        fallback={<p className="text-red-500">Nie jesteś członkiem żadnego oddziału.</p>}
      >
        <div className="border bg-blue-100 p-4">✅ Dostęp: member w dowolnym oddziale</div>
      </HasAnyRoleServer>

      {/* Przykład 3: member konkretnej organizacji */}
      <HasAnyRoleServer
        checks={[{ role: "member", scope: "org", id: "37386a4a-61de-486a-bcda-70272a732c21" }]}
        fallback={<p className="text-red-500">Nie jesteś członkiem tej organizacji.</p>}
      >
        <div className="border bg-yellow-100 p-4">✅ Dostęp: member organizacji</div>
      </HasAnyRoleServer>

      {/* Przykład 4: jakikolwiek admin (org lub branch) */}
      <HasAnyRoleServer
        checks={[
          { role: "admin", scope: "org" },
          { role: "admin", scope: "branch" },
        ]}
        fallback={<p className="text-red-500">Brak roli administratora.</p>}
      >
        <div className="border bg-purple-100 p-4">✅ Dostęp: dowolny admin</div>
      </HasAnyRoleServer>
    </div>
  );
}
