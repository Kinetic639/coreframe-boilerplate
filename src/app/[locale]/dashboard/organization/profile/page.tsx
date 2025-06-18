import OrganizationProfileForm from "@/modules/organization-managment/OrganizationProfileForm";
import { loadAppContextServer } from "@/lib/api/load-app-context-server";

export default async function OrganizationProfilePage() {
  const context = await loadAppContextServer();

  if (!context?.activeOrg) {
    return <div className="text-center text-red-500">Nie znaleziono profilu organizacji.</div>;
  }

  return (
    <div className="mx-auto max-w-4xl py-10">
      <h1 className="mb-6 text-2xl font-bold">Profil organizacji</h1>
      <OrganizationProfileForm defaultValues={context.activeOrg} />
    </div>
  );
}
