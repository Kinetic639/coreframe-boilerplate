import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { Metadata } from "next";

export const metadata: Metadata = {
  title: "Aktywny oddział",
};

export default async function BranchPage() {
  const appContext = await loadAppContextServer();

  if (!appContext || !appContext.activeBranch) {
    return <div className="p-6 text-center text-destructive">Brak wybranego oddziału</div>;
  }

  const { activeBranch, activeOrg } = appContext;

  return (
    <div className="space-y-4 p-6">
      <h1 className="text-xl font-bold">Informacje o aktywnym oddziale</h1>

      <div className="rounded border p-4">
        <p>
          <strong>Nazwa oddziału:</strong> {activeBranch.name}
        </p>
        <p>
          <strong>ID oddziału:</strong> {activeBranch.id}
        </p>
        <p>
          <strong>Należy do organizacji:</strong> {activeOrg?.organization_id ?? "Brak"}
        </p>
      </div>
    </div>
  );
}
