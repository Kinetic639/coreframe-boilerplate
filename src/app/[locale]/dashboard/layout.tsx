import { redirect } from "next/navigation";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { DashboardV2Providers } from "./_providers";
import { DashboardShell } from "./_components/dashboard-shell";

export default async function DashboardLayout({ children }: { children: React.ReactNode }) {
  const context = await loadDashboardContextV2();

  if (!context) {
    redirect("/sign-in");
  }

  return (
    <DashboardV2Providers context={context}>
      <DashboardShell>{children}</DashboardShell>
    </DashboardV2Providers>
  );
}
