import type { VmiPortalVendorDto } from "./types";

export const partnerTabs = ["overview", "catalog", "promotions", "quotations", "cart", "contact"] as const;

export type PartnerPanelTab = (typeof partnerTabs)[number];

export function vendorIdToPortalSlug(vendorId: string) {
  return vendorId.replace(/^vendor-/, "");
}

export function vendorPortalPath(vendorId: string, tab: PartnerPanelTab = "overview") {
  return `/portal/vendors/${vendorIdToPortalSlug(vendorId)}/${tab}`;
}

export function resolveVendorByPortalSlug(vendors: VmiPortalVendorDto[], slug: string) {
  return vendors.find((vendor) => vendor.id === slug || vendorIdToPortalSlug(vendor.id) === slug) ?? null;
}

export function isPartnerPanelTab(value: string): value is PartnerPanelTab {
  return partnerTabs.includes(value as PartnerPanelTab);
}
