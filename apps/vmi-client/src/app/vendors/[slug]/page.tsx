import Image from "next/image";
import Link from "next/link";
import { Mail, MapPin, Phone, ShieldCheck, Truck } from "lucide-react";
import { ProductCard } from "@/components/public-marketplace/product-card";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface VendorDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function VendorDetailPage({ params }: VendorDetailPageProps) {
  const { slug } = await params;
  const [supplierResult, snapshot] = await Promise.all([
    PublicMarketplaceRepository.getSupplierBySlug(slug),
    PublicMarketplaceRepository.getMarketplaceSnapshot(),
  ]);

  if (!supplierResult.success) throw new Error(supplierResult.error);
  if (!snapshot.success) throw new Error(snapshot.error);

  const supplier = supplierResult.data;
  const products = snapshot.data.products
    .filter((product) => product.vendorId === supplier.id)
    .slice(0, 8);
  const catalogs = snapshot.data.catalogs.filter((catalog) => catalog.vendorId === supplier.id);
  const flyers = snapshot.data.flyers.filter((flyer) => flyer.vendorId === supplier.id);

  return (
    <PublicMarketplaceShell>
      <section className="relative border-b border-border bg-background">
        <div className="relative h-64 overflow-hidden bg-muted">
          <Image
            src={supplier.coverUrl}
            alt=""
            fill
            priority
            unoptimized
            sizes="100vw"
            className="object-cover"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-background via-background/40 to-transparent" />
        </div>

        <div className="relative mx-auto -mt-24 max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="relative h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-card shadow-xl">
              <Image
                src={supplier.logoUrl}
                alt=""
                fill
                unoptimized
                sizes="112px"
                className="object-cover"
              />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {supplier.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-3 py-1 text-xs font-black uppercase text-emerald-700">
                    <ShieldCheck className="h-4 w-4" />
                    Zweryfikowany
                  </span>
                ) : null}
                {supplier.vmiReady ? (
                  <span className="rounded-full bg-accent px-3 py-1 text-xs font-black uppercase text-accent-foreground">
                    VMI-ready
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-4xl font-black tracking-normal text-foreground">
                {supplier.name}
              </h1>
              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {supplier.shortDescription}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl font-black text-foreground">O dostawcy</h2>
            <p className="mt-3 text-sm leading-7 text-muted-foreground">
              {supplier.longDescription}
            </p>
            <div className="mt-5 flex flex-wrap gap-2">
              {supplier.categories.map((category) => (
                <Link
                  key={category}
                  href={`/vendors?category=${encodeURIComponent(category)}`}
                  className="rounded-full bg-secondary px-3 py-1 text-xs font-black text-muted-foreground"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-black text-foreground">Produkty dostawcy</h2>
              <Link
                href={`/products?vendorId=${supplier.id}`}
                className="text-sm font-black text-amber-700"
              >
                Zobacz wszystkie
              </Link>
            </div>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} supplier={supplier} />
              ))}
            </div>
          </div>
        </div>

        <aside className="space-y-4">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-sm font-black text-foreground">Kontakt i logistyka</h2>
            <div className="mt-4 space-y-3 text-sm font-bold text-muted-foreground">
              <p className="flex gap-2">
                <MapPin className="h-4 w-4 text-amber-700" />
                {supplier.address}
              </p>
              <p className="flex gap-2">
                <Mail className="h-4 w-4 text-amber-700" />
                {supplier.contactEmail}
              </p>
              <p className="flex gap-2">
                <Phone className="h-4 w-4 text-amber-700" />
                {supplier.contactPhone}
              </p>
              <p className="flex gap-2">
                <Truck className="h-4 w-4 text-amber-700" />
                {supplier.deliveryTerms}
              </p>
            </div>
          </div>

          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-sm font-black text-foreground">Katalogi i gazetki</h2>
            <div className="mt-4 space-y-3">
              {catalogs.map((catalog) => (
                <div key={catalog.id} className="rounded-xl bg-muted p-3">
                  <p className="text-sm font-black text-foreground">{catalog.title}</p>
                  <p className="mt-1 text-xs font-bold text-muted-foreground">
                    {catalog.productCount} produktów
                  </p>
                </div>
              ))}
              {flyers.map((flyer) => (
                <Link
                  key={flyer.id}
                  href={`/flyers/${flyer.slug}`}
                  className="block rounded-xl bg-amber-50 p-3"
                >
                  <p className="text-sm font-black text-amber-950">{flyer.title}</p>
                  <p className="mt-1 text-xs font-bold text-amber-700">Zobacz gazetkę</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </PublicMarketplaceShell>
  );
}
