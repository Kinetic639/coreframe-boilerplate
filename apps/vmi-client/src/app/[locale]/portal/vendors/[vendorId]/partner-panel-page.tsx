import { notFound } from "next/navigation";
import { VmiAppShell } from "@/components/layout/vmi-app-shell";
import { PartnerPanelExperience } from "@/components/vmi-portal/partner-panel-experience";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";
import type { PartnerPanelTab } from "@/lib/vmi-portal/vendor-slugs";
import { resolveVendorByPortalSlug } from "@/lib/vmi-portal/vendor-slugs";

export async function PartnerPanelPage({
  vendorSlug,
  initialTab,
}: {
  vendorSlug: string;
  initialTab: PartnerPanelTab;
}) {
  const snapshot = await VmiPortalRepository.getSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  const vendor = resolveVendorByPortalSlug(snapshot.data.vendors, vendorSlug);
  if (!vendor) notFound();

  const activeLocationId = snapshot.data.user.activeLocationId;
  const products = snapshot.data.inventory.filter(
    (item) => item.vendorId === vendor.id && item.locationId === activeLocationId,
  );
  const orders = snapshot.data.orders.filter((order) => order.vendorId === vendor.id);
  const proposals = snapshot.data.proposals.filter((proposal) => proposal.vendorId === vendor.id);

  return (
    <VmiAppShell activeHref="/portal/vendors">
      <PartnerPanelExperience
        vendor={vendor}
        products={products}
        orders={orders}
        proposals={proposals}
        locations={snapshot.data.locations}
        activeLocationId={activeLocationId}
        initialTab={initialTab}
      />
    </VmiAppShell>
  );
}
