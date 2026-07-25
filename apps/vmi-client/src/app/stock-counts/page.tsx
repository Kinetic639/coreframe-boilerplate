import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { StockCountsExperience } from "@/components/vmi-portal/stock-counts-experience";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function StockCountsPage() {
  await requireDemoSession();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/stock-counts">
      <StockCountsExperience
        vendors={snapshot.data.vendors}
        locations={snapshot.data.locations}
        inventory={snapshot.data.inventory}
        requests={snapshot.data.stockCountRequests}
        activeLocationId={snapshot.data.user.activeLocationId}
      />
    </VmiAppShell>
  );
}
