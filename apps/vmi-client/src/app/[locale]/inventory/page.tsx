import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { InventoryExperience } from "@/components/vmi-portal/inventory-experience";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function InventoryPage() {
  await requireDemoSession();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/inventory">
      <InventoryExperience
        inventory={snapshot.data.inventory}
        vendors={snapshot.data.vendors}
        locations={snapshot.data.locations}
        activeLocationId={snapshot.data.user.activeLocationId}
        orders={snapshot.data.orders}
      />
    </VmiAppShell>
  );
}
