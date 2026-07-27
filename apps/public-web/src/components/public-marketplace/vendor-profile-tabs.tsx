"use client";

import Image from "next/image";
import Link from "next/link";
import { useMemo, useState } from "react";
import {
  ArrowRight,
  Building2,
  Check,
  Clock,
  Grid2X2,
  Heart,
  List,
  Mail,
  MapPin,
  MessageSquare,
  PackagePlus,
  Phone,
  Search,
  Settings2,
  SlidersHorizontal,
  ShieldCheck,
  Table2,
  Truck,
} from "lucide-react";
import { Button } from "@repo/ui/button";
import type {
  PublicCatalogDto,
  PublicProductDto,
  PublicSupplierDetailsDto,
} from "@/lib/public-marketplace/types";

type VendorProfileTab = "info" | "catalog" | "contact";
type CatalogViewMode = "tile" | "list" | "table";

interface VendorProfileTabsProps {
  supplier: PublicSupplierDetailsDto;
  products: PublicProductDto[];
  catalogs: PublicCatalogDto[];
}

function formatProductPrice(product: PublicProductDto, compact = false) {
  const amount = (value: number) =>
    value.toLocaleString("pl-PL", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    });

  if (product.priceMode === "exact" && product.priceValue) {
    return (
      <p className="font-extrabold text-xs text-foreground">
        {amount(product.priceValue)} PLN{" "}
        {!compact ? <span className="text-[10px] font-normal text-muted-foreground">/{product.unit}</span> : null}
      </p>
    );
  }

  if (product.priceMode === "from" && product.priceValue) {
    return <p className="text-xs font-extrabold text-foreground">od {amount(product.priceValue)} PLN</p>;
  }

  if (product.priceMode === "range" && product.priceValue && product.priceMax) {
    return (
      <p className="text-xs font-extrabold text-foreground">
        {amount(product.priceValue)} - {amount(product.priceMax)} PLN
      </p>
    );
  }

  if (product.priceMode === "on_request") {
    return (
      <span className="font-mono text-[9px] font-black uppercase tracking-wider text-orange-600">
        {compact ? "Zapytanie" : "Cena na zapytanie"}
      </span>
    );
  }

  return (
    <span className="font-mono text-[9px] font-black uppercase tracking-wider text-primary">
      {compact ? "Po zalogowaniu" : "Cena po zalogowaniu"}
    </span>
  );
}

function productStock(product: PublicProductDto) {
  return (product.id.charCodeAt(product.id.length - 1) * 7) % 180 + 35;
}

function distanceFromPoznan(supplier: PublicSupplierDetailsDto) {
  const poznan = { latitude: 52.4064, longitude: 16.9252 };
  const latDelta = ((supplier.geo.latitude - poznan.latitude) * Math.PI) / 180;
  const lonDelta = ((supplier.geo.longitude - poznan.longitude) * Math.PI) / 180;
  const fromLat = (poznan.latitude * Math.PI) / 180;
  const toLat = (supplier.geo.latitude * Math.PI) / 180;
  const a =
    Math.sin(latDelta / 2) ** 2 +
    Math.cos(fromLat) * Math.cos(toLat) * Math.sin(lonDelta / 2) ** 2;
  return Number((6371 * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a))).toFixed(1));
}

