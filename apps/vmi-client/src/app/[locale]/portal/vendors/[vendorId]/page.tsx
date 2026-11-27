import { notFound } from "next/navigation";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { requireVmiAccess } from "@/lib/vmi-session";
import { VmiPortalRepository } from "@/lib/vmi-portal/repository";
import { resolveVendorByPortalSlug, vendorIdToPortalSlug } from "@/lib/vmi-portal/vendor-slugs";

interface PortalVendorRedirectPageProps {
  params: Promise<{
    vendorId: string;
  }>;
}

export default async function PortalVendorRedirectPage({ params }: PortalVendorRedirectPageProps) {
  await requireVmiAccess();

  const { vendorId } = await params;
  const vendors = await VmiPortalRepository.listVendors();
  if (!vendors.success) throw new Error(vendors.error);

  const vendor = resolveVendorByPortalSlug(vendors.data, vendorId);
  if (!vendor) notFound();

  const locale = await getLocale();
  redirect({
    href: {
      pathname: "/portal/vendors/[vendorId]/[tab]",
      params: { vendorId: vendorIdToPortalSlug(vendor.id), tab: "overview" },
    },
    locale,
  });
}
