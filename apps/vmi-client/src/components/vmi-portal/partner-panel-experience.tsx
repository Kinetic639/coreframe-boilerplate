"use client";

import * as React from "react";
import Image from "next/image";
import { Link } from "@/i18n/navigation";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  FileText,
  Filter,
  Grid,
  Info,
  List,
  Mail,
  MessageSquare,
  Minus,
  Phone,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  ShoppingCart,
  Table,
  Trash2,
  X,
} from "lucide-react";
import { useCreateVmiOrder } from "@/lib/vmi-portal/hooks";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalLocationDto,
  VmiPortalOrderDto,
  VmiPortalProposalDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import type { PartnerPanelTab } from "@/lib/vmi-portal/vendor-slugs";
import { vendorPortalPath } from "@/lib/vmi-portal/vendor-slugs";
import { cn } from "@/utils/cn";

type ViewMode = "tile" | "list" | "table";
type QuickFilter = "all" | "ordered" | "lowStock";
type PartnerAnnouncementSlide = ReturnType<typeof buildPartnerSlides>[number];

interface PartnerPanelExperienceProps {
  vendor: VmiPortalVendorDto;
  products: VmiPortalInventoryItemDto[];
  orders: VmiPortalOrderDto[];
  proposals: VmiPortalProposalDto[];
  locations: VmiPortalLocationDto[];
  activeLocationId: string;
  initialTab?: PartnerPanelTab;
}

type CartLine = {
  inventoryItemId: string;
  requestedQty: number;
};

const accent = {
  blue: {
    bg: "bg-blue-600 hover:bg-blue-550",
    text: "text-blue-600 dark:text-blue-400",
    soft: "bg-blue-50 text-blue-700 dark:bg-blue-950/20 dark:text-blue-400",
    logo: "bg-gradient-to-br from-blue-600 to-indigo-700",
  },
  orange: {
    bg: "bg-amber-600 hover:bg-amber-550",
    text: "text-amber-600 dark:text-amber-400",
    soft: "bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-400",
    logo: "bg-gradient-to-br from-amber-500 to-orange-600",
  },
  green: {
    bg: "bg-emerald-600 hover:bg-emerald-550",
    text: "text-emerald-600 dark:text-emerald-400",
    soft: "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400",
    logo: "bg-gradient-to-br from-emerald-500 to-teal-600",
  },
  rose: {
    bg: "bg-rose-600 hover:bg-rose-550",
    text: "text-rose-600 dark:text-rose-400",
    soft: "bg-rose-50 text-rose-700 dark:bg-rose-950/20 dark:text-rose-400",
    logo: "bg-gradient-to-br from-rose-600 to-red-700",
  },
} satisfies Record<VmiPortalVendorDto["accentColor"], Record<string, string>>;

