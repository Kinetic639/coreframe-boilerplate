import { redirect } from "@/i18n/navigation";
import { getLocale } from "next-intl/server";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "./_providers";
import { DashboardShell } from "./_components/dashboard-shell";
import Script from "next/script";

/**
 * Dashboard V2 Layout
 *
 * Server layout component that:
 * 1. Loads context server-side via loadDashboardContextV2()
 * 2. Redirects to sign-in if no context (unauthenticated)
 * 3. Passes context to DashboardV2Providers for client hydration
 * 4. Renders sidebar and main content area
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
        <DashboardShell>{children}</DashboardShell>
      </DashboardV2Providers>
    </>
  );
}
// Force rebuild: 1769765116
