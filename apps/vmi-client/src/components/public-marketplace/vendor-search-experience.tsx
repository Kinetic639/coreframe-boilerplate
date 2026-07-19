"use client";

import Image from "next/image";
import Link from "next/link";
import type { FormEvent } from "react";
import { useMemo, useRef, useState } from "react";
import {
  ArrowUpDown,
  Building2,
  ChevronRight,
  Filter,
  List,
  Map as MapIcon,
  MapPin,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  Truck,
  Warehouse,
  X
} from "lucide-react";
import { parseAsInteger, parseAsString, useQueryStates } from "nuqs";
import type {
  PublicProductDto,
  PublicSupplierDetailsDto
} from "@/lib/public-marketplace/types";
import { cn } from "@/utils/cn";

const vendorMapPins: Record<string, { x: number; y: number }> = {
  "mv-1": { x: 50, y: 38 },
  "mv-2": { x: 34, y: 66 },
  "mv-3": { x: 47, y: 68 },
  "mv-4": { x: 38, y: 46 },
  "mv-5": { x: 36, y: 54 },
  "mv-6": { x: 65, y: 32 },
  "mv-7": { x: 75, y: 78 },
  "mv-8": { x: 30, y: 90 },
  "mv-9": { x: 36, y: 43 },
  "mv-10": { x: 80, y: 55 },
  "mv-11": { x: 64, y: 58 },
  "mv-12": { x: 61, y: 43 }
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
  tab: parseAsString.withDefault("dostawcy"),
  view: parseAsString.withDefault("list")
};

const booleanFilters = [
  { key: "verified", label: "Zweryfikowani", icon: ShieldCheck },
  { key: "delivery", label: "Wysyłka", icon: Truck },
  { key: "collection", label: "Odbiór", icon: Warehouse }
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

function SupplierResultCard({
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
        "group grid gap-4 rounded-2xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md sm:grid-cols-[96px_1fr]",
        selected && "border-blue-400 ring-2 ring-blue-100"
      )}
    >
      <div className="relative h-24 w-24 overflow-hidden rounded-2xl bg-slate-100">
        <Image
          src={vendor.logoUrl}
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
              <h3 className="font-display text-base font-black text-slate-950 group-hover:text-blue-700">
                {vendor.name}
              </h3>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              {vendor.categories.slice(0, 4).map((category) => (
                <span
                  key={category}
                  className="rounded-full bg-slate-100 px-2 py-1 text-[11px] font-bold text-slate-600"
                >
                  {category}
                </span>
              ))}
            </div>
          </div>

          {selected ? (
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-blue-600 text-white shadow-sm">
              <MapPin className="h-4 w-4" />
            </div>
          ) : null}
        </div>

        <p className="line-clamp-2 text-sm leading-6 text-slate-600">{vendor.shortDescription}</p>

        <div className="flex flex-wrap items-center gap-3 text-xs font-bold text-slate-500">
          <span className="inline-flex items-center gap-1">
            <MapPin className="h-4 w-4" />
            {vendor.city}, zasięg {vendor.serviceRadiusKm} km
          </span>
          {vendor.deliveryAvailable ? (
            <span className="inline-flex items-center gap-1">
              <Truck className="h-4 w-4" />
              Dostawa
            </span>
          ) : null}
          {vendor.collectionAvailable ? (
            <span className="inline-flex items-center gap-1">
              <Warehouse className="h-4 w-4" />
              Odbiór
            </span>
          ) : null}
        </div>

        <div
          className={cn(
            "flex flex-col gap-2 border-t border-slate-100 pt-3 sm:flex-row sm:items-center",
            selected ? "sm:justify-end" : "sm:justify-between"
          )}
        >
          {selected ? null : (
            <button
              type="button"
              onClick={onSelectMap}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 px-3 py-2 text-xs font-black text-slate-700 transition hover:border-blue-200 hover:bg-blue-50 hover:text-blue-700"
            >
              <MapIcon className="h-4 w-4" />
              Pokaż na mapie
            </button>
          )}
          <Link
            href={`/vendors/${vendor.slug}`}
            className="inline-flex items-center justify-center gap-1 rounded-xl bg-[#1f3347] px-3 py-2 text-xs font-black text-white shadow-sm transition hover:bg-blue-700"
          >
            Profil
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
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
    <Link
      href={`/products/${product.slug}`}
      className="group grid grid-cols-[88px_1fr] gap-3 rounded-2xl border border-slate-200 bg-white p-3 text-left shadow-sm transition hover:-translate-y-0.5 hover:shadow-md sm:block"
    >
      <div className="relative aspect-square overflow-hidden rounded-xl bg-slate-50">
        <Image
          src={product.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 88px"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
      </div>
      <div className="min-w-0 sm:mt-3">
        <span className="font-mono text-[9px] font-black uppercase tracking-widest text-blue-600">
          {product.brand} · {vendor?.name}
        </span>
        <h4 className="mt-1.5 line-clamp-2 text-sm font-bold leading-snug text-slate-900 group-hover:text-blue-600">
          {product.name}
        </h4>
        <p className="mt-2 text-[11px] font-semibold text-slate-400">{product.availability}</p>
      </div>
    </Link>
  );
}