function initials(name: string) {
  return name
    .split(" ")
    .map((part) => part[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
}

function lineTotal(product: VmiPortalInventoryItemDto, qty: number) {
  return (product.promoPrice ?? product.price) * qty;
}

function buildPartnerSlides(vendor: VmiPortalVendorDto) {
  return [
    {
      id: `${vendor.id}-about`,
      type: "portfolio_about",
      title: `O nas: ${vendor.name}`,
      badge: "PORTFOLIO MARKI",
      badgeText: `Partner od ${vendor.portfolio.since}`,
      content: vendor.portfolio.about,
      ctaText: "Szczegóły",
      date: "Profil marki dostawcy VMI",
    },
    {
      id: `${vendor.id}-specialties`,
      type: "portfolio_specialties",
      title: "Nasze specjalizacje i certyfikaty",
      badge: "PORTFOLIO MARKI",
      badgeText: "STANDARDY JAKOŚCI",
      content: `Specjalizacje: ${vendor.portfolio.specialties.join(", ")}. Standardy: ${vendor.portfolio.certifications.join(", ")}.`,
      ctaText: "Szczegóły",
      date: "Profil marki dostawcy VMI",
    },
    ...vendor.announcements.map((item) => ({
      id: item.id,
      type: item.type,
      title: item.title,
      badge:
        item.type === "offer" ? "OFERTA SPECJALNA" : item.type === "announcement" ? "OGŁOSZENIE" : "KOMUNIKAT",
      badgeText: item.badgeText,
      content: item.content,
      ctaText: "Szczegóły",
      date: "2026-07-13",
    })),
  ];
}

function getNewsBadge(slide: PartnerAnnouncementSlide) {
  if (slide.type === "offer") return "OFERTA SPECJALNA";
  if (slide.type === "announcement") return "OGŁOSZENIE";
  if (slide.type === "portfolio_about") return "O NAS";
  if (slide.type === "portfolio_specialties") return "SPECJALIZACJE I NORMY";
  return "KOMUNIKAT";
}

function getNewsShortBadge(slide: PartnerAnnouncementSlide) {
  if (slide.type === "offer") return "Oferta";
  if (slide.type === "announcement") return "Ogł.";
  if (slide.type === "portfolio_about") return "O nas";
  if (slide.type === "portfolio_specialties") return "Specj.";
  return "Info";
}

function newsToneClass(slide: PartnerAnnouncementSlide) {
  if (slide.type === "offer") return "bg-red-500";
  if (slide.type === "announcement") return "bg-orange-500";
  if (slide.type.startsWith("portfolio")) return "bg-blue-600";
  return "bg-emerald-600";
}

export function PartnerPanelExperience({
  vendor,
  products,
  orders,
  proposals,
  locations,
  activeLocationId,
  initialTab = "overview",
}: PartnerPanelExperienceProps) {
  const styles = accent[vendor.accentColor];
  const { createOrder, isPending } = useCreateVmiOrder();
  const [activeTab, setActiveTab] = React.useState<PartnerPanelTab>(initialTab);
  const [cart, setCart] = React.useState<CartLine[]>([]);
  const [viewMode, setViewMode] = React.useState<ViewMode>("tile");
  const [tileSize, setTileSize] = React.useState(200);
  const [hidePrices, setHidePrices] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [quickFilter, setQuickFilter] = React.useState<QuickFilter>("all");
  const [search, setSearch] = React.useState("");
  const [category, setCategory] = React.useState("all");
  const [deliveryLocationId, setDeliveryLocationId] = React.useState(activeLocationId);
  const [deliveryDate, setDeliveryDate] = React.useState(() => {
    const date = new Date();
    date.setDate(date.getDate() + 2);
    return date.toISOString().slice(0, 10);
  });
  const [poReference, setPoReference] = React.useState("");
  const [comments, setComments] = React.useState("");
  const [checkoutMessage, setCheckoutMessage] = React.useState<string | null>(null);
  const [announcementId, setAnnouncementId] = React.useState<string | null>(null);
  const [announcementBoardId, setAnnouncementBoardId] = React.useState<string | null>(null);

  const vendorOrders = orders.filter((order) => order.vendorId === vendor.id);
  const activeOrders = vendorOrders.filter((order) => order.status !== "Dostarczone");
  const vendorProposals = proposals.filter((proposal) => proposal.vendorId === vendor.id);
  const categories = Array.from(new Set(products.map((product) => product.category))).sort();
  const orderedIds = new Set(vendorOrders.flatMap((order) => order.lines.map((line) => line.inventoryItemId)));
  const activeAnnouncement =
    vendor.announcements.find((item) => item.id === announcementId) ?? vendor.announcements[0];

  React.useEffect(() => {
    setActiveTab(initialTab);
  }, [initialTab]);

  React.useEffect(() => {
    if (!announcementBoardId) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") setAnnouncementBoardId(null);
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [announcementBoardId]);

  const setTab = (tab: PartnerPanelTab) => {
    setActiveTab(tab);
    window.history.pushState(null, "", vendorPortalPath(vendor.id, tab));
  };

  const filteredProducts = products.filter((product) => {
    if (category !== "all" && product.category !== category) return false;
    if (quickFilter === "ordered" && !orderedIds.has(product.id)) return false;
    if (quickFilter === "lowStock" && product.warehouseQty > 15) return false;
    if (search.trim()) {
      const query = search.toLowerCase();
      if (!product.productName.toLowerCase().includes(query) && !product.vendorSku.toLowerCase().includes(query)) {
        return false;
      }
    }
    return true;
  });

  const cartProducts = cart
    .map((line) => {
      const product = products.find((item) => item.id === line.inventoryItemId);
      return product ? { line, product } : null;
    })
    .filter(Boolean) as Array<{ line: CartLine; product: VmiPortalInventoryItemDto }>;
  const cartTotal = cartProducts.reduce((sum, item) => sum + lineTotal(item.product, item.line.requestedQty), 0);

  const addToCart = (product: VmiPortalInventoryItemDto, qty: number) => {
    setCart((current) => {
      const existing = current.find((line) => line.inventoryItemId === product.id);
      if (existing) {
        return current.map((line) =>
          line.inventoryItemId === product.id
            ? { ...line, requestedQty: line.requestedQty + qty }
            : line,
        );
      }
      return [...current, { inventoryItemId: product.id, requestedQty: qty }];
    });
  };

  const updateCartQty = (productId: string, qty: number) => {
    if (qty <= 0) {
      setCart((current) => current.filter((line) => line.inventoryItemId !== productId));
      return;
    }
    setCart((current) =>
      current.map((line) => (line.inventoryItemId === productId ? { ...line, requestedQty: qty } : line)),
    );
  };

  const checkout = async (event: React.FormEvent) => {
    event.preventDefault();
    setCheckoutMessage(null);
    const result = await createOrder({
      locationId: deliveryLocationId,
      lines: cart,
      notes: [poReference ? `PO: ${poReference}` : null, comments || null, `Dostawa: ${deliveryDate}`]
        .filter(Boolean)
        .join(" | "),
    });
    if (result.success) {
      setCart([]);
      setPoReference("");
      setComments("");
      setCheckoutMessage(`Zamówienie ${result.data.orderNumber} zostało przesłane do ${vendor.name}.`);
      return;
    }
    setCheckoutMessage(result.error);
  };

  return (
    <section className="space-y-5 text-xs">
      <Link
        href="/portal/vendors"
        className="inline-flex items-center gap-1.5 font-bold text-muted-foreground transition hover:text-foreground"
      >
        <ArrowLeft className="h-4 w-4" />
        Wróć do dostawców
      </Link>

      <div className="overflow-hidden rounded-2xl bg-[#1A2536] text-white shadow-sm dark:bg-[#090D16]">
        <div className="relative overflow-hidden p-5 sm:p-6">
          <div className="pointer-events-none absolute inset-0 truncate p-3 font-mono text-[9px] uppercase leading-none tracking-tight opacity-[0.08]">
            {Array(60).fill("VMI CONNECT - CERTIFIED PARTNER - ").join(" ")}
          </div>
          <div className="relative z-10 flex flex-col justify-between gap-5 md:flex-row md:items-center">
            <div className="flex items-center gap-4">
              <div className={cn("flex h-14 w-14 items-center justify-center rounded-2xl text-base font-black shadow-sm", styles.logo)}>
                {initials(vendor.name)}
              </div>
              <div>
                <p className="font-mono text-[10px] font-black uppercase tracking-widest text-slate-300">
                  Panel partnera VMI
                </p>
                <h1 className="font-display text-2xl font-black tracking-tight text-white">{vendor.name}</h1>
                <p className="mt-1 text-xs text-slate-300">{vendor.industry}</p>
              </div>
            </div>

            <div className="grid grid-cols-3 gap-2 text-center">
              <HeroMetric label="Produkty" value={products.length} />
              <HeroMetric label="Zamówienia" value={vendorOrders.length} />
              <HeroMetric label="Propozycje" value={vendorProposals.length} />
            </div>
          </div>
        </div>

        <div className="flex overflow-x-auto border-t border-gray-150 bg-white px-2 py-2 dark:border-white/10 dark:bg-black/10">
          {([
            { id: "overview", label: "Przegląd", icon: Info },
            { id: "catalog", label: "Katalog towarów", icon: Search },
            { id: "promotions", label: "Promocje", icon: BookOpen },
            { id: "quotations", label: "Oferty", icon: FileText },
            { id: "cart", label: `Koszyk (${cart.length})`, icon: ShoppingBag },
            { id: "contact", label: "Kontakt", icon: MessageSquare },
          ] as const).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => setTab(tab.id)}
                className={cn(
                  "flex shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-[10px] font-black uppercase tracking-wide transition",
                  isActive
                    ? "bg-[#2A3B4C] text-white shadow-sm dark:bg-white dark:text-[#1A2536]"
                    : "text-gray-600 hover:bg-gray-100 hover:text-[#1A2536] dark:text-slate-300 dark:hover:bg-white/10 dark:hover:text-white",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {activeTab === "overview" ? (
        <OverviewTab
          vendor={vendor}
          activeOrders={activeOrders}
          proposals={vendorProposals}
          products={products}
          styles={styles}
          onOpenCatalog={() => setTab("catalog")}
          onOpenAnnouncementBoard={setAnnouncementBoardId}
        />
      ) : null}

      {activeTab === "catalog" ? (
        <CatalogTab
          products={filteredProducts}
          allProductsCount={products.length}
          cart={cart}
          viewMode={viewMode}
          setViewMode={setViewMode}
          tileSize={tileSize}
          setTileSize={setTileSize}
          hidePrices={hidePrices}
          setHidePrices={setHidePrices}
          isSettingsOpen={isSettingsOpen}
          setIsSettingsOpen={setIsSettingsOpen}
          quickFilter={quickFilter}
          setQuickFilter={setQuickFilter}
          search={search}
          setSearch={setSearch}
          category={category}
          setCategory={setCategory}
          categories={categories}
          orderedCount={orderedIds.size}
          lowStockCount={products.filter((product) => product.warehouseQty <= 15).length}
          accentClass={styles.bg}
          addToCart={addToCart}
          updateCartQty={updateCartQty}
          removeFromCart={(productId) => updateCartQty(productId, 0)}
        />
      ) : null}

      {activeTab === "promotions" ? (
        <PromotionsTab
          vendor={vendor}
          activeAnnouncement={activeAnnouncement}
          onSelect={setAnnouncementId}
          onAsk={() => setTab("contact")}
        />
      ) : null}

      {activeTab === "quotations" ? (
        <QuotationsTab proposals={vendorProposals} products={products} onOpenCatalog={() => setTab("catalog")} />
      ) : null}

      {activeTab === "cart" ? (
        <CartTab
          cartProducts={cartProducts}
          cartTotal={cartTotal}
          locations={locations}
          deliveryLocationId={deliveryLocationId}
          setDeliveryLocationId={setDeliveryLocationId}
          deliveryDate={deliveryDate}
          setDeliveryDate={setDeliveryDate}
          poReference={poReference}
          setPoReference={setPoReference}
          comments={comments}
          setComments={setComments}
          checkoutMessage={checkoutMessage}
          isPending={isPending}
          checkout={checkout}
          updateCartQty={updateCartQty}
          removeFromCart={(productId) => updateCartQty(productId, 0)}
          onOpenCatalog={() => setTab("catalog")}
          accentClass={styles.bg}
        />
      ) : null}

      {activeTab === "contact" ? <ContactTab vendor={vendor} /> : null}

      {announcementBoardId ? (
        <PartnerAnnouncementBoard
          vendor={vendor}
          activeNewsId={announcementBoardId}
          onActiveNewsChange={setAnnouncementBoardId}
          onClose={() => setAnnouncementBoardId(null)}
        />
      ) : null}
    </section>
  );
}

function HeroMetric({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-white/10 px-3 py-2">
      <span className="block font-mono text-lg font-black text-white">{value}</span>
      <span className="block text-[9px] font-bold uppercase tracking-wider text-slate-300">{label}</span>
    </div>
  );
}

function OverviewTab({
  vendor,
  activeOrders,
  proposals,
  products,
  styles,
  onOpenCatalog,
  onOpenAnnouncementBoard,
}: {
  vendor: VmiPortalVendorDto;
  activeOrders: VmiPortalOrderDto[];
  proposals: VmiPortalProposalDto[];
  products: VmiPortalInventoryItemDto[];
  styles: Record<string, string>;
  onOpenCatalog: () => void;
  onOpenAnnouncementBoard: (activeNewsId: string) => void;
}) {
  const primaryProposal = proposals[0];
  const latestOrder = activeOrders[0];
  return (
    <div className="space-y-5">
      <OverviewAnnouncementBanner vendor={vendor} onOpenAnnouncementBoard={onOpenAnnouncementBoard} />

      <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-5">
        <div className="space-y-4 rounded-xl bg-white p-5 shadow-sm dark:bg-[#131A2E]">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 dark:text-white">Opiekun partnera</h2>
          <div className="flex items-center gap-3">
            <div className={cn("flex h-11 w-11 items-center justify-center rounded-xl text-sm font-black text-white", styles.logo)}>
              {vendor.accountManager.name[0]}
            </div>
            <div>
              <p className="font-black text-gray-950 dark:text-white">{vendor.accountManager.name}</p>
              <p className="text-[10px] text-gray-400">Główny opiekun VMI</p>
            </div>
          </div>
          <ContactLine icon={Phone} label="Telefon bezpośredni" value={vendor.accountManager.phone} href={`tel:${vendor.accountManager.phone}`} />
          <ContactLine icon={Mail} label="Email kontaktowy" value={vendor.accountManager.email} href={`mailto:${vendor.accountManager.email}`} />
          <div className={cn("rounded-lg p-3 text-center font-bold", styles.soft)}>
            Sugerowane dni dostaw: Poniedziałek i Czwartek
          </div>
        </div>

        <div className="space-y-3 rounded-xl bg-white p-5 shadow-sm dark:bg-[#131A2E]">
          <h2 className="text-sm font-black uppercase tracking-wider text-gray-950 dark:text-white">Ogłoszenia partnera</h2>
          {vendor.announcements.slice(0, 2).map((item) => (
            <div key={item.id} className="rounded-xl bg-gray-50 p-3 dark:bg-gray-900/40">
              <p className={cn("text-[9px] font-black uppercase tracking-wider", styles.text)}>{item.badgeText}</p>
              <h3 className="mt-1 line-clamp-2 font-bold text-gray-950 dark:text-white">{item.title}</h3>
              <p className="mt-1 line-clamp-2 text-[10px] leading-relaxed text-gray-500 dark:text-gray-400">{item.content}</p>
            </div>
          ))}
        </div>
      </div>

        <div className="space-y-4 lg:col-span-7">
        {primaryProposal ? (
          <div className={cn("space-y-3 rounded-xl p-4 text-xs shadow-sm", styles.soft)}>
            <div className="flex items-center gap-2">
              <span className="h-2 w-2 rounded-full bg-current animate-pulse" />
              <h2 className="font-bold">Aktywna propozycja VMI</h2>
            </div>
            <p className="leading-normal text-gray-600 dark:text-gray-400">
              System wygenerował kalkulację dostawy dla Twojego oddziału. Otwórz katalog albo oferty, aby zaakceptować lub zmienić zamówienie.
            </p>
            <button type="button" onClick={onOpenCatalog} className={cn("rounded-lg px-4 py-2 font-bold text-white", styles.bg)}>
              Otwórz panel propozycji VMI
            </button>
          </div>
        ) : null}

        <div className="space-y-4 rounded-xl bg-white p-5 text-xs shadow-sm dark:bg-[#131A2E]">
          <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1C1E] dark:text-white">Historia i statystyki</h2>
          <div className="grid grid-cols-2 gap-3 text-center">
            <Stat label="Złożone zamówienia" value={activeOrders.length} />
            <Stat label="Produkty w katalogu" value={products.length} />
          </div>
          {latestOrder ? (
            <div className="flex items-center justify-between rounded-lg bg-gray-50 p-3 dark:bg-gray-800/40">
              <div>
                <p className="font-mono font-bold text-[#1A1C1E] dark:text-white">{latestOrder.orderNumber}</p>
                <p className="text-[10px] text-gray-400 dark:text-gray-500">{latestOrder.date}</p>
              </div>
              <span className="font-semibold text-emerald-700 dark:text-emerald-400">{latestOrder.status}</span>
            </div>
          ) : (
            <p className="italic text-gray-400">Brak wcześniejszych zamówień.</p>
          )}
        </div>
      </div>
      </div>
    </div>
  );
}

function OverviewAnnouncementBanner({
  vendor,
  onOpenAnnouncementBoard,
}: {
  vendor: VmiPortalVendorDto;
  onOpenAnnouncementBoard: (activeNewsId: string) => void;
}) {
  const slides = React.useMemo(() => buildPartnerSlides(vendor), [vendor]);
  const [activeIndex, setActiveIndex] = React.useState(0);
  const currentSlide = slides[activeIndex % slides.length] ?? slides[0];

  React.useEffect(() => {
    if (slides.length <= 1) return;
    const intervalId = window.setInterval(() => {
      setActiveIndex((index) => (index + 1) % slides.length);
    }, 6500);
    return () => window.clearInterval(intervalId);
  }, [slides.length]);

  if (!currentSlide) return null;

  const goToPrevious = (event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveIndex((index) => (index - 1 + slides.length) % slides.length);
  };
  const goToNext = (event: React.MouseEvent) => {
    event.stopPropagation();
    setActiveIndex((index) => (index + 1) % slides.length);
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onOpenAnnouncementBoard(currentSlide.id)}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") onOpenAnnouncementBoard(currentSlide.id);
      }}
      className="group relative flex h-[250px] cursor-pointer flex-col justify-between overflow-hidden rounded-2xl bg-gradient-to-br from-[#1E2B38] to-slate-900 shadow-lg transition-all hover:shadow-xl sm:h-[220px] md:h-[200px]"
    >
      <div className="pointer-events-none absolute right-0 top-0 h-48 w-48 translate-x-12 -translate-y-12 rounded-full bg-blue-500/10 transition-transform duration-500 group-hover:scale-110" />
      <div className="pointer-events-none absolute bottom-0 left-0 h-32 w-32 -translate-x-6 translate-y-6 rounded-full bg-indigo-500/5" />

      <button
        type="button"
        onClick={goToPrevious}
        className="absolute left-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white opacity-0 shadow-md transition-all duration-300 hover:bg-white/20 group-hover:opacity-100"
        title="Poprzedni slajd"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <button
        type="button"
        onClick={goToNext}
        className="absolute right-3 top-1/2 z-20 -translate-y-1/2 rounded-full bg-white/10 p-2 text-white opacity-0 shadow-md transition-all duration-300 hover:bg-white/20 group-hover:opacity-100"
        title="Następny slajd"
      >
        <ChevronRight className="h-4 w-4" />
      </button>

      <div key={currentSlide.id} className="relative z-10 flex flex-1 flex-col justify-between gap-3 p-4 text-left motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300 sm:p-5 md:p-6">
        <div className="max-w-3xl space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span
              className={cn(
                "rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white",
                currentSlide.type === "offer"
                  ? "bg-red-500"
                    : currentSlide.type === "announcement"
                    ? "bg-orange-500"
                    : "bg-blue-600",
              )}
            >
              {currentSlide.badge}
            </span>
            {currentSlide.badgeText ? (
              <span className="rounded bg-white/10 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-gray-300">
                {currentSlide.badgeText}
              </span>
            ) : null}
          </div>

          <h2 className="line-clamp-1 text-sm font-black leading-snug text-white transition-colors group-hover:text-blue-300 md:text-base">
            {currentSlide.title}
          </h2>

          <p className="line-clamp-2 text-[11px] leading-relaxed text-slate-300/90 sm:text-xs">
            {currentSlide.content}
          </p>
        </div>

        <div className="flex items-center justify-start">
          <button
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              onOpenAnnouncementBoard(currentSlide.id);
            }}
            className="flex items-center justify-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2 text-[10px] font-extrabold text-white shadow-md transition-all hover:bg-blue-550 active:scale-95 sm:text-xs"
          >
            <span>Szczegóły</span>
            <ChevronRight className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>

      <div className="relative z-10 flex items-center justify-center gap-1.5 pb-3">
        {slides.map((slide, index) => (
          <button
            key={slide.id}
            type="button"
            onClick={(event) => {
              event.stopPropagation();
              setActiveIndex(index);
            }}
            className={cn(
              "h-2 rounded-full transition-all",
              index === activeIndex ? "w-4 bg-blue-500" : "w-2 bg-white/20 hover:bg-white/40",
            )}
            title={`Slajd ${index + 1}`}
          />
        ))}
      </div>
    </div>
  );
}

