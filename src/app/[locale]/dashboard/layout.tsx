import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { EntitlementsService } from "@/server/services/entitlements-service";
import { buildSidebarModel } from "@/server/sidebar/build-sidebar-model";
import { DashboardV2Providers } from "./_providers";
import { DashboardShell } from "./_components/dashboard-shell";
import Script from "next/script";

/**
 * Dashboard V2 Layout
 *
 * Server layout component that:
 * 1. Loads context server-side via loadDashboardContextV2()
 * 2. Redirects to sign-in if no context (unauthenticated)
 * 3. Loads entitlements for sidebar filtering
 * 4. Builds sidebar model server-side (SSR)
 * 5. Passes context to DashboardV2Providers for client hydration
 * 6. Renders sidebar and main content area
 *
 * Pattern: Server loads → Client hydrates → Components use data
 */
export default async function DashboardV2Layout({ children }: { children: React.ReactNode }) {
  // Load context server-side
  const context = await loadDashboardContextV2();
  const locale = await getLocale();

  // Redirect to sign-in if no context (unauthenticated or no organization)
  if (!context) {
    return redirect({ href: "/sign-in", locale });
  }

  // Load entitlements for sidebar (SSR only)
  // Null-safe: fail-closed if org has no entitlements
  let entitlements = null;
  if (context.app.activeOrgId) {
    entitlements = await EntitlementsService.loadEntitlements(context.app.activeOrgId);
  }

  // Build sidebar model server-side (deterministic, permission-filtered)
  const sidebarModel = buildSidebarModel(context.app, context.user, entitlements, locale);

  return (
    <>
      <Script
        id="color-theme-loader"
        strategy="beforeInteractive"
        dangerouslySetInnerHTML={{
          __html: `
            try {
              const theme = localStorage.getItem('color-theme') || 'default';
              if (theme !== 'default') {
                document.documentElement.setAttribute('data-theme', theme);
              }
            } catch (e) {}
          `,
        }}
      />
      <DashboardV2Providers context={context}>
        <DashboardShell sidebarModel={sidebarModel}>{children}</DashboardShell>
      </DashboardV2Providers>
    </>
  );
}
// Force rebuild: 1769765116
