import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import OrganizationLogoUploader from "@/modules/organization-managment/OrganizationLogoUploader";
import OrganizationProfileForm from "@/modules/organization-managment/OrganizationProfileForm";

export default async function OrganizationProfilePage() {
  const context = await loadAppContextServer();

  if (!context?.activeOrg) {
    return <div className="text-center text-red-500">Nie znaleziono profilu organizacji.</div>;
  }

  const { logo_url, organization_id } = context.activeOrg;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6 py-6">
      <h1 className="mb-6 text-2xl font-bold">Profil organizacji</h1>
      <OrganizationLogoUploader logoUrl={logo_url} organizationId={organization_id} />
      <OrganizationProfileForm defaultValues={context.activeOrg} />
    </div>
  );
}
