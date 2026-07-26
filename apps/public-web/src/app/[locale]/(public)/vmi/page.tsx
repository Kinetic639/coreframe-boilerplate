import type { Metadata } from "next";
import { PrototypeMarketplaceHome } from "@/components/public-marketplace/prototype-home";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

export const metadata: Metadata = {
  title: "VMI Marketplace | Ambra System",
  description: "Publiczny katalog dostawców, produktów i gazetek VMI dla firm korzystających z Ambra System.",
  alternates: {
    canonical: "/vmi",
  },
  openGraph: {
    title: "VMI Marketplace | Ambra System",
    description: "Publiczny katalog dostawców, produktów i gazetek VMI dla firm korzystających z Ambra System.",
    url: "/vmi",
  },
};

export default async function HomePage() {
  const snapshot = await PublicMarketplaceRepository.getMarketplaceSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <PublicMarketplaceShell>
      <PrototypeMarketplaceHome snapshot={snapshot.data} />
    </PublicMarketplaceShell>
  );
}
