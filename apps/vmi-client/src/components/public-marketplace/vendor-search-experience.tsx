"use client";

import Link from "next/link";
import Image from "next/image";
import { useMemo, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  ChevronRight,
  Filter,
  Heart,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  X
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import type {
  PublicProductDto,
  PublicSupplierDetailsDto
} from "@/lib/public-marketplace/types";
import { cn } from "@/utils/cn";

const vendorMapPins: Record<string, { x: number; y: number }> = {
  "mv-1": { x: 50, y: 50 },
  "mv-2": { x: 42, y: 58 },
  "mv-3": { x: 48, y: 56 },
  "mv-4": { x: 38, y: 46 },
  "mv-5": { x: 48, y: 48 },
  "mv-6": { x: 65, y: 32 },
  "mv-7": { x: 75, y: 78 },
  "mv-8": { x: 30, y: 90 },
  "mv-9": { x: 36, y: 43 },
  "mv-10": { x: 80, y: 55 },
  "mv-11": { x: 56, y: 48 },
  "mv-12": { x: 50, y: 46 }
};

const searchParsers = {
  query: parseAsString.withDefault(""),
  city: parseAsString.withDefault(""),
  category: parseAsString.withDefault("Wszystko"),
  verified: parseAsString.withDefault(""),
  delivery: parseAsString.withDefault(""),
  collection: parseAsString.withDefault(""),
  distance: parseAsInteger.withDefault(200),
  sort: parseAsString.withDefault("name"),
  tab: parseAsString.withDefault("wszystko"),
  view: parseAsString.withDefault("list")
};

const booleanFilters = [
  { key: "verified", label: "Tylko zweryfikowani" },
  { key: "delivery", label: "Wysyłka kurierska" },
  { key: "collection", label: "Odbiór osobisty" }
] as const;

interface VendorSearchExperienceProps {
  suppliers: PublicSupplierDetailsDto[];
  products: PublicProductDto[];
  cities: string[];
  categories: string[];
  brands: string[];
}

function matchesTerm(value: string, term: string): boolean {
  return value.toLowerCase().includes(term.toLowerCase());
}

function VendorResultCard({
  vendor,
  selected,
  onSelectMap
}: {
  vendor: PublicSupplierDetailsDto;
  selected: boolean;
  onSelectMap: () => void;
}) {
  return (
    <article
      className={cn(
        "group rounded-xl bg-white p-4 text-left shadow-md transition-all hover:shadow-lg",
        selected && "ring-2 ring-blue-500"
      )}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Image
            src={vendor.logoUrl}
            alt=""
            width={44}
            height={44}
            unoptimized
            className="h-11 w-11 shrink-0 rounded-lg bg-slate-50 object-cover"
          />
          <div>
            <div className="flex flex-wrap items-center gap-1.5">
              <h4 className="font-display text-xs font-extrabold uppercase tracking-normal text-slate-900 transition-colors group-hover:text-blue-600">
                {vendor.name}
              </h4>
              {vendor.verificationStatus === "verified" ? (
                <ShieldCheck className="h-3.5 w-3.5 shrink-0 fill-blue-500/10 text-blue-500" />
              ) : null}
            </div>
            <span className="font-mono text-[9px] font-black uppercase tracking-wider text-blue-600">
              {vendor.industry}
            </span>
          </div>
        </div>

        <button className="p-1 text-slate-400 hover:text-rose-500" type="button" aria-label="Zapisz dostawcę">
          <Heart className="h-4 w-4" />
        </button>
      </div>

      <p className="mb-4 line-clamp-2 text-[11px] leading-normal text-slate-500">{vendor.shortDescription}</p>

      <div className="mb-3 flex flex-wrap gap-1.5">
        {vendor.featuredBrands.slice(0, 3).map((brand) => (
          <span key={brand} className="rounded-full bg-slate-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400">
            {brand}
          </span>
        ))}
      </div>

      <div className="flex items-center justify-between gap-2 border-t border-slate-100 pt-3 font-mono text-[10px] font-semibold uppercase text-slate-400">
        <button type="button" onClick={onSelectMap} className="flex items-center gap-1 hover:text-blue-600">
          <MapPin className="h-3.5 w-3.5" />
          {vendor.city} ({vendor.serviceRadiusKm} km)
        </button>
        <Link href={`/vendors/${vendor.slug}`} className="flex items-center gap-0.5 text-xs font-black text-blue-600 hover:underline">
          Otwórz <ChevronRight className="h-3.5 w-3.5" />
        </Link>
      </div>
    </article>
  );
}

function ProductMiniCard({
  product,
  vendor
}: {
  product: PublicProductDto;
  vendor?: PublicSupplierDetailsDto;
}) {
  return (
    <Link href={`/products/${product.slug}`} className="group rounded-xl bg-white p-3.5 text-left shadow-md transition-all hover:shadow-lg">
      <div className="relative mb-3 aspect-square overflow-hidden rounded-lg bg-slate-50">
        <Image
          src={product.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <span className="font-mono text-[8px] font-black uppercase tracking-widest text-blue-600">
        {product.brand} · {vendor?.name}
      </span>
      <h4 className="mt-1.5 line-clamp-2 text-xs font-bold leading-snug text-slate-900 group-hover:text-blue-600">
        {product.name}
      </h4>
      <p className="mt-2 text-[9px] font-semibold text-slate-400">{product.availability}</p>
    </Link>
  );
}

export function VendorSearchExperience({
  suppliers,
  products,
  cities,
  categories,
  brands
}: VendorSearchExperienceProps) {
  const [params, setParams] = useQueryStates(searchParsers);
  const [draftQuery, setDraftQuery] = useState(params.query);
  const [draftCity, setDraftCity] = useState(params.city);
  const [hoveredVendorId, setHoveredVendorId] = useState<string | null>(null);
  const [selectedMapVendor, setSelectedMapVendor] = useState<PublicSupplierDetailsDto | null>(null);

  const activeTab = params.tab === "produkty" || params.tab === "dostawcy" ? params.tab : "wszystko";
  const viewMode = params.view === "map" ? "map" : "list";
  const selectedCategory = params.category || "Wszystko";
  const selectedBrand = params.sort.startsWith("brand:") ? params.sort.slice("brand:".length) : "Wszystkie";
  const term = params.query.trim();

  const filteredVendors = useMemo(() => {
    return suppliers
      .filter((vendor) => {
        const matchesSearch =
          !term ||
          matchesTerm(vendor.name, term) ||
          matchesTerm(vendor.shortDescription, term) ||
          vendor.featuredBrands.some((brand) => matchesTerm(brand, term));
        const matchesCity = !params.city || vendor.city === params.city;
        const matchesCategory =
          selectedCategory === "Wszystko" || vendor.categories.includes(selectedCategory);
        const matchesVerified = params.verified !== "true" || vendor.verificationStatus === "verified";
        const matchesDelivery = params.delivery !== "true" || vendor.deliveryAvailable;
        const matchesCollection = params.collection !== "true" || vendor.collectionAvailable;
        const matchesDistance = vendor.serviceRadiusKm <= params.distance;
        return (
          matchesSearch &&
          matchesCity &&
          matchesCategory &&
          matchesVerified &&
          matchesDelivery &&
          matchesCollection &&
          matchesDistance
        );
      })
      .sort((a, b) => {
        if (params.sort === "distance") return a.serviceRadiusKm - b.serviceRadiusKm;
        if (params.sort === "completeness") return b.rating - a.rating;
        return a.name.localeCompare(b.name);
      });
  }, [params.city, params.collection, params.delivery, params.distance, params.sort, params.verified, selectedCategory, suppliers, term]);

  const supplierById = useMemo(() => new Map(suppliers.map((supplier) => [supplier.id, supplier])), [suppliers]);

  const filteredProducts = useMemo(() => {
    return products.filter((product) => {
      const vendor = supplierById.get(product.vendorId);
      if (!vendor) return false;
      const matchesSearch =
        !term ||
        matchesTerm(product.name, term) ||
        matchesTerm(product.brand, term) ||
        matchesTerm(product.sku, term) ||
        matchesTerm(product.description, term);
      const matchesCity = !params.city || vendor.city === params.city;
      const matchesCategory = selectedCategory === "Wszystko" || product.category === selectedCategory;
      const matchesBrand = selectedBrand === "Wszystkie" || product.brand === selectedBrand;
      return matchesSearch && matchesCity && matchesCategory && matchesBrand;
    });
  }, [params.city, products, selectedBrand, selectedCategory, supplierById, term]);

  const selectedVendor = selectedMapVendor ?? filteredVendors[0] ?? null;

  function submitSearch(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setParams({ query: draftQuery, city: draftCity });
  }

  function resetFilters() {
    setDraftQuery("");
    setDraftCity("");
    void setParams({
      query: "",
      city: "",
      category: "Wszystko",
      verified: "",
      delivery: "",
      collection: "",
      distance: 200,
      sort: "name",
      tab: "wszystko",
      view: "list"
    });
  }

  function setBooleanFilter(key: (typeof booleanFilters)[number]["key"], checked: boolean) {
    if (key === "verified") void setParams({ verified: checked ? "true" : "" });
    if (key === "delivery") void setParams({ delivery: checked ? "true" : "" });
    if (key === "collection") void setParams({ collection: checked ? "true" : "" });
  }

  return (
    <div className="mx-auto flex h-[calc(100vh-4.25rem)] max-w-7xl flex-col space-y-4 overflow-hidden px-3 py-4 sm:px-4 lg:py-6">
      <form onSubmit={submitSearch} className="shrink-0 space-y-3 rounded-2xl bg-white p-4 shadow-sm">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 md:col-span-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Czego dzisiaj szukasz? (np. Castrol, hamulce, Yato...)"
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="w-full bg-transparent text-xs font-bold outline-none"
            />
            {draftQuery ? (
              <button type="button" onClick={() => setDraftQuery("")} className="text-slate-400 hover:text-slate-600">
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={draftCity}
              onChange={(event) => {
                setDraftCity(event.target.value);
                void setParams({ city: event.target.value });
              }}
              className="w-full cursor-pointer bg-transparent text-xs font-bold outline-none"
            >
              <option value="">Wszystkie miasta</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(event) => void setParams({ category: event.target.value })}
              className="w-full cursor-pointer bg-transparent text-xs font-bold outline-none"
            >
              <option value="Wszystko">Wszystkie kategorie</option>
              {categories.map((category) => (
                <option key={category} value={category}>
                  {category}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 pt-2 text-[11px] text-slate-500">
          <div className="flex flex-wrap items-center gap-4">
            {booleanFilters.map(({ key, label }) => (
              <label key={key} className="flex cursor-pointer items-center gap-1.5 font-bold">
                <input
                  type="checkbox"
                  checked={params[key] === "true"}
                  onChange={(event) => setBooleanFilter(key, event.target.checked)}
                  className="rounded text-blue-600 focus:ring-blue-500"
                />
                <span>{label}</span>
              </label>
            ))}

            <div className="flex items-center gap-2">
              <span>Dystans do:</span>
              <input
                type="range"
                min="5"
                max="200"
                value={params.distance}
                onChange={(event) => void setParams({ distance: Number(event.target.value) })}
                className="h-1.5 w-24 cursor-pointer rounded-lg bg-slate-200 accent-blue-600"
              />
              <span className="font-extrabold">{params.distance} km</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button type="button" onClick={resetFilters} className="text-xs font-extrabold text-slate-400 hover:text-blue-600">
              Resetuj filtry
            </button>
            <button type="submit" className="rounded-lg bg-[#2A3B4C] px-4 py-1 text-[10px] font-black uppercase text-white">
              Filtruj
            </button>
          </div>
        </div>
      </form>

      <div className="flex shrink-0 items-center justify-between gap-3 pb-1">
        <div className="no-scrollbar flex items-center gap-1 overflow-x-auto">
          {(["wszystko", "produkty", "dostawcy"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => void setParams({ tab, view: tab === "dostawcy" ? "list" : params.view })}
              className={cn(
                "whitespace-nowrap rounded-lg px-4 py-1.5 text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab ? "bg-blue-600 text-white shadow-sm" : "text-slate-500 hover:bg-slate-100"
              )}
            >
              {tab === "wszystko"
                ? "Wszystko"
                : tab === "produkty"
                  ? `Produkty (${filteredProducts.length})`
                  : `Dostawcy (${filteredVendors.length})`}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void setParams({ view: viewMode === "list" ? "map" : "list" })}
            className="flex items-center gap-1 rounded-lg bg-[#2A3B4C] p-1.5 text-xs font-black uppercase tracking-wide text-white lg:hidden"
          >
            {viewMode === "list" ? <MapIcon className="h-3.5 w-3.5" /> : <List className="h-3.5 w-3.5" />}
            {viewMode === "list" ? "Mapa" : "Lista"}
          </button>

          <div className="hidden items-center gap-2 text-xs lg:flex">
            <ArrowUpDown className="h-3.5 w-3.5 text-slate-400" />
            <span className="font-medium text-slate-400">Sortuj według:</span>
            <select
              value={params.sort}
              onChange={(event) => void setParams({ sort: event.target.value })}
              className="cursor-pointer bg-transparent font-bold text-slate-700 outline-none"
            >
              <option value="name">Nazwa A-Z</option>
              <option value="distance">Dystans (km)</option>
              <option value="completeness">Kompletność profilu</option>
              {brands.slice(0, 6).map((brand) => (
                <option key={brand} value={`brand:${brand}`}>
                  Marka: {brand}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div className="flex min-h-0 flex-1 items-stretch gap-4 overflow-hidden lg:gap-6">
        <aside className="hidden w-64 shrink-0 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm lg:block">
          <div className="flex items-center gap-2">
            <SlidersHorizontal className="h-4 w-4 text-blue-700" />
            <h2 className="font-display text-sm font-black text-slate-950">Kategorie</h2>
          </div>
          <div className="mt-4 space-y-1">
            {["Wszystko", ...categories].map((category) => (
              <button
                key={category}
                type="button"
                onClick={() => void setParams({ category })}
                className={cn(
                  "block w-full rounded-lg px-3 py-2 text-left text-xs font-black transition-colors",
                  selectedCategory === category ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </aside>

        <div className={cn("h-full flex-1 overflow-y-auto pr-1", viewMode === "map" ? "hidden lg:block" : "block")}>
          {activeTab === "wszystko" ? (
            <div className="space-y-6">
              <section className="space-y-3">
                <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                  Zweryfikowani Dostawcy ({filteredVendors.length})
                </h3>
                {filteredVendors.length ? (
                  <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                    {filteredVendors.slice(0, 6).map((vendor) => (
                      <VendorResultCard
                        key={vendor.id}
                        vendor={vendor}
                        selected={selectedVendor?.id === vendor.id}
                        onSelectMap={() => setSelectedMapVendor(vendor)}
                      />
                    ))}
                  </div>
                ) : (
                  <p className="rounded-xl bg-white p-4 text-xs font-bold text-slate-400">Brak pasujących dostawców.</p>
                )}
              </section>

              <section className="space-y-3">
                <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                  Pasujące produkty ({filteredProducts.length})
                </h3>
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredProducts.slice(0, 6).map((product) => (
                    <ProductMiniCard key={product.id} product={product} vendor={supplierById.get(product.vendorId)} />
                  ))}
                </div>
              </section>
            </div>
          ) : null}

          {activeTab === "dostawcy" ? (
            <section className="space-y-4">
              <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                Dostawcy w Twojej okolicy ({filteredVendors.length})
              </h3>
              {filteredVendors.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredVendors.map((vendor) => (
                    <VendorResultCard
                      key={vendor.id}
                      vendor={vendor}
                      selected={selectedVendor?.id === vendor.id}
                      onSelectMap={() => setSelectedMapVendor(vendor)}
                    />
                  ))}
                </div>
              ) : (
                <div className="space-y-2 rounded-xl bg-white py-12 text-center shadow-md">
                  <div className="flex justify-center">
                    <Building2 className="h-8 w-8 text-slate-400" />
                  </div>
                  <p className="text-xs font-bold text-slate-500">Brak dostawców spełniających kryteria wyszukiwania.</p>
                </div>
              )}
            </section>
          ) : null}

          {activeTab === "produkty" ? (
            <section className="space-y-4">
              <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                Katalog produktów ({filteredProducts.length})
              </h3>
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
                {filteredProducts.map((product) => (
                  <ProductMiniCard key={product.id} product={product} vendor={supplierById.get(product.vendorId)} />
                ))}
              </div>
            </section>
          ) : null}
        </div>

        <div className={cn("relative flex-1 overflow-hidden rounded-2xl bg-white", viewMode === "list" ? "hidden lg:flex" : "flex")}>
          <div className="absolute left-4 top-4 z-10 max-w-xs space-y-1 rounded-xl bg-white/95 p-3 text-left shadow-lg">
            <h4 className="font-mono text-[10px] font-extrabold uppercase tracking-widest text-slate-400">
              Region Wielkopolski
            </h4>
            <p className="text-[11px] font-bold leading-tight text-slate-800">Mapa i odległość logistyczna</p>
            <p className="text-[9px] leading-normal text-slate-400">
              Klikaj na pinezki, aby otworzyć szczegóły i sprawdzić zasięg partnera handlowego.
            </p>
          </div>

          <div className="relative flex min-h-[560px] flex-1 items-center justify-center overflow-hidden bg-blue-50/40">
            <div className="absolute inset-0 bg-[radial-gradient(#1d4ed810_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute left-1/2 top-1/2 flex h-4 w-4 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600/15">
              <div className="h-1.5 w-1.5 rounded-full bg-blue-600" />
            </div>
            <span className="pointer-events-none absolute left-[52%] top-[52%] font-mono text-[9px] font-black uppercase tracking-wider text-blue-600/50">
              Poznań (Ośrodek)
            </span>

            {filteredVendors.map((vendor) => {
              const coords = vendorMapPins[vendor.id] ?? { x: 50, y: 50 };
              const isActive = hoveredVendorId === vendor.id || selectedVendor?.id === vendor.id;
              return (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => setSelectedMapVendor(vendor)}
                  onMouseEnter={() => setHoveredVendorId(vendor.id)}
                  onMouseLeave={() => setHoveredVendorId(null)}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%` }}
                  className="group absolute z-10 -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                >
                  <span className={cn("absolute -inset-2.5 rounded-full bg-blue-500/10 opacity-0 transition-all group-hover:opacity-100", isActive && "scale-110 opacity-100")} />
                  <div className={cn("relative flex h-6 w-6 items-center justify-center rounded-full bg-white shadow-md transition-all", isActive && "z-20 scale-125 shadow-lg")}>
                    <MapPin className={cn("h-3 w-3", isActive ? "text-blue-600" : "text-slate-400")} />
                  </div>
                  <div className={cn("pointer-events-none absolute bottom-8 left-1/2 z-30 -translate-x-1/2 scale-90 whitespace-nowrap rounded-md bg-[#2A3B4C] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white opacity-0 shadow-md transition-all", hoveredVendorId === vendor.id && "scale-100 opacity-100")}>
                    {vendor.name} ({vendor.serviceRadiusKm}km)
                  </div>
                </button>
              );
            })}
          </div>

          {selectedVendor ? (
            <div className="absolute inset-x-0 bottom-0 flex items-center justify-between gap-3 bg-white p-4 text-left shadow-[0_-12px_30px_rgba(15,23,42,0.12)]">
              <div className="flex min-w-0 items-center gap-3">
                <Image
                  src={selectedVendor.logoUrl}
                  alt=""
                  width={44}
                  height={44}
                  unoptimized
                  className="h-11 w-11 rounded-lg bg-slate-50 object-cover"
                />
                <div className="min-w-0">
                  <div className="flex items-center gap-1">
                    <h4 className="truncate font-display text-xs font-extrabold uppercase tracking-normal text-slate-900">
                      {selectedVendor.name}
                    </h4>
                    {selectedVendor.verificationStatus === "verified" ? <ShieldCheck className="h-3.5 w-3.5 text-blue-500" /> : null}
                  </div>
                  <p className="text-[10px] font-medium text-slate-400">
                    {selectedVendor.city} · Zasięg: {selectedVendor.serviceRadiusKm} km
                  </p>
                  <p className="mt-0.5 line-clamp-1 max-w-md text-[10px] text-slate-500">{selectedVendor.shortDescription}</p>
                </div>
              </div>

              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSelectedMapVendor(null)}
                  className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100"
                  title="Zamknij"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
                <Link href={`/vendors/${selectedVendor.slug}`} className="rounded-lg bg-blue-600 px-3 py-1.5 text-[10px] font-black uppercase text-white hover:bg-blue-700">
                  Zobacz profil
                </Link>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
