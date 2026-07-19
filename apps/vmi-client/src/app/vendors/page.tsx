import { Suspense } from "react";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { VendorSearchExperience } from "@/components/public-marketplace/vendor-search-experience";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

export default async function VendorsPage() {
  const snapshot = await PublicMarketplaceRepository.getMarketplaceSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  return (
    <PublicMarketplaceShell>
      <Suspense
        fallback={
          <div className="mx-auto max-w-7xl px-4 py-6">
            <div className="h-[calc(100vh-6rem)] rounded-2xl bg-card shadow-sm" />
          </div>
        }
      >
        <VendorSearchExperience
          suppliers={snapshot.data.suppliers}
          products={snapshot.data.products}
          cities={snapshot.data.cities}
          categories={snapshot.data.categories}
          brands={snapshot.data.brands}
        />
      </Suspense>
    </PublicMarketplaceShell>
  );
}
