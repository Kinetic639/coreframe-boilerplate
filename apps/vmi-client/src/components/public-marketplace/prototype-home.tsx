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
  MapPin,
} from "lucide-react";
import type {
  MarketplaceSnapshotDto,
  PublicFlyerDto,
  PublicProductDto,
  PublicSupplierDetailsDto,
} from "@/lib/public-marketplace/types";

function CategoryIcon({ category }: { category: string }) {
  const className = "mx-auto h-5 w-5";
  switch (category) {
    case "Części samochodowe":
      return <Cpu className={`${className} text-amber-500`} />;
    case "Chemia warsztatowa":
      return <FlaskConical className={`${className} text-orange-500`} />;
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
      return <Settings className={`${className} text-muted-foreground`} />;
  }
}

function FeaturedVendorCard({ vendor }: { vendor: PublicSupplierDetailsDto }) {
  return (
    <article className="group flex h-full flex-col overflow-hidden rounded-2xl bg-card shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl">
      <div className="relative h-28 overflow-hidden bg-muted">
        <Image
          src={vendor.coverUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 bg-gradient-to-t from-black/40 to-transparent" />
        <div className="absolute right-3 top-3 flex items-center gap-1 rounded-full bg-card/90 px-2.5 py-1 text-[9px] font-black uppercase tracking-wide text-foreground shadow-sm">
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
            className="relative z-10 h-12 w-12 rounded-xl bg-card object-cover p-1 shadow-md"
          />
          <div className="pt-8">
            <span className="rounded bg-amber-50 px-2 py-0.5 font-mono text-[9px] font-black uppercase tracking-widest text-amber-600">
              {vendor.industry}
            </span>
          </div>
        </div>

        <div className="space-y-1.5">
          <div className="flex items-center gap-1.5">
            <h3 className="font-display text-sm font-extrabold uppercase tracking-normal text-foreground transition-colors group-hover:text-amber-600">
              {vendor.name}
            </h3>
            {vendor.verificationStatus === "verified" ? (
              <ShieldCheck className="h-4 w-4 shrink-0 fill-amber-500/10 text-amber-500" />
            ) : null}
          </div>
          <p className="line-clamp-2 text-xs leading-relaxed text-muted-foreground">
            {vendor.shortDescription}
          </p>
        </div>

        <div className="flex flex-wrap gap-1.5">
          {vendor.featuredBrands.map((brand) => (
            <span
              key={brand}
              className="rounded-full bg-muted px-2 py-0.5 text-[8px] font-bold uppercase tracking-wider text-muted-foreground shadow-sm"
            >
              {brand}
            </span>
          ))}
        </div>
      </div>

      <div className="mt-auto flex items-center justify-between gap-2 bg-muted/70 p-4">
        <span className="text-[10px] font-medium text-muted-foreground">
          {vendor.responseTimeText}
        </span>
        <Link
          href={`/vendors/${vendor.slug}`}
          className="flex items-center gap-0.5 rounded-md bg-primary px-3.5 py-1.5 text-[10px] font-black uppercase tracking-wider text-primary-foreground transition-colors hover:bg-amber-600"
        >
          Otwórz profil <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </article>
  );
}

function FlyerCard({
  flyer,
  vendor,
}: {
  flyer: PublicFlyerDto;
  vendor?: PublicSupplierDetailsDto;
}) {
  return (
    <Link
      href={`/flyers/${flyer.slug}`}
      className="group overflow-hidden rounded-xl bg-card shadow-md transition-all hover:-translate-y-0.5 hover:shadow-xl"
    >
      <div className="relative aspect-[3/4] overflow-hidden bg-muted">
        <Image
          src={flyer.coverUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-500 group-hover:scale-105"
        />
        <div className="absolute inset-0 flex flex-col justify-end bg-gradient-to-t from-black/70 to-transparent p-4">
          <span className="mb-1 w-fit rounded bg-amber-950/40 px-2 py-0.5 font-mono text-[8px] font-black uppercase tracking-widest text-amber-400">
            {vendor?.name}
          </span>
          <h4 className="line-clamp-2 text-xs font-bold leading-tight text-white">{flyer.title}</h4>
        </div>
      </div>
      <div className="flex items-center justify-between p-3.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
        <span className="flex items-center gap-1">
          <BookOpen className="h-3.5 w-3.5 text-amber-500" />
          {flyer.pages.length} strony
        </span>
        <span className="flex items-center gap-0.5 text-amber-600">
          Przeglądaj <ArrowRight className="h-3 w-3" />
        </span>
      </div>
    </Link>
  );
}

function ProductTeaser({
  product,
  vendor,
}: {
  product: PublicProductDto;
  vendor?: PublicSupplierDetailsDto;
}) {
  return (
    <Link
      href={`/products/${product.slug}`}
      className="group flex h-full flex-col rounded-xl bg-card p-4 shadow-md transition-all hover:shadow-lg"
    >
      <div className="relative mb-3.5 aspect-square overflow-hidden rounded-lg bg-muted">
        <Image
          src={product.imageUrl}
          alt=""
          fill
          unoptimized
          sizes="(min-width: 1024px) 25vw, 100vw"
          className="object-cover transition-transform duration-300 group-hover:scale-105"
        />
        {product.isNew ? (
          <span className="absolute left-2.5 top-2.5 rounded-full bg-amber-600 px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white shadow-sm">
            Nowość
          </span>
        ) : null}
      </div>
      <span className="font-mono text-[8px] font-black uppercase tracking-widest text-amber-600">
        {product.brand} · {vendor?.name}
      </span>
      <h3 className="mt-2 line-clamp-2 text-xs font-bold leading-tight text-foreground group-hover:text-amber-600">
        {product.name}
      </h3>
      <p className="mt-auto pt-3 text-[9px] font-semibold text-muted-foreground">
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
      <section className="relative overflow-hidden border-b border-border bg-background px-4 py-16 md:py-24">
        <div className="relative z-10 mx-auto max-w-4xl space-y-6 text-center">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-accent px-3.5 py-1 text-xs font-black uppercase tracking-widest text-accent-foreground">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            Otwarte wyszukiwanie dostawców B2B
          </div>

          <h1 className="font-display text-3xl font-black uppercase leading-none tracking-normal text-foreground md:text-5xl">
            Znajdź Certyfikowanych Dostawców <span className="text-primary">Ambra VMI</span>
          </h1>

          <p className="mx-auto max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground md:text-base">
            Przeglądaj asortyment hurtowy, sprawdzaj lokalizacje w Poznaniu i całej Polsce, pobieraj
            gazetki promocyjne i składaj zapytania ofertowe (RFQ) w jednym koszyku.
          </p>

          <form
            action="/vendors"
            className="mx-auto flex max-w-3xl flex-col items-stretch gap-2 rounded-lg border border-border bg-card p-2 text-foreground shadow-sm md:flex-row"
          >
            <div className="flex flex-1 items-center gap-2 px-3 py-2 md:border-r md:py-0">
              <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
              <input
                type="text"
                name="query"
                placeholder="Szukaj produktu, marki lub dostawcy..."
                className="w-full bg-transparent text-xs font-bold outline-none"
              />
            </div>

            <div className="flex w-full items-center gap-2 px-3 py-2 md:w-56 md:py-0">
              <MapPin className="h-4 w-4 shrink-0 text-muted-foreground" />
              <select
                name="city"
                className="w-full cursor-pointer bg-transparent text-xs font-bold outline-none"
              >
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
              className="flex items-center justify-center gap-1.5 rounded-md bg-primary px-6 py-3 text-xs font-black text-primary-foreground transition-colors hover:bg-amber-600"
            >
              Wyszukaj dostawców
            </button>
          </form>

          <div className="flex flex-wrap items-center justify-center gap-2 pt-2 text-[10px] font-black uppercase tracking-wider text-muted-foreground">
            <span>Popularne:</span>
            {["Części", "Castrol", "Wurth", "Narzędzia", "Yato", "BHP"].map((tag) => (
              <Link
                key={tag}
                href={`/vendors?query=${encodeURIComponent(tag)}`}
                className="rounded-md bg-accent px-2.5 py-1 text-accent-foreground transition-colors hover:bg-amber-100"
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
            <h2 className="font-display text-base font-black uppercase tracking-normal text-foreground">
              Kategorie B2B
            </h2>
            <p className="text-xs text-muted-foreground">
              Przeglądaj asortyment certyfikowany przez branżę.
            </p>
          </div>
          <Link
            href="/vendors"
            className="flex items-center gap-0.5 text-xs font-black text-amber-600 hover:underline"
          >
            Wszystkie <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6">
          {snapshot.categories.slice(0, 6).map((category) => (
            <Link
              key={category}
              href={`/vendors?category=${encodeURIComponent(category)}`}
              className="group rounded-xl bg-card p-4 text-center shadow-md transition-all hover:shadow-lg"
            >
              <div className="mb-2.5 flex justify-center transition-transform group-hover:scale-110">
                <CategoryIcon category={category} />
              </div>
              <h4 className="line-clamp-1 text-[11px] font-extrabold uppercase tracking-normal text-foreground transition-colors group-hover:text-amber-600">
                {category}
              </h4>
            </Link>
          ))}
        </div>
      </section>

      <section className="mx-auto max-w-7xl space-y-6 px-4">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-display text-base font-black uppercase tracking-normal text-foreground">
              Wyróżnieni Dostawcy
            </h2>
            <p className="text-xs text-muted-foreground">
              Certyfikowani producenci i dystrybutorzy o sprawdzonej wydajności logistycznej.
            </p>
          </div>
          <Link
            href="/vendors"
            className="flex items-center gap-0.5 text-xs font-black text-amber-600 hover:underline"
          >
            Pokaż wszystkich ({snapshot.suppliers.length}) <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {featuredVendors.map((vendor) => (
            <FeaturedVendorCard key={vendor.id} vendor={vendor} />
          ))}
        </div>
      </section>

      <section className="bg-card py-12">
        <div className="mx-auto max-w-7xl space-y-8 px-4">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="font-display text-base font-black uppercase tracking-normal text-foreground">
                Aktywne Gazetki Produktowe B2B
              </h2>
              <p className="text-xs text-muted-foreground">
                Wygodne, interaktywne gazetki promocyjne dostawców. Zamawiaj bezpośrednio ze stron
                gazetki.
              </p>
            </div>
            <Link
              href="/vendors"
              className="flex items-center gap-0.5 text-xs font-black text-amber-600 hover:underline"
            >
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
          <h2 className="font-display text-base font-black uppercase tracking-normal text-foreground">
            Nowości produktowe
          </h2>
          <p className="text-xs font-medium text-muted-foreground">
            Najnowszy asortyment hurtowy zgłoszony przez zweryfikowanych partnerów.
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {newProducts.map((product) => (
            <ProductTeaser
              key={product.id}
              product={product}
              vendor={vendorById.get(product.vendorId)}
            />
          ))}
        </div>
      </section>

      <section className="mx-auto w-[calc(100%-2rem)] max-w-7xl overflow-hidden rounded-lg border border-border bg-accent/30 px-4 py-12 shadow-sm">
        <div className="mx-auto grid max-w-4xl grid-cols-1 gap-8 text-center md:grid-cols-3 md:text-left">
          {[
            ["Szybka weryfikacja", "Sprawdź profile i dostępność jeszcze przed kontaktem."],
            ["Zapytania RFQ", "Buduj koszyk zapytań ofertowych z wielu produktów."],
            ["Gotowość VMI", "Widzisz, którzy dostawcy nadają się do stałej współpracy."],
          ].map(([title, text]) => (
            <div key={title} className="space-y-2">
              <div className="mx-auto flex h-10 w-10 items-center justify-center rounded-md bg-primary/10 text-primary md:mx-0">
                <Check className="h-5 w-5" />
              </div>
              <h3 className="font-display text-sm font-black uppercase text-foreground">{title}</h3>
              <p className="text-xs leading-6 text-muted-foreground">{text}</p>
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
