import { entitlements } from "@/server/guards/entitlements-guards";
import { MODULE_ORGANIZATION_MANAGEMENT } from "@/lib/constants/modules";

export default async function OrganizationLayout({ children }: { children: React.ReactNode }) {
  await entitlements.requireModuleOrRedirect(MODULE_ORGANIZATION_MANAGEMENT);
  return <>{children}</>;
}
