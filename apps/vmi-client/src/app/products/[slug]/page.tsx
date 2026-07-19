import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, PackagePlus, Tag } from "lucide-react";
import { ProductCard } from "@/components/public-marketplace/product-card";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { SupplierCard } from "@/components/public-marketplace/supplier-card";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface ProductDetailPageProps {
  params: Promise<{ slug: string }>;
}

function formatPrice(value?: number, max?: number): string {
  if (value && max) return `${value.toFixed(2)}-${max.toFixed(2)} PLN`;
  if (value) return `${value.toFixed(2)} PLN`;
  return "Cena na zapytanie";
}

export default async function ProductDetailPage({ params }: ProductDetailPageProps) {
  const { slug } = await params;
  const [productResult, snapshot] = await Promise.all([
    PublicMarketplaceRepository.getProductBySlug(slug),
    PublicMarketplaceRepository.getMarketplaceSnapshot(),
  ]);

  if (!productResult.success) throw new Error(productResult.error);
  if (!snapshot.success) throw new Error(snapshot.error);

  const product = productResult.data;
  const supplier = snapshot.data.suppliers.find((item) => item.id === product.vendorId);
  const related = snapshot.data.products
    .filter((item) => item.id !== product.id && item.category === product.category)
    .slice(0, 4);

  return (
    <PublicMarketplaceShell>
      <section className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link
          href="/products"
          className="inline-flex items-center gap-2 text-sm font-black text-amber-700"
        >
          <ArrowLeft className="h-4 w-4" />
          Wróć do produktów
        </Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[0.9fr_1.1fr]">
          <div className="relative aspect-square overflow-hidden rounded-3xl border border-border bg-card shadow-sm">
            <Image
              src={product.imageUrl}
              alt=""
              fill
              priority
              unoptimized
              sizes="(min-width: 1024px) 45vw, 100vw"
              className="object-cover"
            />
          </div>

          <div className="space-y-6">
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                {product.brand}
              </p>
              <h1 className="mt-2 font-display text-4xl font-black leading-tight text-foreground">
                {product.name}
              </h1>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{product.description}</p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="text-xs font-bold text-muted-foreground">Cena</p>
                <p className="mt-1 font-display text-xl font-black text-foreground">
                  {formatPrice(product.priceValue, product.priceMax)}
                </p>
              </div>
              <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="text-xs font-bold text-muted-foreground">Dostępność</p>
                <p className="mt-1 text-sm font-black text-foreground">{product.availability}</p>
              </div>
              <div className="rounded-2xl bg-card p-4 ring-1 ring-border">
                <p className="text-xs font-bold text-muted-foreground">Minimum</p>
                <p className="mt-1 text-sm font-black text-foreground">
                  {product.minEnquiryQty} {product.unit}
                </p>
              </div>
            </div>

            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1 rounded-full bg-secondary px-3 py-1 text-xs font-black text-muted-foreground">
                <Tag className="h-3.5 w-3.5" />
                {product.sku}
              </span>
              <Link
                href={`/products?category=${encodeURIComponent(product.category)}`}
                className="rounded-full bg-secondary px-3 py-1 text-xs font-black text-muted-foreground"
              >
                {product.category}
              </Link>
            </div>

            <button className="inline-flex items-center gap-2 rounded-2xl bg-amber-700 px-5 py-3 text-sm font-black text-white shadow-sm hover:bg-amber-800">
              <PackagePlus className="h-4 w-4" />
              Dodaj do zapytania
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_360px]">
          <div className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <h2 className="font-display text-xl font-black text-foreground">Specyfikacja</h2>
            <dl className="mt-4 grid gap-3 sm:grid-cols-2">
              {Object.entries(product.specifications).map(([key, value]) => (
                <div key={key} className="rounded-xl bg-muted p-3">
                  <dt className="text-xs font-bold text-muted-foreground">{key}</dt>
                  <dd className="mt-1 text-sm font-black text-foreground">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {supplier ? <SupplierCard supplier={supplier} /> : null}
        </div>

        <div className="mt-10 space-y-4">
          <h2 className="font-display text-xl font-black text-foreground">Podobne produkty</h2>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {related.map((item) => (
              <ProductCard
                key={item.id}
                product={item}
                supplier={snapshot.data.suppliers.find(
                  (supplierItem) => supplierItem.id === item.vendorId
                )}
              />
            ))}
          </div>
        </div>
      </section>
    </PublicMarketplaceShell>
  );
}
