// app/dashboard/organization/profile/page.tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import OrganizationPreview from "@/modules/organization-managment/OrganizationPreview";
import OrganizationForm from "@/modules/organization-managment/OrganizationProfileForm";
import { notFound } from "next/navigation";

export default async function OrganizationProfilePage() {
  const context = await loadAppContextServer();
  if (!context?.activeOrg) notFound();

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Profil organizacji</h1>
      <p className="text-muted-foreground">
        Zarządzaj podstawowymi informacjami o organizacji, logo i kolorami motywu
      </p>
      <div className="grid grid-cols-1 gap-6 px-4 lg:grid-cols-[3fr_2fr]">
        <OrganizationForm defaultValues={context.activeOrg} />
        <OrganizationPreview values={context.activeOrg} />
      </div>
    </div>
  );
}
