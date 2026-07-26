import type { Metadata } from "next";
import { MarketplaceSearchForm } from "@/components/public-marketplace/marketplace-search-form";
import { ProductCard } from "@/components/public-marketplace/product-card";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

export const metadata: Metadata = {
  title: "Produkty VMI | Ambra System",
  description: "Przeglądaj publiczny katalog produktów dostawców VMI według marki, kategorii i miasta.",
  alternates: {
    canonical: "/vmi/products",
  },
  openGraph: {
    title: "Produkty VMI | Ambra System",
    description: "Przeglądaj publiczny katalog produktów dostawców VMI według marki, kategorii i miasta.",
    url: "/vmi/products",
  },
};

interface ProductsPageProps {
  searchParams: Promise<{
    query?: string;
    city?: string;
    category?: string;
    brand?: string;
    vendorId?: string;
  }>;
}

export default async function ProductsPage({ searchParams }: ProductsPageProps) {
  const params = await searchParams;
  const snapshot = await PublicMarketplaceRepository.getMarketplaceSnapshot();
  if (!snapshot.success) throw new Error(snapshot.error);

  const suppliersById = new Map(snapshot.data.suppliers.map((supplier) => [supplier.id, supplier]));
  const result = await PublicMarketplaceRepository.searchProducts({
    query: params.query || undefined,
    vendorId: params.vendorId || undefined,
    category: params.category || undefined,
    brand: params.brand || undefined,
    limit: 100,
  });
  if (!result.success) throw new Error(result.error);

  const products = params.city
    ? result.data.products.filter(
        (product) => suppliersById.get(product.vendorId)?.city === params.city
      )
    : result.data.products;

  return (
    <PublicMarketplaceShell>
      <section className="border-b border-border bg-card">
        <div className="mx-auto max-w-7xl space-y-6 px-4 py-8 sm:px-6 lg:px-8">
          <div className="space-y-2">
            <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
              Produkty
            </p>
            <h1 className="font-display text-3xl font-black text-foreground sm:text-4xl">
              Przeglądaj asortyment dostawców
            </h1>
            <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
              Szukaj po nazwie, marce, SKU, kategorii i mieście dostawcy.
            </p>
          </div>

          <MarketplaceSearchForm
            action="/vmi/products"
            cities={snapshot.data.cities}
            categories={snapshot.data.categories}
            query={params.query}
            city={params.city}
            category={params.category}
            showCategory
          />
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-5 px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
          <p className="text-sm font-bold text-muted-foreground">
            Produkty: <span className="font-black text-foreground">{products.length}</span>
          </p>
          <div className="flex flex-wrap gap-2">
            {snapshot.data.brands.slice(0, 6).map((brand) => (
              <a
                key={brand}
                href={`/vmi/products?brand=${encodeURIComponent(brand)}`}
                className="rounded-full bg-card px-3 py-2 text-xs font-black text-muted-foreground ring-1 ring-border hover:bg-muted"
              >
                {brand}
              </a>
            ))}
          </div>
        </div>

        {products.length > 0 ? (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {products.map((product) => (
              <ProductCard
                key={product.id}
                product={product}
                supplier={suppliersById.get(product.vendorId)}
              />
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center">
            <h2 className="font-display text-lg font-black text-foreground">Brak produktów</h2>
            <p className="mt-2 text-sm text-muted-foreground">
              Zmień frazę, miasto albo kategorię.
            </p>
          </div>
        )}
      </section>
    </PublicMarketplaceShell>
  );
}
