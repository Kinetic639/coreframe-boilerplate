import type { Metadata } from "next";
import Image from "next/image";
import { notFound } from "next/navigation";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { VendorProfileTabs } from "@/components/public-marketplace/vendor-profile-tabs";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface VendorDetailPageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: VendorDetailPageProps): Promise<Metadata> {
  const { slug } = await params;
  const supplierResult = await PublicMarketplaceRepository.getSupplierBySlug(slug);

  if (!supplierResult.success) {
    return {
      title: "Dostawca VMI | Ambra System",
      robots: { index: false, follow: false },
    };
  }

  const supplier = supplierResult.data;
  return {
    title: `${supplier.name} | Dostawca VMI | Ambra System`,
    description: supplier.shortDescription,
    alternates: {
      canonical: `/vmi/vendors/${supplier.slug}`,
    },
    openGraph: {
      title: `${supplier.name} | Dostawca VMI | Ambra System`,
      description: supplier.shortDescription,
      url: `/vmi/vendors/${supplier.slug}`,
      images: supplier.coverUrl ? [{ url: supplier.coverUrl }] : undefined,
    },
  };
}

export default async function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { slug } = await params;
  const [supplierResult, snapshot] = await Promise.all([
    PublicMarketplaceRepository.getSupplierBySlug(slug),
    PublicMarketplaceRepository.getMarketplaceSnapshot(),
  ]);

  if (!supplierResult.success) notFound();
  if (!snapshot.success) throw new Error(snapshot.error);

  const supplier = supplierResult.data;
  const products = snapshot.data.products.filter((product) => product.vendorId === supplier.id);
  const catalogs = snapshot.data.catalogs.filter((catalog) => catalog.vendorId === supplier.id);

  return (
    <PublicMarketplaceShell>
      <section className="relative border-b border-border bg-background">
        <div className="relative h-44 overflow-hidden bg-muted md:h-60">
          <Image
            src={supplier.coverUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/60 to-transparent" />
        </div>
      </section>

      <VendorProfileTabs supplier={supplier} products={products} catalogs={catalogs} />
    </PublicMarketplaceShell>
  );
}