function EmptyState({ label }: { label: string }) {
  return (
    <div className="space-y-2 rounded-2xl border border-dashed border-slate-200 bg-white px-4 py-12 text-center shadow-sm">
      <div className="flex justify-center">
        <Building2 className="h-8 w-8 text-slate-400" />
      </div>
      <p className="text-sm font-bold text-slate-500">{label}</p>
    </div>
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
  const mapSectionRef = useRef<HTMLElement | null>(null);

  const activeTab = params.tab === "produkty" || params.tab === "wszystko" ? params.tab : "dostawcy";
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

  const highlightedVendor = selectedMapVendor;
  const orderedVendors = useMemo(() => {
    if (!highlightedVendor) return filteredVendors;
    return [
      highlightedVendor,
      ...filteredVendors.filter((vendor) => vendor.id !== highlightedVendor.id)
    ];
  }, [filteredVendors, highlightedVendor]);

  function submitSearch(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    void setParams({ query: draftQuery, city: draftCity });
  }

  function resetFilters() {
    setDraftQuery("");
    setDraftCity("");
    setSelectedMapVendor(null);
    void setParams({
      query: "",
      city: "",
      category: "Wszystko",
      verified: "",
      delivery: "",
      collection: "",
      distance: 200,
      sort: "name",
      tab: "dostawcy",
      view: "list"
    });
  }

  function setBooleanFilter(key: (typeof booleanFilters)[number]["key"], checked: boolean) {
    if (key === "verified") void setParams({ verified: checked ? "true" : "" });
    if (key === "delivery") void setParams({ delivery: checked ? "true" : "" });
    if (key === "collection") void setParams({ collection: checked ? "true" : "" });
  }

  function selectMapVendor(vendor: PublicSupplierDetailsDto) {
    setSelectedMapVendor(vendor);
    void setParams({ view: "map" });
    window.setTimeout(() => {
      mapSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 80);
  }

  function selectVendorFromMap(vendor: PublicSupplierDetailsDto) {
    setSelectedMapVendor(vendor);
    void setParams({ tab: "dostawcy", view: "list" });
  }

  return (
    <div className="mx-auto max-w-7xl space-y-4 px-3 py-4 pb-24 sm:px-4 lg:py-6">
      <form onSubmit={submitSearch} className="space-y-3 rounded-2xl bg-white p-3 shadow-sm sm:p-4">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-4">
          <div className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2 md:col-span-2">
            <Search className="h-4 w-4 shrink-0 text-slate-400" />
            <input
              type="text"
              placeholder="Szukaj dostawcy, marki, produktu..."
              value={draftQuery}
              onChange={(event) => setDraftQuery(event.target.value)}
              className="w-full bg-transparent text-sm font-bold outline-none placeholder:text-slate-400"
            />
            {draftQuery ? (
              <button
                type="button"
                onClick={() => setDraftQuery("")}
                className="rounded-lg p-1 text-slate-400 hover:bg-white hover:text-slate-700"
                aria-label="Wyczyść wyszukiwanie"
              >
                <X className="h-4 w-4" />
              </button>
            ) : null}
          </div>

          <div className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={draftCity}
              onChange={(event) => {
                setDraftCity(event.target.value);
                void setParams({ city: event.target.value });
              }}
              className="w-full cursor-pointer bg-transparent text-sm font-bold outline-none"
            >
              <option value="">Wszystkie miasta</option>
              {cities.map((city) => (
                <option key={city} value={city}>
                  {city}
                </option>
              ))}
            </select>
          </div>

          <div className="flex min-h-12 items-center gap-2 rounded-xl bg-slate-50 px-3 py-2">
            <Filter className="h-4 w-4 shrink-0 text-slate-400" />
            <select
              value={selectedCategory}
              onChange={(event) => void setParams({ category: event.target.value })}
              className="w-full cursor-pointer bg-transparent text-sm font-bold outline-none"
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

        <div className="flex flex-col gap-3 border-t border-slate-100 pt-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="grid grid-cols-3 gap-2 sm:flex sm:flex-wrap sm:items-center">
            {booleanFilters.map(({ key, label, icon: Icon }) => {
              const checked = params[key] === "true";
              return (
                <button
                  key={key}
                  type="button"
                  onClick={() => setBooleanFilter(key, !checked)}
                  className={cn(
                    "inline-flex min-h-10 items-center justify-center gap-1.5 rounded-xl border px-2 text-[11px] font-black transition sm:px-3",
                    checked
                      ? "border-blue-200 bg-blue-50 text-blue-700"
                      : "border-slate-200 bg-white text-slate-500 hover:bg-slate-50"
                  )}
                >
                  <Icon className="h-3.5 w-3.5" />
                  {label}
                </button>
              );
            })}
          </div>

          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
            <label className="flex items-center gap-2 text-xs font-bold text-slate-500">
              <span className="shrink-0">Dystans</span>
              <input
                type="range"
                min="5"
                max="200"
                value={params.distance}
                onChange={(event) => void setParams({ distance: Number(event.target.value) })}
                className="h-1.5 w-full min-w-28 cursor-pointer rounded-lg bg-slate-200 accent-blue-600 sm:w-28"
              />
              <span className="w-12 text-right font-extrabold">{params.distance} km</span>
            </label>

            <div className="grid grid-cols-[1fr_1fr] gap-2 sm:flex sm:items-center">
              <button
                type="button"
                onClick={resetFilters}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-extrabold text-slate-500 transition hover:bg-slate-50 hover:text-blue-700"
              >
                Resetuj
              </button>
              <button
                type="submit"
                className="rounded-xl bg-[#1f3347] px-4 py-2 text-xs font-black uppercase text-white shadow-sm transition hover:bg-blue-700"
              >
                Filtruj
              </button>
            </div>
          </div>
        </div>
      </form>

      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3 lg:hidden">
        {["Wszystko", ...categories].map((category) => (
          <button
            key={category}
            type="button"
            onClick={() => void setParams({ category })}
            className={cn(
              "whitespace-nowrap rounded-full border px-3 py-2 text-[11px] font-black transition",
              selectedCategory === category
                ? "border-blue-200 bg-blue-50 text-blue-700"
                : "border-slate-200 bg-white text-slate-500"
            )}
          >
            {category}
          </button>
        ))}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="no-scrollbar -mx-3 flex items-center gap-1 overflow-x-auto px-3 sm:mx-0 sm:px-0">
          {(["dostawcy", "produkty", "wszystko"] as const).map((tab) => (
            <button
              key={tab}
              type="button"
              onClick={() => void setParams({ tab, view: tab === "produkty" ? "list" : params.view })}
              className={cn(
                "whitespace-nowrap rounded-xl px-4 py-2 text-xs font-black uppercase tracking-wider transition-all",
                activeTab === tab ? "bg-blue-600 text-white shadow-sm" : "bg-white text-slate-500 hover:bg-slate-100"
              )}
            >
              {tab === "wszystko"
                ? `Wszystko (${filteredVendors.length + filteredProducts.length})`
                : tab === "produkty"
                  ? `Produkty (${filteredProducts.length})`
                  : `Dostawcy (${filteredVendors.length})`}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-[1fr_auto] gap-2 sm:flex sm:items-center">
          <label className="flex min-h-10 items-center gap-2 rounded-xl bg-white px-3 text-xs shadow-sm">
            <ArrowUpDown className="h-4 w-4 text-slate-400" />
            <select
              value={params.sort}
              onChange={(event) => void setParams({ sort: event.target.value })}
              className="w-full cursor-pointer bg-transparent font-bold text-slate-700 outline-none"
            >
              <option value="name">Nazwa A-Z</option>
              <option value="distance">Dystans</option>
              <option value="completeness">Ocena profilu</option>
              {brands.slice(0, 6).map((brand) => (
                <option key={brand} value={`brand:${brand}`}>
                  Marka: {brand}
                </option>
              ))}
            </select>
          </label>

          <button
            type="button"
            onClick={() => void setParams({ view: viewMode === "list" ? "map" : "list" })}
            className="inline-flex min-h-10 items-center justify-center gap-2 rounded-xl bg-[#1f3347] px-3 text-xs font-black uppercase tracking-wide text-white shadow-sm xl:hidden"
          >
            {viewMode === "list" ? <MapIcon className="h-4 w-4" /> : <List className="h-4 w-4" />}
            {viewMode === "list" ? "Mapa" : "Lista"}
          </button>
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[248px_minmax(0,1fr)] xl:grid-cols-[248px_minmax(0,1fr)_390px] xl:items-start">
        <aside className="hidden rounded-2xl bg-white p-4 shadow-sm lg:block">
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
                  "block w-full rounded-xl px-3 py-2 text-left text-xs font-black transition-colors",
                  selectedCategory === category ? "bg-blue-50 text-blue-700" : "text-slate-600 hover:bg-slate-100"
                )}
              >
                {category}
              </button>
            ))}
          </div>
        </aside>

        <div className={cn("space-y-5", viewMode === "map" ? "hidden xl:block" : "block")}>
          {activeTab === "wszystko" ? (
            <>
              <section className="space-y-3">
                <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                  Zweryfikowani Dostawcy ({filteredVendors.length})
                </h3>
                {filteredVendors.length ? (
                  <div className="grid grid-cols-1 gap-4">
                    {orderedVendors.slice(0, 6).map((vendor) => (
                      <SupplierResultCard
                        key={vendor.id}
                        vendor={vendor}
                        selected={highlightedVendor?.id === vendor.id}
                        onSelectMap={() => selectMapVendor(vendor)}
                      />
                    ))}
                  </div>
                ) : (
                  <EmptyState label="Brak pasujących dostawców." />
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
            </>
          ) : null}

          {activeTab === "dostawcy" ? (
            <section className="space-y-4">
              <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                Dostawcy w Twojej okolicy ({filteredVendors.length})
              </h3>
              {filteredVendors.length ? (
                <div className="grid grid-cols-1 gap-4">
                  {orderedVendors.map((vendor) => (
                    <SupplierResultCard
                      key={vendor.id}
                      vendor={vendor}
                      selected={highlightedVendor?.id === vendor.id}
                      onSelectMap={() => selectMapVendor(vendor)}
                    />
                  ))}
                </div>
              ) : (
                <EmptyState label="Brak dostawców spełniających kryteria wyszukiwania." />
              )}
            </section>
          ) : null}

          {activeTab === "produkty" ? (
            <section className="space-y-4">
              <h3 className="font-mono text-xs font-black uppercase tracking-widest text-slate-400">
                Katalog produktów ({filteredProducts.length})
              </h3>
              {filteredProducts.length ? (
                <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                  {filteredProducts.map((product) => (
                    <ProductMiniCard key={product.id} product={product} vendor={supplierById.get(product.vendorId)} />
                  ))}
                </div>
              ) : (
                <EmptyState label="Brak produktów spełniających wybrane kryteria." />
              )}
            </section>
          ) : null}
        </div>

        <section
          ref={mapSectionRef}
          className={cn(
            "overflow-hidden rounded-2xl bg-white shadow-sm xl:mt-8",
            viewMode === "list" ? "hidden xl:block" : "block lg:col-span-2 xl:col-span-1"
          )}
        >
          <div className="relative aspect-square overflow-hidden bg-blue-50/40 xl:sticky xl:top-20">
            <div className="absolute inset-0 bg-[radial-gradient(#1d4ed810_1px,transparent_1px)] [background-size:16px_16px]" />
            <div className="absolute left-1/2 top-1/2 flex h-5 w-5 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full bg-blue-600/15">
              <div className="h-2 w-2 rounded-full bg-blue-600" />
            </div>
            <span className="pointer-events-none absolute left-[52%] top-[52%] font-mono text-[9px] font-black uppercase tracking-wider text-blue-600/50">
              Poznań
            </span>

            {filteredVendors.map((vendor) => {
              const coords = vendorMapPins[vendor.id] ?? { x: 50, y: 50 };
              const isActive = hoveredVendorId === vendor.id || highlightedVendor?.id === vendor.id;
              return (
                <button
                  key={vendor.id}
                  type="button"
                  onClick={() => selectVendorFromMap(vendor)}
                  onMouseEnter={() => setHoveredVendorId(vendor.id)}
                  onMouseLeave={() => setHoveredVendorId(null)}
                  style={{ left: `${coords.x}%`, top: `${coords.y}%`, zIndex: isActive ? 40 : 10 }}
                  className="group absolute -translate-x-1/2 -translate-y-1/2 transition-all duration-300"
                  aria-label={`Pokaż dostawcę ${vendor.name}`}
                >
                  <span className={cn("pointer-events-none absolute -inset-3 rounded-full bg-blue-500/10 opacity-0 transition-all group-hover:opacity-100", isActive && "scale-110 opacity-100")} />
                  <span className={cn("pointer-events-none relative flex h-8 w-8 items-center justify-center rounded-full bg-white shadow-md transition-all", isActive && "z-20 scale-110 shadow-lg")}>
                    <MapPin className={cn("h-4 w-4", isActive ? "text-blue-600" : "text-slate-400")} />
                  </span>
                  <span className={cn("pointer-events-none absolute bottom-10 left-1/2 z-30 -translate-x-1/2 scale-90 whitespace-nowrap rounded-md bg-[#1f3347] px-2.5 py-1 text-[9px] font-bold uppercase tracking-wider text-white opacity-0 shadow-md transition-all", hoveredVendorId === vendor.id && "scale-100 opacity-100")}>
                    {vendor.name} ({vendor.serviceRadiusKm} km)
                  </span>
                </button>
              );
            })}

          </div>
        </section>
      </div>
    </div>
  );
}