function PartnerAnnouncementBoard({
  vendor,
  activeNewsId,
  onActiveNewsChange,
  onClose,
}: {
  vendor: VmiPortalVendorDto;
  activeNewsId: string;
  onActiveNewsChange: (activeNewsId: string) => void;
  onClose: () => void;
}) {
  const allAnnouncements = buildPartnerSlides(vendor);
  const activeNews =
    allAnnouncements.find((announcement) => announcement.id === activeNewsId) ?? allAnnouncements[0];

  if (!activeNews) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/60 p-4 backdrop-blur-md dark:bg-black/80 md:p-6">
      <div className="flex h-[90vh] w-full max-w-5xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl dark:bg-[#0E1321]">
        <div className="flex items-center justify-between bg-gray-50 px-6 py-4 dark:bg-[#131A2E]">
          <div>
            <p className="text-[9px] font-extrabold uppercase leading-none tracking-widest text-gray-400 dark:text-gray-500">
              Tablica Ogłoszeń
            </p>
            <h2 className="mt-1 text-base font-black leading-tight text-[#1A1C1E] dark:text-white">
              {vendor.name}
            </h2>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="flex cursor-pointer items-center gap-2 rounded-xl bg-gray-100 px-3.5 py-1.5 text-xs font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          >
            <X className="h-3.5 w-3.5" />
            Zamknij tablicę [ESC]
          </button>
        </div>

        <div className="flex min-h-0 flex-1 flex-col overflow-hidden md:flex-row">
          <div className="flex-1 overflow-y-auto bg-[#F8F9FA]/30 p-6 dark:bg-[#0E1321] md:p-8">
            <div
              key={activeNews.id}
              className="space-y-6 animate-fade-in motion-safe:animate-in motion-safe:fade-in motion-safe:slide-in-from-bottom-2 motion-safe:duration-300"
            >
              <div className="space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={cn(
                      "rounded px-2 py-0.5 text-[8px] font-black uppercase tracking-wider text-white",
                      newsToneClass(activeNews),
                    )}
                  >
                    {getNewsBadge(activeNews)}
                  </span>
                  <span className="rounded bg-gray-150 px-2 py-0.5 font-mono text-[8px] font-bold uppercase tracking-wider text-gray-600 dark:bg-gray-800 dark:text-gray-300">
                    {activeNews.badgeText}
                  </span>
                </div>

                <h3 className="text-lg font-black leading-snug text-gray-950 dark:text-white md:text-xl">
                  {activeNews.title}
                </h3>

                <p className="font-mono text-[10px] text-gray-400">
                  {activeNews.type.startsWith("portfolio")
                    ? "Profil marki dostawcy VMI"
                    : `Opublikowano: ${activeNews.date} przez administratora VMI`}
                </p>
              </div>

              <p className="whitespace-pre-line rounded-2xl bg-white p-5 text-xs leading-relaxed text-gray-600 shadow-sm dark:bg-gray-850 dark:text-gray-300">
                {activeNews.content}
              </p>

              <div className="flex items-center justify-between rounded-xl bg-blue-50 p-4 dark:bg-blue-950/20">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-widest text-blue-700 dark:text-blue-400">
                    Zainteresowany?
                  </p>
                  <p className="text-[11px] text-gray-550 dark:text-gray-400">
                    Wyślij natychmiastowe zapytanie o szczegóły tej kampanii.
                  </p>
                </div>
                <button
                  type="button"
                  onClick={onClose}
                  className="flex shrink-0 cursor-pointer items-center gap-1 rounded-xl bg-blue-600 px-3.5 py-2 text-xs font-extrabold text-white shadow-sm transition-transform hover:bg-blue-550 active:scale-95"
                >
                  <MessageSquare className="h-3.5 w-3.5" />
                  Wyślij zapytanie
                </button>
              </div>
            </div>
          </div>

          <div className="flex w-full flex-col justify-between overflow-hidden bg-gray-50/50 dark:bg-[#121729] md:w-80 md:border-l md:border-gray-200 md:dark:border-gray-800">
            <div className="flex-1 space-y-2 overflow-y-auto p-4">
              <p className="px-1 text-[9px] font-black uppercase tracking-wider text-gray-400">
                Galeria ogłoszeń ({allAnnouncements.length})
              </p>
              <div className="space-y-1.5">
                {allAnnouncements.map((item) => {
                  const isActive = item.id === activeNews.id;

                  return (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => onActiveNewsChange(item.id)}
                      className={cn(
                        "w-full cursor-pointer rounded-xl p-3 text-left transition-all",
                        isActive
                          ? "bg-white shadow-sm dark:bg-[#131A2E]"
                          : "bg-[#F8F9FA]/40 dark:bg-transparent dark:hover:bg-gray-900/40",
                      )}
                    >
                      <span className="mb-1 flex flex-wrap items-center gap-1.5">
                        <span className={cn("rounded px-1 text-[8px] font-bold text-white", newsToneClass(item))}>
                          {getNewsShortBadge(item)}
                        </span>
                        <span className="font-mono text-[8px] text-gray-400">{item.date}</span>
                      </span>
                      <span
                        className={cn(
                          "line-clamp-2 text-[11px] font-extrabold leading-snug",
                          isActive ? "text-gray-900 dark:text-white" : "text-gray-600 dark:text-gray-400",
                        )}
                      >
                        {item.title}
                      </span>
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function CatalogTab(props: {
  products: VmiPortalInventoryItemDto[];
  allProductsCount: number;
  cart: CartLine[];
  viewMode: ViewMode;
  setViewMode: (mode: ViewMode) => void;
  tileSize: number;
  setTileSize: (size: number) => void;
  hidePrices: boolean;
  setHidePrices: (hide: boolean) => void;
  isSettingsOpen: boolean;
  setIsSettingsOpen: (open: boolean) => void;
  quickFilter: QuickFilter;
  setQuickFilter: (filter: QuickFilter) => void;
  search: string;
  setSearch: (value: string) => void;
  category: string;
  setCategory: (value: string) => void;
  categories: string[];
  orderedCount: number;
  lowStockCount: number;
  accentClass: string;
  addToCart: (product: VmiPortalInventoryItemDto, qty: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
}) {
  return (
    <div className="space-y-4">
      <div className="flex flex-col justify-between gap-3 rounded-xl bg-white p-3 text-xs shadow-sm dark:bg-[#131A2E] sm:flex-row sm:items-center">
        <div className="flex items-center gap-1 overflow-x-auto pb-1 sm:pb-0">
          <span className="mr-2 flex shrink-0 items-center gap-1 font-mono text-[8px] font-black uppercase tracking-wider text-gray-400">
            <Filter className="h-3 w-3" /> Szybki filtr:
          </span>
          {[
            ["all", `Wszystkie produkty (${props.allProductsCount})`],
            ["ordered", `Zamawiane w przeszłości (${props.orderedCount})`],
            ["lowStock", `Niski stan magazynowy (${props.lowStockCount})`],
          ].map(([id, label]) => (
            <button
              key={id}
              type="button"
              onClick={() => props.setQuickFilter(id as QuickFilter)}
              className={cn(
                "shrink-0 rounded-lg px-2.5 py-1 text-[10px] font-bold transition-all",
                props.quickFilter === id
                  ? "bg-gray-100 text-[#1A1C1E] dark:bg-gray-800 dark:text-white"
                  : "text-gray-500 hover:text-gray-950 dark:hover:text-white",
              )}
            >
              {label}
            </button>
          ))}
        </div>

        <div className="flex shrink-0 items-center justify-end gap-2">
          <div className="relative">
            <button
              type="button"
              onClick={() => props.setIsSettingsOpen(!props.isSettingsOpen)}
              className="flex items-center gap-1 rounded-lg bg-gray-50 p-1.5 text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750"
            >
              <Settings className="h-3.5 w-3.5" />
              <span className="text-[10px] font-extrabold">Opcje</span>
            </button>
            {props.isSettingsOpen ? (
              <>
                <button className="fixed inset-0 z-40 cursor-default" onClick={() => props.setIsSettingsOpen(false)} aria-label="Zamknij opcje" />
                <div className="absolute right-0 z-50 mt-2 w-56 space-y-2.5 rounded-xl bg-white p-3.5 text-xs shadow-xl dark:bg-[#0E1321]">
                  <p className="font-mono text-[9px] font-bold uppercase tracking-wider text-gray-400">Parametry katalogu</p>
                  <label className="flex cursor-pointer items-center gap-2.5 font-bold text-gray-700 hover:text-gray-950 dark:text-gray-300 dark:hover:text-white">
                    <input type="checkbox" checked={props.hidePrices} onChange={(event) => props.setHidePrices(event.target.checked)} className="h-4 w-4 cursor-pointer rounded text-blue-600 focus:ring-blue-500" />
                    Ukryj ceny netto
                  </label>
                </div>
              </>
            ) : null}
          </div>

          <div className="flex rounded-lg bg-gray-50 p-0.5 dark:bg-gray-800">
            {([
              ["tile", Grid],
              ["list", List],
              ["table", Table],
            ] as const).map(([id, Icon]) => (
              <button
                key={id}
                type="button"
                onClick={() => props.setViewMode(id as ViewMode)}
                className={cn(
                  "rounded-md p-1.5 transition-all",
                  props.viewMode === id
                    ? "bg-white text-[#2A3B4C] shadow-sm dark:bg-[#131A2E] dark:text-blue-400"
                    : "text-gray-400 hover:text-gray-750 dark:hover:text-gray-300",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
              </button>
            ))}
          </div>

          {props.viewMode === "tile" ? (
            <div className="flex items-center gap-2 rounded-lg bg-gray-50 px-2.5 py-1.5 text-[10px] dark:bg-gray-800">
              <span className="font-mono font-bold text-gray-450">Kafle:</span>
              <input type="range" min="120" max="300" value={props.tileSize} onChange={(event) => props.setTileSize(Number(event.target.value))} className="h-1 w-16 cursor-pointer appearance-none rounded-lg bg-gray-200 accent-blue-600 sm:w-24 dark:bg-gray-750" />
              <span className="whitespace-nowrap font-mono font-bold text-gray-600 dark:text-gray-300">{props.tileSize}px</span>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex flex-col gap-2.5 sm:flex-row">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-500 dark:text-gray-400" />
          <input value={props.search} onChange={(event) => props.setSearch(event.target.value)} placeholder="Wyszukaj produkt po nazwie lub SKU..." className="w-full rounded-xl bg-white py-2 pl-9 pr-3 text-xs text-[#1A1C1E] placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-[#2A3B4C] dark:bg-[#131A2E] dark:text-white dark:placeholder:text-gray-500" />
        </div>
        <select value={props.category} onChange={(event) => props.setCategory(event.target.value)} className="shrink-0 cursor-pointer rounded-xl bg-white px-3 py-2 text-xs text-[#1A1C1E] focus:outline-none dark:bg-[#131A2E] dark:text-white">
          <option value="all">Wszystkie kategorie</option>
          {props.categories.map((cat) => <option key={cat} value={cat}>{cat}</option>)}
        </select>
      </div>

      {props.products.length === 0 ? (
        <div className="rounded-xl bg-white py-12 text-center text-xs text-gray-500 dark:bg-[#131A2E]">Brak produktów pasujących do filtrów w tym katalogu.</div>
      ) : props.viewMode === "tile" ? (
        <div className="grid gap-3" style={{ gridTemplateColumns: `repeat(auto-fill, minmax(${props.tileSize}px, 1fr))` }}>
          {props.products.map((product) => (
            <PartnerProductCard key={product.id} product={product} cartLine={props.cart.find((line) => line.inventoryItemId === product.id)} hidePrices={props.hidePrices} accentClass={props.accentClass} addToCart={props.addToCart} updateCartQty={props.updateCartQty} removeFromCart={props.removeFromCart} />
          ))}
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-[#131A2E]">
          <div className={cn("grid gap-2", props.viewMode === "table" ? "divide-y divide-gray-150 dark:divide-gray-850" : "p-2")}>
            {props.products.map((product) => (
              <PartnerProductRow key={product.id} product={product} cartLine={props.cart.find((line) => line.inventoryItemId === product.id)} hidePrices={props.hidePrices} accentClass={props.accentClass} compact={props.viewMode === "list"} addToCart={props.addToCart} updateCartQty={props.updateCartQty} removeFromCart={props.removeFromCart} />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function ProductCartControl({
  product,
  cartLine,
  accentClass,
  addToCart,
  updateCartQty,
  removeFromCart,
}: {
  product: VmiPortalInventoryItemDto;
  cartLine?: CartLine;
  accentClass: string;
  addToCart: (product: VmiPortalInventoryItemDto, qty: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
}) {
  const [isEditing, setIsEditing] = React.useState(false);
  const [tempPacks, setTempPacks] = React.useState(1);
  const [showSuccess, setShowSuccess] = React.useState(false);
  const activePacks = cartLine ? Math.ceil(cartLine.requestedQty / product.packSize) : 0;

  const startEditing = () => {
    setTempPacks(activePacks > 0 ? activePacks : 1);
    setIsEditing(true);
  };

  const confirmSelection = () => {
    const requestedQty = tempPacks * product.packSize;
    if (requestedQty <= 0) {
      removeFromCart(product.id);
    } else if (cartLine) {
      updateCartQty(product.id, requestedQty);
    } else {
      addToCart(product, requestedQty);
    }

    setShowSuccess(true);
    window.setTimeout(() => {
      setShowSuccess(false);
      setIsEditing(false);
    }, 900);
  };

  if (showSuccess) {
    return (
      <div className="flex w-full items-center justify-center gap-1 rounded-xl bg-emerald-500 py-2 text-[10px] font-extrabold text-white shadow-sm transition-all animate-pulse motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:fade-in motion-safe:duration-200">
        <Check className="h-3.5 w-3.5 animate-bounce" />
        Zatwierdzono
      </div>
    );
  }

  if (isEditing) {
    return (
      <div className="flex w-full items-center gap-1.5 motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150">
        <button
          type="button"
          onClick={() => setTempPacks((value) => Math.max(0, value - 1))}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-700 transition-all hover:bg-gray-200 active:scale-90 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700"
          title="-1 paczka"
        >
          <Minus className="h-3 w-3" />
        </button>
        <div
          key={tempPacks}
          className="flex-1 rounded-lg bg-gray-50 py-1 text-center font-mono text-[10px] font-bold leading-tight text-gray-800 transition-all motion-safe:animate-in motion-safe:zoom-in-95 motion-safe:duration-150 dark:bg-gray-900/80 dark:text-blue-300"
        >
          <div className="font-extrabold tabular-nums">{tempPacks} op.</div>
          <div className="text-[8px] font-normal text-gray-400">({tempPacks * product.packSize} {product.unit})</div>
        </div>
        <button
          type="button"
          onClick={() => setTempPacks((value) => value + 1)}
          className={cn("flex h-7 w-7 shrink-0 items-center justify-center rounded-lg text-white transition-all active:scale-90", accentClass)}
          title="+1 paczka"
        >
          <Plus className="h-3 w-3" />
        </button>
        <button
          type="button"
          onClick={confirmSelection}
          className="flex h-7 w-7 shrink-0 items-center justify-center rounded-lg bg-emerald-600 text-white shadow-sm transition-all hover:bg-emerald-500 active:scale-90"
          title="Potwierdź"
        >
          <Check className="h-3.5 w-3.5" />
        </button>
      </div>
    );
  }

  if (cartLine) {
    return (
      <button
        type="button"
        onClick={startEditing}
        className="flex w-full items-center justify-center gap-1.5 rounded-xl bg-emerald-50 px-2.5 py-2 text-[10px] font-extrabold text-emerald-700 shadow-sm transition-all hover:bg-emerald-100/60 active:scale-[0.98] dark:bg-emerald-950/20 dark:text-emerald-400 dark:hover:bg-emerald-950/40"
      >
        <Check className="h-3.5 w-3.5" />
        <span className="truncate">{activePacks} op. ({cartLine.requestedQty} {product.unit})</span>
      </button>
    );
  }

  return (
    <button type="button" onClick={startEditing} className={cn("flex w-full items-center justify-center gap-1.5 rounded-xl px-2.5 py-2 text-[10px] font-extrabold text-white shadow-sm transition-all hover:shadow-md active:scale-[0.98]", accentClass)}>
      <ShoppingCart className="h-3.5 w-3.5" />
      Kup
    </button>
  );
}

function PartnerProductCard(props: {
  product: VmiPortalInventoryItemDto;
  cartLine?: CartLine;
  hidePrices: boolean;
  accentClass: string;
  addToCart: (product: VmiPortalInventoryItemDto, qty: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
}) {
  const { product } = props;
  return (
    <div className="flex flex-col justify-between rounded-xl bg-white p-3 text-xs shadow-sm transition-all dark:bg-[#131A2E]">
      <div>
        <div className="relative aspect-[4/3] w-full overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/40">
          <Image src={product.imageUrl} alt={product.productName} fill sizes="220px" className="object-cover" unoptimized />
        </div>
        <div className="mt-2.5 space-y-1">
          <h3 className="line-clamp-1 text-[11px] font-extrabold leading-tight text-[#1A1C1E] dark:text-white">{product.productName}</h3>
          <p className="font-mono text-[9px] text-gray-400 dark:text-gray-500">SKU: {product.vendorSku}</p>
          <SmallRow label="W magazynie:" value={`${product.warehouseQty} szt.`} tone={product.warehouseQty <= 15 ? "amber" : "emerald"} />
          <SmallRow label="Opakowanie:" value={`1 paczka = ${product.packSize} ${product.unit}`} tone="blue" />
        </div>
      </div>
      <div className="mt-3 space-y-2 pt-2.5">
        {!props.hidePrices ? (
          <div className="flex items-baseline justify-between font-mono">
            <span className="text-[9px] text-gray-400">Netto:</span>
            <span className="text-xs font-black text-[#1A1C1E] dark:text-white">{(product.promoPrice ?? product.price).toFixed(2)} zł</span>
          </div>
        ) : null}
        <ProductCartControl {...props} />
      </div>
    </div>
  );
}

function PartnerProductRow(props: {
  product: VmiPortalInventoryItemDto;
  cartLine?: CartLine;
  hidePrices: boolean;
  accentClass: string;
  compact: boolean;
  addToCart: (product: VmiPortalInventoryItemDto, qty: number) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
}) {
  const { product } = props;
  return (
    <div className="flex flex-col justify-between gap-3 p-3 text-xs transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/30 sm:flex-row sm:items-center">
      <div className="flex min-w-0 flex-1 items-center gap-3">
        <div className="relative h-12 w-12 shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-850">
          <Image src={product.imageUrl} alt={product.productName} fill sizes="48px" className="object-cover" unoptimized />
        </div>
        <div className="min-w-0 flex-1">
          <span className="mb-0.5 inline-block rounded bg-[#F0F2F5] px-1.5 py-0.5 font-mono text-[8px] font-bold uppercase tracking-widest text-gray-500 dark:bg-gray-800 dark:text-gray-400">{product.category}</span>
          <h3 className="truncate font-extrabold leading-tight text-[#1A1C1E] dark:text-white">{product.productName}</h3>
          <p className="font-mono text-[10px] text-gray-400">SKU: {product.vendorSku} • 1 paczka = {product.packSize} {product.unit} • Magazyn: {product.warehouseQty} szt.</p>
        </div>
      </div>
      {!props.hidePrices ? <div className="font-mono text-sm font-black text-gray-900 dark:text-white">{(product.promoPrice ?? product.price).toFixed(2)} zł</div> : null}
      <div className="w-full shrink-0 sm:w-44">
        <ProductCartControl {...props} />
      </div>
    </div>
  );
}

function PromotionsTab({
  vendor,
  activeAnnouncement,
  onSelect,
  onAsk,
}: {
  vendor: VmiPortalVendorDto;
  activeAnnouncement?: VmiPortalVendorDto["announcements"][number];
  onSelect: (id: string) => void;
  onAsk: () => void;
}) {
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="space-y-2 lg:col-span-4">
        <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1C1E] dark:text-white">Gazetki i kampanie rabatowe</h2>
        {vendor.announcements.map((item) => (
          <button key={item.id} type="button" onClick={() => onSelect(item.id)} className={cn("w-full rounded-xl p-4 text-left shadow-sm", activeAnnouncement?.id === item.id ? "bg-white dark:bg-[#131A2E]" : "bg-gray-50 dark:bg-gray-900/40")}>
            <p className="font-mono text-[9px] font-black uppercase tracking-wider text-blue-600 dark:text-blue-400">{item.badgeText}</p>
            <h3 className="mt-1 line-clamp-2 font-bold text-gray-950 dark:text-white">{item.title}</h3>
          </button>
        ))}
      </div>
      <div className="space-y-4 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#131A2E] lg:col-span-8">
        {activeAnnouncement ? (
          <>
            <p className="font-mono text-[10px] font-black uppercase tracking-widest text-blue-600 dark:text-blue-400">{activeAnnouncement.badgeText}</p>
            <h2 className="text-xl font-black text-gray-950 dark:text-white">{activeAnnouncement.title}</h2>
            <p className="text-sm leading-relaxed text-gray-600 dark:text-gray-300">{activeAnnouncement.content}</p>
            <button type="button" onClick={onAsk} className="inline-flex items-center gap-2 rounded-xl bg-blue-600 px-4 py-2 text-xs font-extrabold text-white hover:bg-blue-550">
              <MessageSquare className="h-4 w-4" />
              Wyślij zapytanie
            </button>
          </>
        ) : <p className="text-gray-400">Brak aktywnych kampanii.</p>}
      </div>
    </div>
  );
}

function QuotationsTab({ proposals, products, onOpenCatalog }: { proposals: VmiPortalProposalDto[]; products: VmiPortalInventoryItemDto[]; onOpenCatalog: () => void }) {
  if (proposals.length === 0) {
    return <div className="rounded-xl bg-white p-8 text-center text-gray-500 shadow-sm dark:bg-[#131A2E]">Brak przypisanych ofert cenowych dla tego dostawcy.</div>;
  }
  return (
    <div className="space-y-4 text-xs">
      <h2 className="text-sm font-bold uppercase tracking-wider text-[#1A1C1E] dark:text-white">Specjalne oferty cenowe (B2B)</h2>
      {proposals.map((proposal) => (
        <div key={proposal.id} className="rounded-xl bg-white p-4 shadow-sm dark:bg-[#131A2E]">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div>
              <p className="font-mono text-xs font-bold text-[#1A1C1E] dark:text-white">{proposal.proposalNumber}</p>
              <p className="mt-1 text-[10px] text-gray-500">Oferta ważna do: <strong>{proposal.expiryDate}</strong></p>
            </div>
            <div className="text-right">
              <p className="font-mono text-sm font-black text-[#1A1C1E] dark:text-white">{proposal.totalValue.toFixed(2)} zł</p>
              <button type="button" onClick={onOpenCatalog} className="text-[10px] font-bold text-blue-700 hover:underline dark:text-blue-400">Otwórz katalog</button>
            </div>
          </div>
          <div className="mt-3 grid gap-2">
            {proposal.lines.map((line) => {
              const product = products.find((item) => item.id === line.inventoryItemId);
              return (
                <div key={line.inventoryItemId} className="flex items-center justify-between rounded-lg bg-gray-50 p-2 dark:bg-gray-900/40">
                  <span className="font-bold text-gray-900 dark:text-white">{product?.productName ?? "Produkt"}</span>
                  <span className="font-mono text-[10px] text-gray-500">{line.qty} szt. • {line.offeredPrice.toFixed(2)} zł</span>
                </div>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

function CartTab(props: {
  cartProducts: Array<{ line: CartLine; product: VmiPortalInventoryItemDto }>;
  cartTotal: number;
  locations: VmiPortalLocationDto[];
  deliveryLocationId: string;
  setDeliveryLocationId: (id: string) => void;
  deliveryDate: string;
  setDeliveryDate: (date: string) => void;
  poReference: string;
  setPoReference: (value: string) => void;
  comments: string;
  setComments: (value: string) => void;
  checkoutMessage: string | null;
  isPending: boolean;
  checkout: (event: React.FormEvent) => void;
  updateCartQty: (productId: string, qty: number) => void;
  removeFromCart: (productId: string) => void;
  onOpenCatalog: () => void;
  accentClass: string;
}) {
  if (props.cartProducts.length === 0) {
    return (
      <div className="rounded-2xl bg-white p-10 text-center shadow-sm dark:bg-[#131A2E]">
        <ShoppingCart className="mx-auto h-10 w-10 text-gray-300" />
        <h2 className="mt-3 text-sm font-black text-gray-950 dark:text-white">Koszyk jest pusty</h2>
        {props.checkoutMessage ? (
          <p className="mx-auto mt-3 max-w-md rounded-xl bg-emerald-50 p-3 text-[11px] font-bold text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-300">
            {props.checkoutMessage}
          </p>
        ) : null}
        <button type="button" onClick={props.onOpenCatalog} className={cn("mt-4 rounded-xl px-4 py-2 text-xs font-black text-white", props.accentClass)}>Przejdź do katalogu</button>
      </div>
    );
  }
  return (
    <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
      <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-[#131A2E] lg:col-span-7">
        <div className="flex items-center justify-between bg-[#F8F9FA] px-4 py-3 dark:bg-gray-900/40">
          <span className="text-xs font-bold uppercase tracking-wider text-[#1A1C1E] dark:text-white">
            Pozycje w koszyku ({props.cartProducts.length})
          </span>
          <span className="text-[10px] text-gray-500">Szkic zamówienia do partnera</span>
        </div>
        <div className="divide-y divide-gray-100 dark:divide-gray-850">
        {props.cartProducts.map(({ line, product }) => (
          <div key={line.inventoryItemId} className="space-y-3 p-3.5">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h3 className="truncate font-bold text-gray-950 dark:text-white">{product.productName}</h3>
                <p className="font-mono text-[10px] text-gray-400">
                  SKU: {product.vendorSku} • Paczka: {product.packSize} {product.unit}
                </p>
              </div>
              <button type="button" onClick={() => props.removeFromCart(product.id)} className="rounded bg-gray-100 p-1.5 text-gray-400 transition hover:bg-red-50 hover:text-red-700 dark:bg-gray-800 dark:hover:bg-red-950/20">
                <Trash2 className="h-3.5 w-3.5" />
              </button>
            </div>

            {line.requestedQty % product.packSize !== 0 ? (
              <div className="flex items-center gap-1.5 rounded-lg bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-850 dark:bg-amber-950/20 dark:text-amber-300">
                <Info className="h-3.5 w-3.5 shrink-0 text-amber-600" />
                <span>
                  Ilość {line.requestedQty} nie jest wielokrotnością paczki zbiorczej ({product.packSize}). Skoryguj ilość.
                </span>
              </div>
            ) : null}

            <div className="flex items-center justify-between gap-2">
              <div className="flex items-center gap-1">
                <button type="button" onClick={() => props.updateCartQty(product.id, line.requestedQty - product.packSize)} className="flex h-7 w-7 items-center justify-center rounded bg-gray-100 text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300"><Minus className="h-3.5 w-3.5" /></button>
                <input
                  type="number"
                  min={1}
                  value={line.requestedQty}
                  onChange={(event) => props.updateCartQty(product.id, Number(event.target.value))}
                  className="h-7 w-16 rounded bg-white text-center font-mono text-xs font-bold text-[#1A1C1E] outline-none ring-1 ring-gray-150 dark:bg-gray-950 dark:text-white dark:ring-gray-800"
                  aria-label={`Ilość ${product.productName}`}
                />
                <button type="button" onClick={() => props.updateCartQty(product.id, line.requestedQty + product.packSize)} className="flex h-7 w-7 items-center justify-center rounded bg-[#2A3B4C] text-white hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500"><Plus className="h-3.5 w-3.5" /></button>
                <span className="pl-1 font-mono text-[10px] uppercase text-gray-400">{product.unit}</span>
              </div>
              <p className="font-mono font-semibold text-[#1A1C1E] dark:text-white">{lineTotal(product, line.requestedQty).toFixed(2)} zł</p>
            </div>
          </div>
        ))}
        </div>
        <div className="flex items-center justify-between bg-[#F8F9FA] p-4 dark:bg-gray-900/40">
          <span className="font-semibold text-gray-500">Wartość netto:</span>
          <div className="text-right">
            <p className="font-mono text-base font-black text-[#1A1C1E] dark:text-white">{props.cartTotal.toFixed(2)} zł</p>
            <p className="text-[10px] text-gray-400">+23% VAT: {(props.cartTotal * 1.23).toFixed(2)} zł</p>
          </div>
        </div>
      </div>
      <form onSubmit={props.checkout} className="space-y-3 rounded-2xl bg-[#1A2536] p-5 text-white shadow-sm lg:col-span-5">
        <h2 className="text-sm font-black uppercase tracking-wider">Podsumowanie zamówienia B2B</h2>
        <p className="font-mono text-2xl font-black">{props.cartTotal.toFixed(2)} zł</p>
        <Field label="Miejsce rozładunku">
          <select value={props.deliveryLocationId} onChange={(event) => props.setDeliveryLocationId(event.target.value)} className="w-full rounded-lg bg-white px-2.5 py-2 text-xs text-gray-900">
            {props.locations.map((location) => <option key={location.id} value={location.id}>{location.name}</option>)}
          </select>
        </Field>
        <Field label="Wnioskowana data dostawy">
          <input type="date" value={props.deliveryDate} onChange={(event) => props.setDeliveryDate(event.target.value)} className="w-full rounded-lg bg-white px-2.5 py-2 font-mono text-xs text-gray-900" />
        </Field>
        <Field label="Indeks referencyjny PO">
          <input value={props.poReference} onChange={(event) => props.setPoReference(event.target.value)} placeholder="np. PO-2026-95" className="w-full rounded-lg bg-white px-2.5 py-2 text-xs text-gray-900" />
        </Field>
        <Field label="Dodatkowe uwagi do dostawy">
          <textarea value={props.comments} onChange={(event) => props.setComments(event.target.value)} placeholder="Np. dostawa tylko w godz. 8:00 - 14:00" className="min-h-14 w-full rounded-lg bg-white px-2.5 py-2 text-xs text-gray-900" />
        </Field>
        {props.checkoutMessage ? <p className="rounded-lg bg-white/10 p-2 text-[10px] font-bold">{props.checkoutMessage}</p> : null}
        <button type="submit" disabled={props.isPending} className={cn("w-full rounded-xl py-3 text-xs font-bold text-white disabled:opacity-50", props.accentClass)}>
          {props.isPending ? "Wysyłanie..." : "Prześlij zamówienie B2B do VMI"}
        </button>
      </form>
    </div>
  );
}

function ContactTab({ vendor }: { vendor: VmiPortalVendorDto }) {
  return (
    <div className="grid grid-cols-1 gap-6 text-xs lg:grid-cols-12">
      <div className="space-y-4 lg:col-span-4">
        <div className="space-y-4 rounded-2xl bg-white p-5 shadow-sm dark:bg-[#131A2E]">
          <h2 className="text-sm font-extrabold uppercase tracking-wider text-gray-900 dark:text-white">Kontakt i Wsparcie</h2>
          <p className="text-[11px] leading-relaxed text-gray-500">Skontaktuj się bezpośrednio z opiekunami handlowymi i wsparciem technicznym przypisanym do Twojego oddziału.</p>
          {vendor.contacts.map((contact) => (
            <div key={contact.email} className="space-y-3 rounded-xl bg-gray-50 p-4 dark:bg-gray-900">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className={cn("h-2.5 w-2.5 rounded-full", contact.status === "online" ? "bg-emerald-500 animate-pulse" : contact.status === "busy" ? "bg-amber-500" : "bg-gray-400")} />
                  <div>
                    <h3 className="text-xs font-black text-gray-950 dark:text-white">{contact.name}</h3>
                    <p className="font-mono text-[9px] text-gray-400">{contact.role}</p>
                  </div>
                </div>
              </div>
              <ContactLine icon={Phone} label="Telefon" value={contact.phone} href={`tel:${contact.phone}`} />
              <ContactLine icon={Mail} label="Email" value={contact.email} href={`mailto:${contact.email}`} />
            </div>
          ))}
        </div>
      </div>
      <div className="space-y-6 rounded-2xl bg-white p-6 shadow-sm dark:bg-[#131A2E] lg:col-span-8">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-black tracking-tight text-gray-950 dark:text-white">{vendor.name}</h2>
          <span className="rounded-lg bg-blue-50 px-2.5 py-1 text-[10px] font-bold text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">Partner od {vendor.portfolio.since}</span>
        </div>
        <p className="text-xs leading-relaxed text-gray-650 dark:text-gray-300">{vendor.portfolio.about}</p>
        <TagGroup title="Specjalizacje i Linie Produktowe" items={vendor.portfolio.specialties} tone="indigo" />
        <TagGroup title="Certyfikaty i Standardy" items={vendor.portfolio.certifications} tone="emerald" />
      </div>
    </div>
  );
}

function ContactLine({ icon: Icon, label, value, href }: { icon: typeof Phone; label: string; value: string; href: string }) {
  return (
    <div className="flex items-center gap-3">
      <div className="rounded-lg bg-[#F0F2F5] p-2 text-[#2A3B4C] dark:bg-gray-800 dark:text-blue-400">
        <Icon className="h-4 w-4" />
      </div>
      <div>
        <p className="text-[10px] text-gray-500 dark:text-gray-400">{label}</p>
        <a href={href} className="break-all font-mono font-bold text-gray-700 hover:underline dark:text-gray-300">{value}</a>
      </div>
    </div>
  );
}

function TagGroup({ title, items, tone }: { title: string; items: string[]; tone: "indigo" | "emerald" }) {
  return (
    <div className="space-y-2">
      <h3 className="font-mono text-[10px] font-extrabold uppercase tracking-wider text-gray-400">{title}</h3>
      <div className="flex flex-wrap gap-1.5">
        {items.map((item) => (
          <span key={item} className={cn("rounded-lg px-2 py-1 text-[10px] font-bold", tone === "indigo" ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/20 dark:text-indigo-400" : "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400")}>{item}</span>
        ))}
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-xl bg-[#F8F9FA] p-4 dark:bg-gray-800/40">
      <span className="block text-gray-500 dark:text-gray-400">{label}</span>
      <span className="font-mono text-2xl font-bold text-[#2A3B4C] dark:text-blue-400">{value}</span>
    </div>
  );
}

function SmallRow({ label, value, tone }: { label: string; value: string; tone: "amber" | "emerald" | "blue" }) {
  return (
    <div className="mt-1 flex items-center justify-between pt-1 text-[9px] text-gray-400">
      <span>{label}</span>
      <span className={cn("font-mono font-extrabold", tone === "amber" && "text-amber-600 dark:text-amber-400", tone === "emerald" && "text-emerald-600 dark:text-emerald-400", tone === "blue" && "text-blue-600 dark:text-blue-400")}>{value}</span>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block space-y-1">
      <span className="text-[10px] font-bold uppercase tracking-wide text-gray-300">{label}</span>
      {children}
    </label>
  );
}
