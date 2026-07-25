import { notFound, redirect } from "next/navigation";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";
import {
  isPartnerPanelTab,
  resolveVendorByPortalSlug,
  vendorPortalPath,
} from "@/lib/vmi-portal/vendor-slugs";
import { PartnerPanelPage } from "../partner-panel-page";

interface PortalVendorTabPageProps {
  params: Promise<{
    vendorId: string;
    tab: string;
  }>;
}

export default async function PortalVendorTabPage({ params }: PortalVendorTabPageProps) {
  await requireDemoSession();

  const { vendorId, tab } = await params;
  const vendors = await VmiPortalRepository.listVendors();
  if (!vendors.success) throw new Error(vendors.error);

  const vendor = resolveVendorByPortalSlug(vendors.data, vendorId);
  if (!vendor) notFound();
  if (!isPartnerPanelTab(tab)) notFound();

  const canonicalPath = vendorPortalPath(vendor.id, tab);
  if (`/portal/vendors/${vendorId}/${tab}` !== canonicalPath) {
    redirect(canonicalPath);
  }

  return <PartnerPanelPage vendorSlug={vendorId} initialTab={tab} />;
}
