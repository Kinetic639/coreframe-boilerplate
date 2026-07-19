import Image from "next/image";
import Link from "next/link";
import { MapPin, ShieldCheck, Star, Truck } from "lucide-react";
import type { PublicSupplierDto } from "@/lib/public-marketplace/types";

interface SupplierCardProps {
  supplier: PublicSupplierDto & { distanceKm?: number | null };
}

export function SupplierCard({ supplier }: SupplierCardProps) {
  return (
    <Link
      href={`/vendors/${supplier.slug}`}
      className="group grid gap-4 rounded-2xl border border-border bg-card p-4 shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:grid-cols-[96px_1fr]"
    >
      <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-secondary">
        <Image
          src={supplier.logoUrl}
          alt=""
          fill
          unoptimized
          sizes="96px"
          className="object-cover"
        />
      </div>

      <div className="min-w-0 space-y-3">
        <div className="flex flex-wrap items-start justify-between gap-2">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-display text-base font-black text-foreground group-hover:text-amber-700">
                {supplier.name}
              </h3>
              {supplier.verificationStatus === "verified" ? (
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-50 px-2 py-1 text-[10px] font-black uppercase text-emerald-700">
                  <ShieldCheck className="h-3 w-3" />
                  Zweryfikowany
                </span>
              ) : null}
            </div>
            <p className="mt-1 text-xs font-bold text-muted-foreground">{supplier.industry}</p>
          </div>
          <div className="flex items-center gap-1 text-xs font-black text-amber-600">
            <Star className="h-4 w-4 fill-amber-400 text-amber-400" />
            {supplier.rating}
          </div>
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-muted-foreground">
          {supplier.shortDescription}
        </p>

        <div className="flex flex-wrap gap-2">
          {supplier.categories.slice(0, 3).map((category) => (
            <span
              key={category}
              className="rounded-full bg-secondary px-2 py-1 text-[11px] font-bold text-muted-foreground"
            >
              {category}
            </span>
          ))}
        </div>

        <div className="flex flex-wrap items-center gap-4 text-xs font-bold text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {supplier.city}
            {supplier.distanceKm !== undefined && supplier.distanceKm !== null
              ? `, ${supplier.distanceKm} km`
              : ""}
          </span>
          {supplier.deliveryAvailable ? (
            <span className="inline-flex items-center gap-1">
              <Truck className="h-4 w-4" />
              Dostawa
            </span>
          ) : null}
        </div>
      </div>
    </Link>
  );
}
