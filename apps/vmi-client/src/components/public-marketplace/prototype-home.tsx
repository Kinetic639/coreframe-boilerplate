import Link from "next/link";
import Image from "next/image";
import {
  ArrowRight,
  BookOpen,
  Check,
  Cpu,
  Disc,
  Droplet,
  FlaskConical,
  Hammer,
  Package,
  Plug,
  Search,
  Settings,
  ShieldCheck,
  Shirt,
  Sparkles,
  Wrench,
  Zap,
  MapPin
} from "lucide-react";
import type {
  MarketplaceSnapshotDto,
  PublicFlyerDto,
  PublicProductDto,
  PublicSupplierDetailsDto
} from "@/lib/public-marketplace/types";

function CategoryIcon({ category }: { category: string }) {
  const className = "mx-auto h-5 w-5";
  switch (category) {
    case "Części samochodowe":
      return <Cpu className={`${className} text-blue-500`} />;
    case "Chemia warsztatowa":
      return <FlaskConical className={`${className} text-indigo-500`} />;
    case "Narzędzia":
      return <Wrench className={`${className} text-amber-500`} />;
    case "Wyposażenie warsztatu":
      return <Hammer className={`${className} text-teal-500`} />;
    case "Odzież robocza":
      return <Shirt className={`${className} text-orange-500`} />;
    case "Bezpieczeństwo i BHP":
      return <ShieldCheck className={`${className} text-green-500`} />;
    case "Opony i akcesoria":
      return <Disc className={`${className} text-rose-500`} />;
    case "Materiały eksploatacyjne":
      return <Package className={`${className} text-purple-500`} />;
    case "Elektryka pojazdowa":
      return <Zap className={`${className} text-yellow-500`} />;
    case "Kosmetyki samochodowe":
      return <Droplet className={`${className} text-sky-500`} />;
    case "Łączniki i pneumatyka":
      return <Plug className={`${className} text-emerald-500`} />;
    default:
      return <Settings className={`${className} text-slate-500`} />;
  }
}

