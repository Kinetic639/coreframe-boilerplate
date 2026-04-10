import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { checkPermission } from "@/lib/utils/permissions";
import { SUPERADMIN_PRICING_READ } from "@/lib/constants/permissions";

export default async function AdminPricingPage() {
  const locale = await getLocale();
  const context = await loadAdminContextV2();

  if (!context?.adminEntitlements?.enabled) {
    return redirect({ href: "/sign-in", locale });
  }

  if (!checkPermission(context.permissionSnapshot, SUPERADMIN_PRICING_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Pricing Configuration</h1>
        <p className="mt-1 text-muted-foreground">
          Manage pricing configuration. Full implementation coming soon.
        </p>
      </div>
    </div>
  );
}