function ProductTile({
  product,
  hidePrices,
}: {
  product: PublicProductDto;
  hidePrices: boolean;
}) {
  return (
    <article className="group relative flex min-h-full flex-col justify-between rounded-xl border border-border bg-card p-3.5 text-left shadow-md transition-all hover:shadow-lg">
      <div>
        <div className="relative mb-3 aspect-[4/3] shrink-0 overflow-hidden rounded-lg bg-muted">
        <Image
          src={product.imageUrl}
          alt={product.name}
          fill
          unoptimized
          sizes="(min-width: 1024px) 20vw, 50vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.isNew ? (
          <span className="absolute left-2 top-2 z-10 rounded-full bg-primary px-2 py-0.5 text-[8px] font-black uppercase text-primary-foreground">
            NOWOŚĆ
          </span>
        ) : null}
        <button
          type="button"
          className="absolute right-2 top-2 rounded-full bg-background/95 p-1.5 text-muted-foreground shadow-sm transition hover:text-rose-500"
          aria-label="Zapisz produkt"
        >
          <Heart className="h-3.5 w-3.5" />
        </button>
      </div>

        <div className="space-y-1.5">
          <span className="font-mono text-[8px] font-black uppercase tracking-widest text-primary">
            {product.brand}
          </span>
          <Link
            href={`/vmi/products/${product.slug}`}
            className="line-clamp-2 text-xs font-bold leading-snug text-foreground transition-colors hover:text-primary hover:underline"
          >
            {product.name}
          </Link>
          <p className="font-mono text-[9px] text-muted-foreground">SKU: {product.sku}</p>

          <div className="mt-1 space-y-1 border-t border-border/60 pt-2">
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>W magazynie:</span>
              <span
                className={`font-mono font-extrabold ${
                  productStock(product) <= 45 ? "text-amber-600" : "text-emerald-600"
                }`}
              >
                {productStock(product)} szt.
              </span>
            </div>
            <div className="flex items-center justify-between text-[10px] text-muted-foreground">
              <span>Opakowanie:</span>
              <span className="font-mono font-extrabold text-primary">
                1 paczka = {product.packSize || 10} {product.unit || "szt."}
              </span>
            </div>
          </div>

          {!hidePrices ? <div className="pt-1 text-left text-xs">{formatProductPrice(product)}</div> : null}
        </div>
      </div>

      <div className="mt-3 border-t border-border/60 pt-3">
        <button
          type="button"
          className="flex w-full items-center justify-center rounded-xl border border-transparent bg-primary px-3 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
        >
          Szczegóły
        </button>
      </div>
    </article>
  );
}

function ProductListRow({
  product,
  hidePrices,
}: {
  product: PublicProductDto;
  hidePrices: boolean;
}) {
  return (
    <article className="group rounded-xl border border-border bg-card p-3 text-left text-xs shadow-md transition-all hover:shadow-lg">
      <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-3">
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg bg-muted">
            <Image src={product.imageUrl} alt={product.name} fill unoptimized sizes="56px" className="object-cover" />
            <button
              type="button"
              className="absolute right-1 top-1 rounded-full bg-background/90 p-1 text-muted-foreground shadow-sm hover:text-rose-500"
              aria-label="Zapisz produkt"
            >
              <Heart className="h-2.5 w-2.5" />
            </button>
          </div>

          <div className="min-w-0 flex-1 space-y-1">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-mono text-[8px] font-black uppercase tracking-widest text-primary">
                {product.brand}
              </span>
              <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-muted-foreground">
                {product.category}
              </span>
              {product.isNew ? (
                <span className="rounded-full bg-primary px-1.5 py-0.5 text-[7px] font-black uppercase text-primary-foreground">
                  NOWOŚĆ
                </span>
              ) : null}
            </div>
          <Link
            href={`/vmi/products/${product.slug}`}
              className="block truncate text-xs font-bold text-foreground hover:text-primary hover:underline"
          >
            {product.name}
          </Link>
            <div className="flex flex-wrap items-center gap-x-2.5 font-mono text-[9px] text-muted-foreground">
              <span>SKU: {product.sku}</span>
              <span>•</span>
              <span className="font-bold text-emerald-600">W magazynie: {productStock(product)} szt.</span>
              <span>•</span>
              <span className="font-bold text-primary">
                Opakowanie: 1 paczka = {product.packSize || 10} {product.unit || "szt."}
              </span>
            </div>
          </div>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-4 border-t border-border/60 pt-2 sm:justify-end sm:border-t-0 sm:pt-0">
          {!hidePrices ? (
            <div className="shrink-0 text-left font-mono sm:text-right">
              <p className="text-[9px] text-muted-foreground">Cena</p>
              {formatProductPrice(product, true)}
            </div>
          ) : null}
          <button
            type="button"
            className="flex h-9 min-w-[100px] items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
          >
            Szczegóły
          </button>
        </div>
      </div>
    </article>
  );
}