function FeaturedVendorCard({ vendor }: { vendor: PublicSupplierDetailsDto }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative h-28 overflow-hidden bg-slate-50">
        <Image
          src={vendor.coverUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-white/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-slate-700 shadow-sm">
          <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
          {vendor.city}
        </div>
      </div>

      <div className="flex flex-1 flex-col space-y-4 p-5">
        <div className="relative -mt-10 flex items-start gap-3">
          <Image
            src={vendor.logoUrl}
            alt=""
            width={48}
            height={48}
            unoptimized
            className="relative z-10 h-12 w-12 rounded-xl bg-white object-cover p-1 shadow-md"
          />
          <div className="pt-8">
            <span className="rounded bg-blue-50 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest text-blue-600">
              {vendor.industry}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-normal text-slate-900 transition-colors group-hover:text-blue-600">
              {vendor.name}
            </h3>
            {vendor.verificationStatus === "verified" ? (
              <ShieldCheck className="h-4 w-4 shrink-0 fill-blue-500/10 text-blue-500" />
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-slate-500">{vendor.shortDescription}</p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {vendor.featuredBrands.map((brand) => (
            <span
              key={brand}
              className="rounded-full bg-slate-50 px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-slate-400 shadow-sm"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 bg-slate-50/70 p-4">
        <span className="text-[10px] font-medium text-slate-400">{vendor.responseTimeText}</span>
        <Link
          href={`/vendors/${vendor.slug}`}
          className="flex items-center gap-0.5 rounded-lg bg-[#2A3B4C] px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-white transition-all hover:brightness-110"
        >
          Otwórz profil <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}

function FlyerCard({
  flyer,
  vendor
}: {
  flyer: PublicFlyerDto;
  vendor?: PublicSupplierDetailsDto;
}) {
  return (
    <Link
      href={`/flyers/${flyer.slug}`}
      className="group overflow-hidden rounded-xl bg-white shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-slate-50">
        <Image
          src={flyer.coverUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-4">
          <span className="mb-1 w-fit rounded bg-blue-950/40 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest text-blue-400">
            {vendor?.name}
          </span>
          <h4 className="line-clamp-2 text-xs font-bold leading-tight text-white">{flyer.title}</h4>
        </div>
      </div>
      <div className="flex items-center justify-between p-3.5 text-[10px] font-bold uppercase tracking-wider text-slate-500">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-blue-500" />
          {flyer.pages.length} strony
        </span>
        <span className="flex items-center gap-0.5 text-blue-600">
          Przeglądaj <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function ProductTeaser({
  product,
  vendor
}: {
  product: PublicProductDto;
  vendor?: PublicSupplierDetailsDto;
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col rounded-xl bg-white p-4 shadow-md transition-all hover:shadow-lg"
    >
      <div className="relative mb-3.5 aspect-square overflow-hidden rounded-lg bg-slate-50">
        <Image
          src={product.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.isNew ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-blue-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
            Nowość
          </span>
        ) : null}
      </div>
      <span className="font-mono text-[8px] font-black uppercase tracking-widest text-blue-600">
        {product.brand} · {vendor?.name}
      </span>
      <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-tight text-slate-900 group-hover:text-blue-600">
        {product.name}
      </h3>
      <p className="mt-auto pt-3 text-[9px] font-semibold text-slate-400">
        Op: {product.packSize} {product.unit}
      </p>
    </Link>
  );
}

export function PrototypeMarketplaceHome({ snapshot }: { snapshot: MarketplaceSnapshotDto }) {
  const featuredVendors = snapshot.suppliers.slice(0, 4);
  const newProducts = snapshot.products.filter((product) => product.isNew).slice(0, 4);
  const vendorById = new Map(snapshot.suppliers.map((vendor) => [vendor.id, vendor]));

  return (
    <div className="space-y-12 pb-12">
      <section className="relative overflow-hidden bg-gradient-to-br from-[#1E2B38] via-[#2A3B4C] to-[#0E151F] px-4 py-16 text-white md:py-24">
        <div className="absolute inset-0 bg-[linear-gradient(to_right,#ffffff05_1px,transparent_1px),linear-gradient(to_bottom,#ffffff05_1px,transparent_1px)] bg-[size:24px_24px]" />

        <div className="relative z-10 mx-auto max-w-4xl space-y-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-blue-500/10 px-3.5 py-1 text-xs font-black uppercase tracking-widest text-blue-300">
            <Sparkles className="h-3.5 w-3.5 animate-pulse text-blue-400" />
            Otwarte wyszukiwanie dostawców B2B
          </div>

          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-normal md:text-5xl">
            Znajdź Certyfikowanych Dostawców{" "}
            <span className="bg-gradient-to-r from-blue-400 to-indigo-300 bg-clip-text text-transparent">
              Ambra VMI
            </span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-slate-300 md:text-base">
            Przeglądaj asortyment hurtowy, sprawdzaj lokalizacje w Poznaniu i całej Polsce,
            pobieraj gazetki promocyjne i składaj zapytania ofertowe (RFQ) w jednym koszyku.
          </p>

          <form
            action="/vendors"
            className="mx-auto flex max-w-3xl flex-col items-stretch gap-2 rounded-2xl bg-white p-2 text-slate-900 shadow-2xl md:flex-row"
          >
            <div className="flex flex-1 items-center gap-2 px-3 py-2 md:border-r md:py-0">
              <Search className="h-4 w-4 shrink-0 text-slate-400" />
              <input
                type="text"
                name="query"
                placeholder="Szukaj produktu, marki lub dostawcy..."
                className="w-full bg-transparent text-xs font-bold outline-none"
              />
            </div>

            <div className="flex w-full items-center gap-2 px-3 py-2 md:w-56 md:py-0">
              <MapPin className="h-4 w-4 shrink-0 text-slate-400" />
              <select name="city" className="w-full cursor-pointer bg-transparent text-xs font-bold outline-none">
                <option value="">Wszystkie miasta</option>
                {snapshot.cities.map((city) => (
                  <option key={city} value={city}>
                    {city}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="submit"
              className="flex items-center justify-center gap-1.5 rounded-xl bg-gradient-to-r from-blue-600 to-indigo-700 px-6 py-3 text-xs font-black text-white transition-all hover:brightness-110"
            >
              Wyszukaj dostawców
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] font-black uppercase tracking-wider text-slate-400">
            <span>Popularne:</span>
            {["Części", "Castrol", "Wurth", "Narzędzia", "Yato", "BHP"].map((tag) => (
              <Link
                key={tag}
                href={`/vendors?query=${encodeURIComponent(tag)}`}
                className="rounded-md bg-white/5 px-2.5 py-1 text-slate-300 transition-colors hover:bg-white/10"
              >
                {tag}
              </Link>
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-black uppercase tracking-normal text-slate-900">
              Kategorie B2B
            </h2>
            <p className="text-xs text-slate-400">Przeglądaj asortyment certyfikowany przez branżę.</p>
          </div>
          <Link href="/vendors" className="flex items-center gap-0.5 text-xs font-black text-blue-600 hover:underline">
            Wszystkie <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {snapshot.categories.slice(0, 6).map((category) => (
            <Link
              key={category}
              href={`/vendors?category=${encodeURIComponent(category)}`}
              className="group rounded-xl bg-white p-4 text-center shadow-md transition-all hover:shadow-lg"
            >
              <div className="mb-2.5 flex justify-center transition-transform group-hover:scale-110">
                <CategoryIcon category={category} />
              </div>
              <h4 className="line-clamp-1 text-[11px] font-extrabold uppercase tracking-normal text-slate-800 transition-colors group-hover:text-blue-600">
                {category}
              </h4>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-black uppercase tracking-normal text-slate-900">
              Wyróżnieni Dostawcy
            </h2>
            <p className="text-xs text-slate-400">
              Certyfikowani producenci i dystrybutorzy o sprawdzonej wydajności logistycznej.
            </p>
          </div>
          <Link href="/vendors" className="flex items-center gap-0.5 text-xs font-black text-blue-600 hover:underline">
            Pokaż wszystkich ({snapshot.suppliers.length}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredVendors.map((vendor) => (
            <FeaturedVendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      </section>

      <section className="bg-white py-12">
        <div className="mx-auto max-w-7xl space-y-8 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-black uppercase tracking-normal text-slate-900">
                Aktywne Gazetki Produktowe B2B
              </h2>
              <p className="text-xs text-slate-400">
                Wygodne, interaktywne gazetki promocyjne dostawców. Zamawiaj bezpośrednio ze stron gazetki.
              </p>
            </div>
            <Link href="/vendors" className="flex items-center gap-0.5 text-xs font-black text-blue-600 hover:underline">
              Wszystkie gazetki <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>

          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {snapshot.flyers.slice(0, 4).map((flyer) => (
              <FlyerCard key={flyer.id} flyer={flyer} vendor={vendorById.get(flyer.vendorId)} />
            ))}
          </div>
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4">
        <div>
          <h2 className="font-display text-base font-black uppercase tracking-normal text-slate-900">
            Nowości produktowe
          </h2>
          <p className="text-xs font-medium text-slate-400">
            Najnowszy asortyment hurtowy zgłoszony przez zweryfikowanych partnerów.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newProducts.map((product) => (
            <ProductTeaser key={product.id} product={product} vendor={vendorById.get(product.vendorId)} />
          ))}
        </div>
      </section>

      <section className="mx-auto w-[calc(100%-2rem)] max-w-7xl overflow-hidden rounded-3xl bg-gradient-to-br from-[#2A3B4C] to-[#1E2B38] px-4 py-12 text-white shadow-xl">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center md:grid-cols-3 md:text-left">
          {[
            ["Szybka weryfikacja", "Sprawdź profile i dostępność jeszcze przed kontaktem."],
            ["Zapytania RFQ", "Buduj koszyk zapytań ofertowych z wielu produktów."],
            ["Gotowość VMI", "Widzisz, którzy dostawcy nadają się do stałej współpracy."]
          ].map(([title, text]) => (
            <div key={title} className="space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-xl bg-blue-500/20 text-blue-300 md:mx-0">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="font-display text-sm font-black uppercase">{title}</h3>
              <p className="text-xs leading-6 text-slate-300">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
