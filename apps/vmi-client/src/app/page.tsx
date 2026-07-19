import { PrototypeMarketplaceHome } from "@/components/public-marketplace/prototype-home";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

export default async function HomePage() {
  const snapshot = await PublicMarketplaceRepository.getMarketplaceSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <PublicMarketplaceShell>
      <PrototypeMarketplaceHome snapshot={snapshot.data} />
    </PublicMarketplaceShell>
  );
}
