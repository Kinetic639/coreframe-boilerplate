import type { Metadata } from "next";
import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadAdminContextV2 } from "@/server/loaders/v2/load-admin-context.v2";
import { requireAdminOrRedirect } from "@/lib/admin-entitlements/guards";
import { checkPermission } from "@/lib/utils/permissions";
import { SUPERADMIN_ADMIN_READ } from "@/lib/constants/permissions";
import { buildAdminSidebarModel } from "@/server/sidebar/build-admin-sidebar-model";
import { getUserDisplayName } from "@/utils/user-helpers";
import { AdminShell } from "./_components/admin-shell";

export const metadata: Metadata = {
  title: "Admin Panel | Ambra",
  description: "System administration tools — superadmin only",
};

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const locale = await getLocale();
  const context = await loadAdminContextV2();

  // Redirect to sign-in if unauthenticated
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }

  // Redirect to dashboard if user is not an admin
  requireAdminOrRedirect(context.adminEntitlements, locale);

  // Additional permission check: must have at least superadmin.admin.read
  if (!checkPermission(context.permissionSnapshot, SUPERADMIN_ADMIN_READ)) {
    return redirect({ href: "/dashboard/start", locale });
  }

  // Build sidebar model (cached within this RSC render)
  const sidebarModel = buildAdminSidebarModel(context.permissionSnapshot, locale);

  // Resolve display name — fall back to email if no real name is set
  const displayName = getUserDisplayName(context.user.first_name, context.user.last_name);
  const userData = {
    name: displayName !== "User" ? displayName : context.user.email,
    email: context.user.email,
    avatar: context.user.avatar_url ?? "",
  };

  return (
    <AdminShell sidebarModel={sidebarModel} user={userData}>
      {children}
    </AdminShell>
  );
}
