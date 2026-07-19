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
    PublicMarketplaceRepository.getMarketplaceSnapshot()
  ]);

  if (!supplierResult.success) throw new Error(supplierResult.error);
  if (!snapshot.success) throw new Error(snapshot.error);

  const supplier = supplierResult.data;
  const products = snapshot.data.products.filter((product) => product.vendorId === supplier.id).slice(0, 8);
  const catalogs = snapshot.data.catalogs.filter((catalog) => catalog.vendorId === supplier.id);
  const flyers = snapshot.data.flyers.filter((flyer) => flyer.vendorId === supplier.id);

  return (
    <PublicMarketplaceShell>
      <section className="relative bg-slate-950 text-white">
        <div className="relative h-64 overflow-hidden">
          <Image src={supplier.coverUrl} alt="" fill priority unoptimized sizes="100vw" className="object-cover opacity-45" />
          <div className="absolute inset-0 bg-gradient-to-t from-slate-950 via-slate-950/50 to-transparent" />
        </div>

        <div className="relative mx-auto -mt-24 max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-end">
            <div className="relative h-28 w-28 overflow-hidden rounded-3xl border-4 border-white bg-white shadow-xl">
              <Image src={supplier.logoUrl} alt="" fill unoptimized sizes="112px" className="object-cover" />
            </div>
            <div className="space-y-3">
              <div className="flex flex-wrap items-center gap-2">
                {supplier.verificationStatus === "verified" ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-emerald-400/15 px-3 py-1 text-xs font-black uppercase text-emerald-200">
                    <ShieldCheck className="h-4 w-4" />
                    Zweryfikowany
                  </span>
                ) : null}
                {supplier.vmiReady ? (
                  <span className="rounded-full bg-blue-400/15 px-3 py-1 text-xs font-black uppercase text-blue-200">
                    VMI-ready
                  </span>
                ) : null}
              </div>
              <h1 className="font-display text-4xl font-black tracking-normal">{supplier.name}</h1>
              <p className="max-w-3xl text-sm leading-6 text-slate-300">{supplier.shortDescription}</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mx-auto grid max-w-7xl gap-6 px-4 py-8 sm:px-6 lg:grid-cols-[1fr_360px] lg:px-8">
        <div className="space-y-6">
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-xl font-black text-slate-950">O dostawcy</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">{supplier.longDescription}</p>
            <div className="mt-5 flex flex-wrap gap-2">
              {supplier.categories.map((category) => (
                <Link
                  key={category}
                  href={`/vendors?category=${encodeURIComponent(category)}`}
                  className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600"
                >
                  {category}
                </Link>
              ))}
            </div>
          </div>

          <div className="space-y-4">
            <div className="flex items-center justify-between gap-3">
              <h2 className="font-display text-xl font-black text-slate-950">Produkty dostawcy</h2>
              <Link href={`/products?vendorId=${supplier.id}`} className="text-sm font-black text-blue-700">
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
          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-sm font-black text-slate-950">Kontakt i logistyka</h2>
            <div className="mt-4 space-y-3 text-sm font-bold text-slate-600">
              <p className="flex gap-2"><MapPin className="h-4 w-4 text-blue-700" />{supplier.address}</p>
              <p className="flex gap-2"><Mail className="h-4 w-4 text-blue-700" />{supplier.contactEmail}</p>
              <p className="flex gap-2"><Phone className="h-4 w-4 text-blue-700" />{supplier.contactPhone}</p>
              <p className="flex gap-2"><Truck className="h-4 w-4 text-blue-700" />{supplier.deliveryTerms}</p>
            </div>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="font-display text-sm font-black text-slate-950">Katalogi i gazetki</h2>
            <div className="mt-4 space-y-3">
              {catalogs.map((catalog) => (
                <div key={catalog.id} className="rounded-xl bg-slate-50 p-3">
                  <p className="text-sm font-black text-slate-950">{catalog.title}</p>
                  <p className="mt-1 text-xs font-bold text-slate-500">{catalog.productCount} produktów</p>
                </div>
              ))}
              {flyers.map((flyer) => (
                <Link key={flyer.id} href={`/flyers/${flyer.slug}`} className="block rounded-xl bg-blue-50 p-3">
                  <p className="text-sm font-black text-blue-950">{flyer.title}</p>
                  <p className="mt-1 text-xs font-bold text-blue-700">Zobacz gazetkę</p>
                </Link>
              ))}
            </div>
          </div>
        </aside>
      </section>
    </PublicMarketplaceShell>
  );
}