function CatalogToolbar({
  search,
  setSearch,
  category,
  setCategory,
  categories,
}: {
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
}) {
  return (
    <div className="rounded-2xl border border-border bg-card p-3 shadow-sm">
      <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_220px] lg:items-center">
        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Wyszukaj w katalogu tego dostawcy..."
            className="w-full bg-transparent text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
          />
        </label>

        <label className="flex min-h-11 items-center gap-2 rounded-xl border border-border bg-background px-3">
          <span className="text-xs font-medium text-muted-foreground">Kategoria:</span>
          <select
            value={category}
            onChange={(event) => setCategory(event.target.value)}
            className="min-w-0 flex-1 cursor-pointer bg-transparent text-sm font-medium text-foreground outline-none"
          >
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  );
}

export function VendorProfileTabs({
  supplier,
  products,
  catalogs,
}: VendorProfileTabsProps) {
  const [activeTab, setActiveTab] = useState<VendorProfileTab>("info");
  const [catalogSearch, setCatalogSearch] = useState("");
  const [catalogCategory, setCatalogCategory] = useState("Wszystko");
  const [viewMode, setViewMode] = useState<CatalogViewMode>("tile");
  const [tileSize, setTileSize] = useState(200);
  const [hidePrices, setHidePrices] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [contactSent, setContactSent] = useState(false);
  const [isVendorSaved, setIsVendorSaved] = useState(false);

  const categories = useMemo(
    () => ["Wszystko", ...Array.from(new Set(products.map((product) => product.category))).sort()],
    [products],
  );

  const filteredProducts = useMemo(() => {
    const normalizedSearch = catalogSearch.trim().toLowerCase();
    return products.filter((product) => {
      const matchesCategory = catalogCategory === "Wszystko" || product.category === catalogCategory;
      const matchesSearch =
        !normalizedSearch ||
        [product.name, product.brand, product.sku, product.category, product.description]
          .join(" ")
          .toLowerCase()
          .includes(normalizedSearch);
      return matchesCategory && matchesSearch;
    });
  }, [catalogCategory, catalogSearch, products]);

  const tabs = [
    { id: "info" as const, label: "O firmie & Warunki" },
    { id: "catalog" as const, label: `Katalog B2B (${products.length})` },
    { id: "contact" as const, label: "Kontakt / Zapytaj" },
  ];

  return (
    <section className="mx-auto max-w-7xl px-4 pb-8 sm:px-6 lg:px-8">
      <div className="relative z-10 -mt-12 mb-8 md:-mt-16">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div className="flex flex-col items-start gap-4 text-left md:flex-row md:items-end">
            <div className="h-24 w-24 shrink-0 rounded-xl border border-border bg-card p-1 shadow-lg md:h-32 md:w-32">
              <div className="relative h-full w-full overflow-hidden rounded-lg">
                <Image
                  src={supplier.logoUrl}
                  alt={supplier.name}
                  fill
                  unoptimized
                  sizes="128px"
                  className="object-cover"
                />
              </div>
            </div>

            <div className="space-y-1.5 pt-4 md:self-start md:pt-16">
              <div className="mb-1 flex -translate-y-1/2 flex-wrap items-center gap-2 font-mono text-xs font-semibold uppercase tracking-wider">
                <span className="inline-flex items-center gap-1 rounded-md border border-border bg-background/95 px-2.5 py-1 text-muted-foreground shadow-sm">
                  <MapPin className="h-4 w-4 text-primary" />
                  {supplier.city}
                </span>
                <span className="rounded-md border border-primary/20 bg-background/95 px-2.5 py-1 text-primary shadow-sm">
                  {supplier.categories[0] ?? supplier.industry}
                </span>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <h1 className="text-xl font-black uppercase tracking-tight text-foreground md:text-3xl">
                  {supplier.name}
                </h1>
                {supplier.verificationStatus === "verified" ? (
                  <span title="Dostawca certyfikowany">
                    <ShieldCheck className="h-6 w-6 shrink-0 fill-primary/10 text-primary" />
                  </span>
                ) : null}
              </div>

              <p className="max-w-3xl text-sm leading-6 text-muted-foreground">
                {supplier.shortDescription}
              </p>
            </div>
          </div>

          <div className="grid gap-2 text-left text-xs font-semibold text-muted-foreground md:w-80 md:shrink-0 md:self-start md:pt-20">
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{supplier.address}</span>
            </p>
            <p className="flex items-start gap-2">
              <Truck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{distanceFromPoznan(supplier)} km od Ciebie</span>
            </p>
            <p className="flex items-start gap-2">
              <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
              <span>{supplier.openingHours}</span>
            </p>
          </div>
        </div>
      </div>

      <div className="mb-6 rounded-2xl border border-border bg-card p-1 shadow-sm">
        <div className="flex items-center gap-2">
          <div className="min-w-0 flex-1 overflow-x-auto">
            <div className="flex min-w-max gap-1">
              {tabs.map((tab) => (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveTab(tab.id)}
                  className={`rounded-xl px-4 py-3 text-xs font-semibold transition sm:text-sm ${
                    activeTab === tab.id
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:bg-muted hover:text-foreground"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>
          </div>
          <button
            type="button"
            onClick={() => setIsVendorSaved(!isVendorSaved)}
            className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-xl transition-all ${
              isVendorSaved ? "bg-rose-50 text-rose-500" : "text-muted-foreground hover:bg-muted"
            }`}
            title={isVendorSaved ? "Usuń ze schowka" : "Zapisz dostawcę"}
          >
            <Heart className={`h-5 w-5 ${isVendorSaved ? "fill-rose-500 text-rose-500" : ""}`} />
          </button>
        </div>
      </div>

      {activeTab === "info" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <div className="space-y-6">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                Profil dostawcy
              </p>
              <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
                O firmie i modelu współpracy
              </h2>
              <p className="mt-4 text-sm leading-7 text-muted-foreground">{supplier.longDescription}</p>
              <div className="mt-5 flex flex-wrap gap-2">
                {supplier.categories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setCatalogCategory(category);
                      setActiveTab("catalog");
                    }}
                    className="rounded-full border border-border bg-background px-3 py-1 text-xs font-semibold text-muted-foreground transition hover:text-foreground"
                  >
                    {category}
                  </button>
                ))}
              </div>
            </section>

            <section className="grid gap-4 sm:grid-cols-2">
              {catalogs.map((catalog) => (
                <article key={catalog.id} className="rounded-2xl border border-border bg-card p-5 shadow-sm">
                  <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                    {catalog.category}
                  </p>
                  <h3 className="mt-2 text-lg font-semibold text-foreground">{catalog.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-muted-foreground">{catalog.description}</p>
                  <button
                    type="button"
                    onClick={() => {
                      setCatalogCategory(catalog.category);
                      setActiveTab("catalog");
                    }}
                    className="mt-4 inline-flex items-center gap-1 text-sm font-semibold text-primary"
                  >
                    Zobacz katalog <ArrowRight className="h-4 w-4" />
                  </button>
                </article>
              ))}
            </section>
          </div>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Warunki i logistyka</h3>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <Truck className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.deliveryTerms}
                </p>
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.serviceArea}
                </p>
                <p className="flex gap-2">
                  <Building2 className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.openingHours}
                </p>
              </div>
            </section>

            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Opcje partnerstwa</h3>
              <div className="mt-4 space-y-2">
                {supplier.partnershipOptions.map((option) => (
                  <p key={option} className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Check className="h-4 w-4 text-primary" />
                    {option}
                  </p>
                ))}
              </div>
            </section>
          </aside>
        </div>
      ) : null}

      {activeTab === "catalog" ? (
        <div className="space-y-5">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
                E-katalog dostawcy
              </p>
              <h2 className="mt-1 text-2xl font-semibold tracking-tight text-foreground">
                Katalog B2B ({filteredProducts.length})
              </h2>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setShowSettings(!showSettings)}
              className="justify-start sm:justify-center"
            >
              <Settings2 className="h-4 w-4" />
              Opcje katalogu
            </Button>
          </div>

          <CatalogToolbar
            search={catalogSearch}
            setSearch={setCatalogSearch}
            category={catalogCategory}
            setCategory={setCatalogCategory}
            categories={categories}
          />

          {showSettings ? (
            <div className="flex flex-wrap items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-sm">
              <div className="inline-flex rounded-xl border border-border bg-background p-1">
                {[
                  { id: "tile" as const, label: "Kafle", icon: Grid2X2 },
                  { id: "list" as const, label: "Lista", icon: List },
                  { id: "table" as const, label: "Tabela", icon: Table2 },
                ].map((option) => {
                  const Icon = option.icon;
                  const isActive = viewMode === option.id;
                  return (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setViewMode(option.id)}
                      title={option.label}
                      className={`flex h-8 w-8 items-center justify-center rounded-lg transition ${
                        isActive ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground"
                      }`}
                    >
                      <Icon className="h-4 w-4" />
                    </button>
                  );
                })}
              </div>

              {viewMode === "tile" ? (
                <div className="flex min-h-10 flex-wrap items-center gap-3 rounded-xl border border-border bg-background px-3">
                  <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
                  <span className="text-xs font-medium text-muted-foreground">Rozmiar kafli</span>
                  <input
                    type="range"
                    min="140"
                    max="300"
                    value={tileSize}
                    onChange={(event) => setTileSize(Number(event.target.value))}
                    className="h-1 w-32 accent-primary"
                  />
                  <span className="font-mono text-xs font-semibold text-foreground">{tileSize}px</span>
                </div>
              ) : null}

              <button
                type="button"
                onClick={() => setHidePrices(!hidePrices)}
                className="inline-flex min-h-10 items-center gap-2 rounded-xl border border-border bg-background px-3 text-xs font-semibold text-foreground"
              >
                <span
                  className={`flex h-4 w-4 items-center justify-center rounded border ${
                    hidePrices ? "border-primary bg-primary text-primary-foreground" : "border-border"
                  }`}
                >
                  {hidePrices ? <Check className="h-3 w-3" /> : null}
                </span>
                Ukryj ceny netto
              </button>
            </div>
          ) : null}

          {filteredProducts.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-border bg-card p-8 text-center text-sm text-muted-foreground">
              Brak produktów dla wybranych filtrów.
            </div>
          ) : null}

          {viewMode === "tile" ? (
            <div
              className="grid gap-4"
              style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${tileSize}px, 1fr))` }}
            >
              {filteredProducts.map((product) => (
                <ProductTile key={product.id} product={product} hidePrices={hidePrices} />
              ))}
            </div>
          ) : null}

          {viewMode === "list" ? (
            <div className="space-y-3">
              {filteredProducts.map((product) => (
                <ProductListRow key={product.id} product={product} hidePrices={hidePrices} />
              ))}
            </div>
          ) : null}

          {viewMode === "table" ? (
            <div className="overflow-x-auto rounded-2xl border border-border bg-card shadow-sm">
              <table className="w-full min-w-[820px] border-collapse text-left text-xs">
                <thead className="bg-muted/60 text-muted-foreground">
                  <tr>
                    <th className="p-3 pl-4 font-semibold">Foto</th>
                    <th className="p-3 font-semibold">Produkt</th>
                    <th className="p-3 font-semibold">Kategoria</th>
                    <th className="p-3 font-mono font-semibold">SKU</th>
                    {!hidePrices ? <th className="p-3 text-right font-semibold">Cena</th> : null}
                    <th className="p-3 text-center font-semibold">Op. zbiorcze</th>
                    <th className="p-3 text-right font-semibold">Akcja</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredProducts.map((product) => (
                    <tr key={product.id} className="border-t border-border/70">
                      <td className="p-3 pl-4">
                        <div className="relative h-10 w-10 overflow-hidden rounded bg-muted">
                          <Image src={product.imageUrl} alt="" fill unoptimized sizes="40px" className="object-cover" />
                          <button
                            type="button"
                            className="absolute right-0.5 top-0.5 rounded-full bg-background/95 p-0.5 text-muted-foreground shadow-sm hover:text-rose-500"
                            aria-label="Zapisz produkt"
                          >
                            <Heart className="h-2.5 w-2.5" />
                          </button>
                        </div>
                      </td>
                      <td className="p-3">
                        <div>
                          <div className="flex flex-wrap items-center gap-1.5">
                            <span className="font-mono text-[8px] font-black uppercase tracking-widest text-primary">
                              {product.brand}
                            </span>
                            {product.isNew ? (
                              <span className="rounded-full bg-primary px-1.5 py-0.5 text-[7px] font-black uppercase text-primary-foreground">
                                NOWOŚĆ
                              </span>
                            ) : null}
                          </div>
                          <Link
                            href={`/vmi/products/${product.slug}`}
                            className="font-extrabold leading-tight text-foreground hover:text-primary hover:underline"
                          >
                            {product.name}
                          </Link>
                          <p className="mt-0.5 font-mono text-[9px] font-bold text-emerald-600">
                            W magazynie: {productStock(product)} szt.
                          </p>
                        </div>
                      </td>
                      <td className="p-3">
                        <span className="rounded bg-muted px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase text-muted-foreground">
                          {product.category}
                        </span>
                      </td>
                      <td className="p-3 font-mono text-muted-foreground">{product.sku}</td>
                      {!hidePrices ? (
                        <td className="p-3 text-right font-mono font-bold">
                          {formatProductPrice(product, true)}
                        </td>
                      ) : null}
                      <td className="p-3 text-center font-mono">
                        <div className="font-extrabold text-primary">{product.packSize}</div>
                        <div className="text-[9px] text-muted-foreground">({product.unit})</div>
                      </td>
                      <td className="p-3 text-right">
                        <button
                          type="button"
                          className="inline-flex h-9 min-w-[100px] items-center justify-center rounded-xl border border-transparent bg-primary px-4 py-2 text-xs font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-primary/90"
                        >
                          Szczegóły
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}
        </div>
      ) : null}

      {activeTab === "contact" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_360px]">
          <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-primary">
              Kontakt / Zapytaj
            </p>
            <h2 className="mt-2 text-2xl font-semibold tracking-tight text-foreground">
              Wyślij zapytanie do dostawcy
            </h2>
            {contactSent ? (
              <div className="mt-5 rounded-2xl border border-emerald-200 bg-emerald-50 p-5 text-sm text-emerald-800">
                Zapytanie zostało zapisane w mockowanym przepływie. Produkcyjna wysyłka zostanie podłączona do API.
              </div>
            ) : (
              <form
                className="mt-5 grid gap-4"
                onSubmit={(event) => {
                  event.preventDefault();
                  setContactSent(true);
                }}
              >
                <label className="space-y-1.5 text-sm font-medium text-foreground">
                  Adres e-mail do kontaktu *
                  <input
                    type="email"
                    required
                    placeholder="np. kontakt@twojwarsztat.pl"
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-foreground">
                  Temat
                  <input
                    type="text"
                    placeholder="Warunki B2B, VMI, wycena katalogu..."
                    className="w-full rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>
                <label className="space-y-1.5 text-sm font-medium text-foreground">
                  Wiadomość
                  <textarea
                    rows={5}
                    placeholder="Opisz czego potrzebujesz, lokalizację i oczekiwany termin kontaktu."
                    className="w-full resize-none rounded-xl border border-border bg-background px-3 py-2.5 text-sm outline-none focus:border-primary"
                  />
                </label>
                <Button type="submit" size="lg" className="w-full bg-gradient-amber shadow-glow sm:w-fit">
                  <MessageSquare className="h-4 w-4" />
                  Wyślij zapytanie
                </Button>
              </form>
            )}
          </section>

          <aside className="space-y-4">
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Kontakt B2B</h3>
              <div className="mt-4 space-y-3 text-sm text-muted-foreground">
                <p className="flex gap-2">
                  <Mail className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.contactEmail}
                </p>
                <p className="flex gap-2">
                  <Phone className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.contactPhone}
                </p>
                <p className="flex gap-2">
                  <MapPin className="mt-0.5 h-4 w-4 text-primary" />
                  {supplier.address}
                </p>
              </div>
            </section>
            <section className="rounded-2xl border border-border bg-card p-5 shadow-sm">
              <h3 className="text-sm font-semibold text-foreground">Szybkie akcje</h3>
              <div className="mt-4 grid gap-2">
                <Button variant="outline" className="justify-start">
                  <Heart className="h-4 w-4" />
                  Zapisz dostawcę
                </Button>
                <Button variant="outline" className="justify-start" onClick={() => setActiveTab("catalog")}>
                  <PackagePlus className="h-4 w-4" />
                  Przejdź do katalogu
                </Button>
              </div>
            </section>
          </aside>
        </div>
      ) : null}
    </section>
  );
}
