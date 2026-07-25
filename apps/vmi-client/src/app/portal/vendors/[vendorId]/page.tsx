import { notFound, redirect } from "next/navigation";
import { requireDemoSession } from "@/lib/demo-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";
import { resolveVendorByPortalSlug, vendorPortalPath } from "@/lib/vmi-portal/vendor-slugs";

interface PortalVendorRedirectPageProps {
  params: Promise<{
    vendorId: string;
  }>;
}

export default async function PortalVendorRedirectPage({ params }: PortalVendorRedirectPageProps) {
  await requireDemoSession();

  const { vendorId } = await params;
  const vendors = await VmiPortalRepository.listVendors();
  if (!vendors.success) throw new Error(vendors.error);

  const vendor = resolveVendorByPortalSlug(vendors.data, vendorId);
  if (!vendor) notFound();

  redirect(vendorPortalPath(vendor.id, "overview"));
}
