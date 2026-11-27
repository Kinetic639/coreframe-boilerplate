import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { OrdersExperience } from "@/components/vmi-portal/orders-experience";
import { requireVmiAccess } from "@/lib/vmi-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";

export default async function OrdersPage() {
  await requireVmiAccess();

  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <VmiAppShell activeHref="/orders">
      <OrdersExperience
        orders={snapshot.data.orders}
        inventory={snapshot.data.inventory}
        vendors={snapshot.data.vendors}
        locations={snapshot.data.locations}
        activeLocationId={snapshot.data.user.activeLocationId}
      />
    </VmiAppShell>
  );
}
