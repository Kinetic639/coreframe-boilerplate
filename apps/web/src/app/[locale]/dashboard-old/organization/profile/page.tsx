// app/dashboard/organization/profile/page.tsx
import { loadAppContextServer } from "@/lib/api/load-app-context-server";
import { loadUserContextServer } from "@/lib/api/load-user-context-server";
import { AppContext } from "@/lib/stores/app-store";
import OrganizationPreview from "@/modules/organization-managment/OrganizationPreview";
import OrganizationForm from "@/modules/organization-managment/OrganizationProfileForm";
import { notFound } from "next/navigation";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";

export default async function OrganizationProfilePage() {
  const userContext = await loadUserContextServer();
  const appContext: AppContext | null = await loadAppContextServer();

  // Check if user is authenticated and has context
  if (!userContext || !appContext?.activeOrg) {
    const locale = await getLocale();
    return redirect({ href: "/sign-in", locale });
  }

  // Check if user has permission to update organization profile
  const hasPermission = userContext.permissions.includes("organization.profile.update");

  if (!hasPermission) {
    notFound();
  }

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold tracking-tight">Profil organizacji</h1>
      <p className="text-muted-foreground">
        Zarządzaj podstawowymi informacjami o organizacji, logo i kolorami motywu
      </p>
      <div className="grid grid-cols-1 gap-6 px-4 lg:grid-cols-[3fr_2fr]">
        <OrganizationForm
          defaultValues={{
            ...appContext.activeOrg!,
            name: appContext.activeOrg!.name || "",
            slug: appContext.activeOrg!.slug || "",
          }}
        />
        <OrganizationPreview
          values={{
            ...appContext.activeOrg!,
            name: appContext.activeOrg!.name || "",
            slug: appContext.activeOrg!.slug || "",
          }}
        />
      </div>
    </div>
  );
}
