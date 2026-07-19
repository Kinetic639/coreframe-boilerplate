import Image from "next/image";
import Link from "next/link";
import { PackagePlus, Tag } from "lucide-react";
import type { PublicProductDto, PublicSupplierDto } from "@/lib/public-marketplace/types";

interface ProductCardProps {
  product: PublicProductDto;
  supplier?: PublicSupplierDto;
}

function formatPrice(product: PublicProductDto): string {
  if (product.priceMode === "after_login") return "Cena po zalogowaniu";
  if (product.priceMode === "on_request") return "Cena na zapytanie";
  if (product.priceMode === "range" && product.priceValue && product.priceMax) {
    return `${product.priceValue.toFixed(2)}-${product.priceMax.toFixed(2)} PLN`;
  }
  if (product.priceMode === "from" && product.priceValue) return `Od ${product.priceValue.toFixed(2)} PLN`;
  if (product.priceValue) return `${product.priceValue.toFixed(2)} PLN`;
  return "Cena na zapytanie";
}

export function ProductCard({ product, supplier }: ProductCardProps) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
    >
      <div className="relative aspect-[4/3] bg-slate-100">
        <Image src={product.imageUrl} alt="" fill unoptimized sizes="(min-width: 1024px) 25vw, 50vw" className="object-cover" />
        {product.isNew ? (
          <span className="absolute left-3 top-3 rounded-full bg-blue-700 px-2 py-1 text-[10px] font-black uppercase text-white">
            Nowość
          </span>
        ) : null}
      </div>

      <div className="flex flex-1 flex-col gap-3 p-4">
        <div>
          <p className="text-[11px] font-black uppercase tracking-wide text-blue-700">{product.brand}</p>
          <h3 className="mt-1 line-clamp-2 font-display text-sm font-black text-slate-950 group-hover:text-blue-700">
            {product.name}
          </h3>
        </div>

        <p className="line-clamp-2 text-xs leading-5 text-slate-500">{product.description}</p>

        <div className="mt-auto space-y-3">
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-bold text-slate-500">
            <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1">
              <Tag className="h-3 w-3" />
              {product.sku}
            </span>
            <span>{product.availability}</span>
          </div>
          <div className="flex items-end justify-between gap-3">
            <div>
              <p className="text-sm font-black text-slate-950">{formatPrice(product)}</p>
              <p className="text-[11px] font-bold text-slate-500">
                {supplier?.name ?? "Dostawca"} · min. {product.minEnquiryQty} {product.unit}
              </p>
            </div>
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-slate-950 text-white">
              <PackagePlus className="h-4 w-4" />
            </span>
          </div>
        </div>
      </div>
    </Link>
  );
}
