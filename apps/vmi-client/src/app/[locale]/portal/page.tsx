import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { PortalDashboard } from "@/components/vmi-portal/portal-dashboard";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function PortalPage() {
  await requireDemoSession();

  const dashboard = await VmiPortalRepository.getDashboardSummary();
  if (!dashboard.success) throw new Error(dashboard.error);

  return (
    <VmiAppShell activeHref="/portal">
      <PortalDashboard dashboard={dashboard.data} />
    </VmiAppShell>
  );
}
