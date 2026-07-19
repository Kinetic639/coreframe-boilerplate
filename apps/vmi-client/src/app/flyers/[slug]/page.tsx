import Image from "next/image";
import Link from "next/link";
import { ArrowLeft, CalendarDays } from "lucide-react";
import { ProductCard } from "@/components/public-marketplace/product-card";
import { PublicMarketplaceShell } from "@/components/public-marketplace/public-marketplace-shell";
import { PublicMarketplaceRepository } from "@/lib/public-marketplace/repository";

interface FlyerDetailPageProps {
  params: Promise<{ slug: string }>;
}

export default async function FlyerDetailPage({ params }: FlyerDetailPageProps) {
  const { slug } = await params;
  const [flyerResult, snapshot] = await Promise.all([
    PublicMarketplaceRepository.getFlyerBySlug(slug),
    PublicMarketplaceRepository.getMarketplaceSnapshot(),
  ]);

  if (!flyerResult.success) throw new Error(flyerResult.error);
  if (!snapshot.success) throw new Error(snapshot.error);

  const flyer = flyerResult.data;
  const supplier = snapshot.data.suppliers.find((item) => item.id === flyer.vendorId);
  const productById = new Map(snapshot.data.products.map((product) => [product.id, product]));

  return (
    <PublicMarketplaceShell>
      <section className="border-b border-border bg-background">
        <div className="mx-auto grid max-w-7xl gap-8 px-4 py-8 sm:px-6 lg:grid-cols-[0.85fr_1.15fr] lg:px-8">
          <div className="relative aspect-[4/3] overflow-hidden rounded-lg bg-muted shadow-sm">
            <Image
              src={flyer.coverUrl}
              alt=""
              fill
              priority
              unoptimized
              sizes="(min-width: 1024px) 40vw, 100vw"
              className="object-cover"
            />
          </div>
          <div className="flex flex-col justify-center space-y-5">
            <Link
              href="/"
              className="inline-flex w-fit items-center gap-2 text-sm font-black text-primary"
            >
              <ArrowLeft className="h-4 w-4" />
              Wróć
            </Link>
            <div>
              <p className="text-xs font-black uppercase tracking-[0.18em] text-primary">Gazetka</p>
              <h1 className="mt-2 font-display text-4xl font-black leading-tight text-foreground">
                {flyer.title}
              </h1>
            </div>
            <p className="flex items-center gap-2 text-sm font-bold text-muted-foreground">
              <CalendarDays className="h-4 w-4" />
              {flyer.validFrom} - {flyer.validTo}
            </p>
            {supplier ? (
              <Link
                href={`/vendors/${supplier.slug}`}
                className="text-sm font-black text-primary hover:underline"
              >
                Dostawca: {supplier.name}
              </Link>
            ) : null}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-8 px-4 py-8 sm:px-6 lg:px-8">
        {flyer.pages.map((page) => {
          const products = page.productIds.map((id) => productById.get(id)).filter(Boolean);
          return (
            <div key={page.pageNumber} className="space-y-4">
              <div>
                <p className="text-xs font-black uppercase tracking-[0.18em] text-amber-700">
                  Strona {page.pageNumber} · {page.layoutType}
                </p>
                <h2 className="mt-1 font-display text-2xl font-black text-foreground">
                  {page.title}
                </h2>
                {page.description ? (
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{page.description}</p>
                ) : null}
              </div>
              <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {products.map((product) => (
                  <ProductCard key={product!.id} product={product!} supplier={supplier} />
                ))}
              </div>
            </div>
          );
        })}
      </section>
    </PublicMarketplaceShell>
  );
}
