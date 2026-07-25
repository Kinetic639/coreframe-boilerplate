"use client";

import * as React from "react";
import Image from "next/image";
import {
  AlertTriangle,
  CheckCircle,
  Info,
  LayoutGrid,
  List,
  Plus,
  Search,
  Settings,
  ShoppingBag,
  Table,
  X,
} from "lucide-react";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalLocationDto,
  VmiPortalOrderDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { useCreateVmiOrder } from "@/lib/vmi-portal/hooks";
import { cn } from "@/utils/cn";

type ViewMode = "table" | "tile" | "list";
type QuickFilter = "all" | "ordered-past" | "low-stock" | "incoming";

interface InventoryExperienceProps {
  inventory: VmiPortalInventoryItemDto[];
  vendors: VmiPortalVendorDto[];
  locations: VmiPortalLocationDto[];
  activeLocationId: string;
  orders: VmiPortalOrderDto[];
}

function getStatusLabel(status: VmiPortalInventoryItemDto["status"]) {
  switch (status) {
    case "Healthy":
      return {
        text: "Prawidłowy",
        color: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
      };
    case "Approaching minimum":
      return {
        text: "Blisko minimum",
        color: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400",
      };
    case "Below minimum":
      return {
        text: "Poniżej minimum",
        color: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400 animate-pulse",
      };
    case "Out of stock":
      return {
        text: "Brak zapasu",
        color: "bg-red-50 dark:bg-red-500/10 text-red-600 dark:text-red-400 animate-pulse",
      };
    case "Overstocked":
      return {
        text: "Nadstan",
        color: "bg-purple-50 dark:bg-purple-500/10 text-purple-600 dark:text-purple-400",
      };
    case "Count outdated":
      return {
        text: "Przedawniony",
        color: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-300",
      };
    case "Needs verification":
      return {
        text: "Weryfikacja",
        color: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400",
      };
  }
}

function formatPrice(value: number) {
  return `${value.toFixed(2)} zł`;
}

export function InventoryExperience({
  inventory,
  vendors,
  locations,
  activeLocationId,
  orders,
}: InventoryExperienceProps) {
  const [searchQuery, setSearchQuery] = React.useState("");
  const [selectedVendorId, setSelectedVendorId] = React.useState("all");
  const [selectedStatus, setSelectedStatus] = React.useState("all");
  const [selectedCategory, setSelectedCategory] = React.useState("all");
  const [viewMode, setViewMode] = React.useState<ViewMode>("table");
  const [hidePrices, setHidePrices] = React.useState(false);
  const [isSettingsOpen, setIsSettingsOpen] = React.useState(false);
  const [activeQuickFilter, setActiveQuickFilter] = React.useState<QuickFilter>("all");
  const [orderMessage, setOrderMessage] = React.useState<{
    tone: "success" | "error";
    text: string;
  } | null>(null);
  const { createOrder, isPending: isCreatingOrder } = useCreateVmiOrder();

  const activeLocationName =
    locations.find((location) => location.id === activeLocationId)?.name ?? "Wybrany Oddział";

  const orderedProductIds = React.useMemo(() => {
    const ids = new Set<string>();
    for (const order of orders) {
      for (const line of order.lines) ids.add(line.inventoryItemId);
    }
    return ids;
  }, [orders]);

  const categories = React.useMemo(
    () => Array.from(new Set(inventory.map((item) => item.category))).sort(),
    [inventory],
  );

  const locationInventory = inventory.filter((item) => item.locationId === activeLocationId);

  const filteredInventory = locationInventory.filter((item) => {
    if (activeQuickFilter === "ordered-past" && !orderedProductIds.has(item.id)) return false;
    if (activeQuickFilter === "low-stock" && !["Below minimum", "Out of stock"].includes(item.status)) {
      return false;
    }
    if (activeQuickFilter === "incoming" && item.incomingQty <= 0) return false;

    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      const matchesName = item.productName.toLowerCase().includes(query);
      const matchesSku =
        item.vendorSku.toLowerCase().includes(query) || item.clientSku.toLowerCase().includes(query);
      if (!matchesName && !matchesSku) return false;
    }

    if (selectedVendorId !== "all" && item.vendorId !== selectedVendorId) return false;
    if (selectedStatus !== "all" && item.status !== selectedStatus) return false;
    if (selectedCategory !== "all" && item.category !== selectedCategory) return false;

    return true;
  });

  const getVendor = (vendorId: string) => vendors.find((vendor) => vendor.id === vendorId);

  const clearQuickFilter = () => setActiveQuickFilter("all");

  const createQuickOrder = async (item: VmiPortalInventoryItemDto) => {
    setOrderMessage(null);
    const payload = await createOrder({
      locationId: activeLocationId,
      lines: [{ inventoryItemId: item.id, requestedQty: item.packSize }],
      notes: `Szybkie zamówienie z katalogu VMI: ${item.productName}`,
    });
    if (payload.success) {
      setOrderMessage({
        tone: "success",
        text: `Utworzono zamówienie ${payload.data.orderNumber} dla ${item.productName}.`,
      });
      return;
    }
    setOrderMessage({ tone: "error", text: payload.error });
  };

  return (
    <section className="space-y-4">
      <div className="flex flex-col justify-between gap-3 pb-3 md:flex-row md:items-center">
        <div>
          <h1 className="font-display text-base font-bold text-gray-950 dark:text-white">
            Zarządzanie zapasami VMI
          </h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">
            Oddział:{" "}
            <span className="font-semibold text-blue-600 dark:text-blue-400">{activeLocationName}</span>
          </p>
        </div>

        <div className="flex items-center gap-2.5 self-end md:self-auto">
          <div className="flex items-center rounded-xl bg-gray-100 p-1 dark:bg-gray-800/80">
            {[
              { id: "table", title: "Widok tabeli standardowej", icon: Table },
              { id: "tile", title: "Kompaktowe kafelki (idealne na tablet)", icon: LayoutGrid },
              { id: "list", title: "Kompaktowa lista wierszy", icon: List },
            ].map((mode) => {
              const Icon = mode.icon;
              const isActive = viewMode === mode.id;

              return (
                <button
                  key={mode.id}
                  type="button"
                  onClick={() => setViewMode(mode.id as ViewMode)}
                  className={cn(
                    "flex cursor-pointer items-center justify-center rounded-lg p-2 transition-colors",
                    isActive
                      ? "bg-white font-bold text-gray-950 shadow-sm dark:bg-gray-700 dark:text-white"
                      : "text-gray-500 hover:text-gray-850 dark:text-gray-400 dark:hover:text-gray-200",
                  )}
                  title={mode.title}
                >
                  <Icon className="h-4 w-4" />
                </button>
              );
            })}
          </div>

          <div className="relative">
            <button
              type="button"
              onClick={() => setIsSettingsOpen((value) => !value)}
              className="flex cursor-pointer items-center gap-2 rounded-xl bg-white px-3.5 py-2 text-xs font-semibold text-gray-700 shadow-sm transition-all hover:bg-gray-50 dark:bg-[#131A2E] dark:text-gray-300 dark:hover:bg-gray-800"
            >
              <Settings className={cn("h-4 w-4 text-gray-500", isSettingsOpen && "animate-spin-slow")} />
              Opcje katalogu
            </button>

            {isSettingsOpen ? (
              <>
                <button
                  type="button"
                  className="fixed inset-0 z-10 cursor-default"
                  onClick={() => setIsSettingsOpen(false)}
                  aria-label="Zamknij opcje katalogu"
                />
                <div className="absolute right-0 z-20 mt-2 w-64 animate-fade-in space-y-3 rounded-xl bg-white p-3.5 text-xs text-[#1A1C1E] shadow-lg dark:bg-[#131A2E] dark:text-white">
                  <div className="pb-1.5 text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
                    Konfiguracja katalogu
                  </div>

                  <label className="flex cursor-pointer select-none items-center gap-2.5 py-1 hover:text-blue-600 dark:hover:text-blue-400">
                    <input
                      type="checkbox"
                      checked={hidePrices}
                      onChange={(event) => setHidePrices(event.target.checked)}
                      className="h-4 w-4 cursor-pointer rounded text-blue-600 focus:ring-blue-500"
                    />
                    <span className="flex flex-col">
                      <span className="font-bold">Ukryj ceny towarów</span>
                      <span className="text-[10px] text-gray-500">Testuj tryb bez cennika</span>
                    </span>
                  </label>

                  <div className="rounded-lg bg-gray-50 p-2 text-[10px] leading-relaxed text-gray-400 dark:bg-[#0E1321] dark:text-gray-500">
                    Włącz ten parametr, aby zasymulować wizytę handlowca na tablecie u klienta
                    końcowego, chroniąc marżę hurtową przed wzrokiem osób trzecich.
                  </div>
                </div>
              </>
            ) : null}
          </div>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-1.5 rounded-xl bg-gray-50 p-2 text-xs shadow-sm dark:bg-gray-900/20">
        <span className="px-2 text-[10px] font-bold uppercase tracking-wide text-gray-400 dark:text-gray-500">
          Szybkie filtry:
        </span>
        <QuickFilterButton
          active={activeQuickFilter === "all"}
          onClick={() => setActiveQuickFilter("all")}
          label={`Wszystkie asortymenty (${locationInventory.length})`}
        />
        <QuickFilterButton
          active={activeQuickFilter === "ordered-past"}
          onClick={() => setActiveQuickFilter("ordered-past")}
          label={`Zamawiane w przeszłości (${orderedProductIds.size})`}
          icon={ShoppingBag}
        />
        <QuickFilterButton
          active={activeQuickFilter === "low-stock"}
          onClick={() => setActiveQuickFilter("low-stock")}
          label={`Niskie stany zapasów (${locationInventory.filter((item) => ["Below minimum", "Out of stock"].includes(item.status)).length})`}
          icon={AlertTriangle}
          tone="red"
        />
        <QuickFilterButton
          active={activeQuickFilter === "incoming"}
          onClick={() => setActiveQuickFilter("incoming")}
          label={`W drodze / Zamówione (${locationInventory.filter((item) => item.incomingQty > 0).length})`}
          icon={CheckCircle}
          tone="emerald"
        />
      </div>

      <div className="space-y-3 rounded-xl bg-white p-4 shadow-sm dark:bg-[#0E1321]">
        <div className="relative">
          <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3 text-gray-400 dark:text-gray-500">
            <Search className="h-4 w-4" />
          </span>
          <input
            type="text"
            placeholder="Szukaj po nazwie produktu, SKU dostawcy lub indeksie klienta..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-xl bg-gray-50 py-2 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-[#0C101A] dark:text-white dark:placeholder:text-gray-500"
          />
        </div>

        <div className="grid grid-cols-1 gap-2 text-xs sm:grid-cols-3">
          <SelectField label="Dostawca" value={selectedVendorId} onChange={setSelectedVendorId}>
            <option value="all">Wszyscy dostawcy</option>
            {vendors.map((vendor) => (
              <option key={vendor.id} value={vendor.id}>
                {vendor.name}
              </option>
            ))}
          </SelectField>

          <SelectField label="Status zapasu" value={selectedStatus} onChange={setSelectedStatus}>
            <option value="all">Wszystkie statusy</option>
            <option value="Healthy">Prawidłowy (Healthy)</option>
            <option value="Approaching minimum">Blisko minimum</option>
            <option value="Below minimum">Poniżej minimum (Pilne!)</option>
            <option value="Out of stock">Brak zapasu (Wyprzedany)</option>
            <option value="Overstocked">Nadstan (Przepełnienie)</option>
            <option value="Count outdated">Wymaga przeliczenia</option>
            <option value="Needs verification">Do weryfikacji</option>
          </SelectField>

          <SelectField label="Kategoria" value={selectedCategory} onChange={setSelectedCategory}>
            <option value="all">Wszystkie kategorie</option>
            {categories.map((category) => (
              <option key={category} value={category}>
                {category}
              </option>
            ))}
          </SelectField>
        </div>
      </div>

      <div className="flex items-center justify-between px-1 text-xs font-semibold text-gray-500 dark:text-gray-400">
        <span>Filtrowane wyniki: {filteredInventory.length} pozycji</span>
        {activeQuickFilter !== "all" ? (
          <button
            type="button"
            onClick={clearQuickFilter}
            className="flex cursor-pointer items-center gap-1 font-bold text-blue-600 hover:underline dark:text-blue-400"
          >
            Wyczyść szybki filtr
            <X className="h-3.5 w-3.5" />
          </button>
        ) : null}
      </div>

      {orderMessage ? (
        <div
          className={cn(
            "rounded-xl p-3 text-xs font-semibold",
            orderMessage.tone === "success"
              ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
              : "bg-red-50 text-red-700 dark:bg-red-950/20 dark:text-red-400",
          )}
        >
          {orderMessage.text}
        </div>
      ) : null}

      {viewMode === "table" ? (
        <TableView
          items={filteredInventory}
          getVendor={getVendor}
          hidePrices={hidePrices}
          onCreateOrder={createQuickOrder}
          isCreatingOrder={isCreatingOrder}
        />
      ) : null}

      {viewMode === "tile" ? (
        <TileView
          items={filteredInventory}
          getVendor={getVendor}
          hidePrices={hidePrices}
          onCreateOrder={createQuickOrder}
          isCreatingOrder={isCreatingOrder}
        />
      ) : null}

      {viewMode === "list" ? (
        <ListView
          items={filteredInventory}
          getVendor={getVendor}
          hidePrices={hidePrices}
          onCreateOrder={createQuickOrder}
          isCreatingOrder={isCreatingOrder}
        />
      ) : null}

      <div className="flex items-start gap-2.5 rounded-xl bg-blue-50/50 p-3 text-xs text-blue-800 dark:bg-blue-950/10 dark:text-blue-300">
        <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-600 dark:text-blue-400" />
        <p className="leading-relaxed">
          Wskazówka: System VMI stale monitoruje stany magazynowe w Twojej sieci i sugeruje
          optymalne dostawy. Kliknij{" "}
          <strong className="text-blue-700 dark:text-blue-400">&quot;Kup&quot;</strong> lub{" "}
          <strong className="text-blue-700 dark:text-blue-400">&quot;Zamów&quot;</strong>, aby
          ręcznie zasilić brakujące zapasy przed planowanym kursem dostawcy.
        </p>
      </div>
    </section>
  );
}

function QuickFilterButton({
  active,
  onClick,
  label,
  icon: Icon,
  tone = "default",
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  icon?: typeof ShoppingBag;
  tone?: "default" | "red" | "emerald";
}) {
  const activeClass =
    tone === "red" ? "bg-red-600 text-white" : tone === "emerald" ? "bg-emerald-600 text-white" : "bg-[#2A3B4C] dark:bg-blue-600 text-white";
  const idleClass =
    tone === "red"
      ? "bg-white dark:bg-[#131A2E] text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/20"
      : tone === "emerald"
        ? "bg-white dark:bg-[#131A2E] text-emerald-600 dark:text-emerald-400 hover:bg-emerald-50 dark:hover:bg-emerald-950/20"
        : "bg-white dark:bg-[#131A2E] text-gray-600 dark:text-gray-300 hover:bg-gray-100 dark:hover:bg-gray-800";

  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex cursor-pointer items-center gap-1.5 whitespace-nowrap rounded-lg px-3 py-1.5 font-semibold transition-all",
        active ? activeClass : idleClass,
      )}
    >
      {Icon ? <Icon className="h-3.5 w-3.5" /> : null}
      {label}
    </button>
  );
}

function SelectField({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: React.ReactNode;
}) {
  return (
    <div className="space-y-1">
      <label className="text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
        {label}
      </label>
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="w-full cursor-pointer rounded-lg bg-gray-50 px-2 py-1.5 text-xs text-gray-900 focus:outline-none dark:bg-[#0C101A] dark:text-white"
      >
        {children}
      </select>
    </div>
  );
}

function TableView({
  items,
  getVendor,
  hidePrices,
  onCreateOrder,
  isCreatingOrder,
}: {
  items: VmiPortalInventoryItemDto[];
  getVendor: (vendorId: string) => VmiPortalVendorDto | undefined;
  hidePrices: boolean;
  onCreateOrder: (item: VmiPortalInventoryItemDto) => void;
  isCreatingOrder: boolean;
}) {
  return (
    <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-[#0E1321]">
      <div className="hidden md:block">
        <table className="w-full border-collapse text-left text-xs">
          <thead>
            <tr className="bg-gray-50 font-bold text-gray-500 dark:bg-[#131A2E] dark:text-gray-400">
              <th className="p-3">Produkt / Dostawca</th>
              <th className="p-3">Kategoria</th>
              <th className="p-3 text-center">Bieżący stan</th>
              <th className="p-3 text-center">Próg Min / Cel</th>
              <th className="p-3 text-center">Status VMI</th>
              <th className="p-3 text-center">W drodze</th>
              {!hidePrices ? <th className="p-3 text-right">Cena netto</th> : null}
              <th className="p-3 text-right">Akcje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#E1E3E6] dark:divide-gray-800">
            {items.length === 0 ? (
              <tr>
                <td colSpan={hidePrices ? 7 : 8} className="p-8 text-center text-gray-500">
                  Brak produktów spełniających wybrane kryteria wyszukiwania.
                </td>
              </tr>
            ) : (
              items.map((item) => {
                const vendor = getVendor(item.vendorId);
                const status = getStatusLabel(item.status);

                return (
                  <tr key={item.id} className="transition-colors hover:bg-gray-50 dark:hover:bg-gray-900/20">
                    <td className="min-w-[200px] p-3">
                      <button className="cursor-pointer text-left font-bold text-gray-950 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                        {item.productName}
                      </button>
                      <div className="mt-1 flex flex-col gap-1">
                        <div className="flex items-center gap-2 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                          <span>SKU: {item.vendorSku}</span>
                          <span>•</span>
                          <span className="font-semibold text-gray-500 dark:text-gray-400">{vendor?.name}</span>
                        </div>
                        <div className="flex items-center gap-1.5 text-[10px] font-medium text-gray-500 dark:text-gray-400">
                          <span>Magazyn centralny:</span>
                          <span className="rounded bg-emerald-50 px-1.5 py-0.5 font-mono font-bold text-emerald-600 dark:bg-emerald-950/20 dark:text-emerald-400">
                            {item.warehouseQty} {item.unit}
                          </span>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-500 dark:text-gray-400">{item.category}</td>
                    <td className="p-3 text-center font-mono text-sm font-bold text-gray-950 dark:text-white">
                      {item.currentStock}{" "}
                      <span className="font-sans text-[10px] font-normal text-gray-400 dark:text-gray-500">
                        {item.unit}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-gray-500 dark:text-gray-400">
                      {item.minStock} / {item.targetStock}
                    </td>
                    <td className="p-3 text-center">
                      <span className={cn("rounded-full px-2 py-0.5 text-[10px] font-bold uppercase", status.color)}>
                        {status.text}
                      </span>
                    </td>
                    <td className="p-3 text-center font-mono text-gray-500 dark:text-gray-400">
                      {item.incomingQty > 0 ? (
                        <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                          +{item.incomingQty}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    {!hidePrices ? (
                      <td className="p-3 text-right font-mono font-bold text-gray-900 dark:text-white">
                        {formatPrice(item.promoPrice ?? item.price)}
                      </td>
                    ) : null}
                    <td className="space-x-1.5 p-3 text-right">
                      <button className="cursor-pointer rounded bg-gray-100 px-2.5 py-1 text-[10px] font-semibold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                        Przelicz
                      </button>
                      <button
                        type="button"
                        disabled={isCreatingOrder}
                        onClick={() => onCreateOrder(item)}
                        className="cursor-pointer rounded bg-[#2A3B4C] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                      >
                        Zamów (+{item.packSize})
                      </button>
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-2.5 bg-gray-50 p-3 dark:bg-gray-950/20 md:hidden">
        {items.length === 0 ? (
          <div className="py-6 text-center text-xs text-gray-500">Brak wyników.</div>
        ) : (
          items.map((item) => (
            <MobileInventoryCard
              key={item.id}
              item={item}
              vendor={getVendor(item.vendorId)}
              hidePrices={hidePrices}
              onCreateOrder={onCreateOrder}
              isCreatingOrder={isCreatingOrder}
            />
          ))
        )}
      </div>
    </div>
  );
}

function MobileInventoryCard({
  item,
  vendor,
  hidePrices,
  onCreateOrder,
  isCreatingOrder,
}: {
  item: VmiPortalInventoryItemDto;
  vendor?: VmiPortalVendorDto;
  hidePrices: boolean;
  onCreateOrder: (item: VmiPortalInventoryItemDto) => void;
  isCreatingOrder: boolean;
}) {
  const status = getStatusLabel(item.status);

  return (
    <div className="space-y-3.5 rounded-xl bg-white p-3.5 shadow-sm dark:bg-[#0E1321]">
      <div className="flex items-start justify-between gap-2.5">
        <div className="min-w-0">
          <button className="text-left text-xs font-bold leading-normal text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
            {item.productName}
          </button>
          <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-gray-500">
            SKU: {item.vendorSku} • {vendor?.name}
          </p>
        </div>
        <span className={cn("shrink-0 rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase", status.color)}>
          {status.text}
        </span>
      </div>

      <div className="grid grid-cols-3 gap-2 rounded-lg bg-gray-50 px-2 py-1.5 text-center text-[11px] dark:bg-gray-950/40">
        <Metric label="Stan obecny" value={`${item.currentStock} ${item.unit}`} />
        <Metric label="Magazyn centralny" value={String(item.warehouseQty)} tone="emerald" />
        <Metric label="Cel optymalny" value={String(item.targetStock)} />
      </div>

      {!hidePrices ? (
        <div className="flex items-center justify-between pt-2 font-mono text-xs text-gray-600 dark:text-gray-400">
          <span>Cena netto:</span>
          <span className="font-black text-gray-900 dark:text-white">{formatPrice(item.promoPrice ?? item.price)}</span>
        </div>
      ) : null}

      <div className="flex items-center justify-between pt-1">
        <span className="text-[10px] text-gray-400 dark:text-gray-500">
          {item.incomingQty > 0 ? (
            <span className="font-semibold text-emerald-600 dark:text-emerald-400">
              W drodze: +{item.incomingQty}
            </span>
          ) : (
            "Brak dostaw w toku"
          )}
        </span>
        <div className="flex gap-1.5">
          <button className="cursor-pointer rounded bg-gray-100 px-2.5 py-1 text-[10px] font-bold text-gray-700 transition-colors hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
            Przelicz
          </button>
          <button
            type="button"
            disabled={isCreatingOrder}
            onClick={() => onCreateOrder(item)}
            className="cursor-pointer rounded bg-[#2A3B4C] px-2.5 py-1 text-[10px] font-bold text-white transition-colors hover:bg-gray-800 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
          >
            + Zamów
          </button>
        </div>
      </div>
    </div>
  );
}

function Metric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "emerald" }) {
  return (
    <div>
      <span className="block text-[10px] text-gray-400 dark:text-gray-500">{label}</span>
      <span
        className={cn(
          "font-mono text-xs font-extrabold",
          tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-900 dark:text-white",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function TileView({
  items,
  getVendor,
  hidePrices,
  onCreateOrder,
  isCreatingOrder,
}: {
  items: VmiPortalInventoryItemDto[];
  getVendor: (vendorId: string) => VmiPortalVendorDto | undefined;
  hidePrices: boolean;
  onCreateOrder: (item: VmiPortalInventoryItemDto) => void;
  isCreatingOrder: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white py-12 text-center text-xs text-gray-500 shadow-sm dark:bg-[#0E1321]">
        Brak produktów pasujących do kryteriów wyszukiwania.
      </div>
    );
  }

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6">
      {items.map((item) => {
        const vendor = getVendor(item.vendorId);
        const status = getStatusLabel(item.status);

        return (
          <div
            key={item.id}
            className="group flex flex-col justify-between rounded-xl bg-white p-2.5 text-xs shadow-sm transition-all dark:bg-[#131A2E] dark:hover:border-gray-700"
          >
            <div className="space-y-2">
              <div className="relative aspect-[4/3] w-full shrink-0 overflow-hidden rounded-lg bg-gray-50 dark:bg-gray-800/40">
                <Image
                  src={item.imageUrl}
                  alt={item.productName}
                  fill
                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 25vw, 16vw"
                  className="object-cover transition-transform duration-300 group-hover:scale-105"
                />
                <span className={cn("absolute left-1 top-1 rounded px-1 py-0.5 text-[8px] font-black uppercase shadow-sm", status.color)}>
                  {status.text}
                </span>
              </div>

              <div className="space-y-0.5">
                <button className="line-clamp-2 cursor-pointer text-left text-xs font-bold leading-tight text-[#1A1C1E] transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                  {item.productName}
                </button>
                <div className="truncate font-mono text-[9px] text-gray-400 dark:text-gray-500">
                  {item.vendorSku} • {vendor?.name}
                </div>
              </div>
            </div>

            <div className="mt-2.5 space-y-1 pt-2">
              <SmallRow label="Magazyn centralny:" value={`${item.warehouseQty} ${item.unit}`} tone="emerald" />
              <SmallRow label="Twój stan zapasu:" value={`${item.currentStock}/${item.targetStock}`} />

              {!hidePrices ? (
                <div className="flex items-center justify-between pt-1">
                  <span className="text-[9px] text-gray-400">Netto:</span>
                  <span className="font-mono text-xs font-black text-[#2A3B4C] dark:text-blue-400">
                    {formatPrice(item.promoPrice ?? item.price)}
                  </span>
                </div>
              ) : null}

              <div className="flex gap-1 pt-2">
                <button className="flex-1 cursor-pointer rounded bg-gray-50 py-1 text-[9px] font-bold text-gray-600 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-750">
                  Spis
                </button>
                <button
                  type="button"
                  disabled={isCreatingOrder}
                  onClick={() => onCreateOrder(item)}
                  className="flex flex-[2] cursor-pointer items-center justify-center gap-0.5 rounded bg-[#2A3B4C] py-1 text-[9px] font-black text-white transition-all hover:bg-[#1E2B38] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
                >
                  <Plus className="h-3 w-3" />
                  Kup ({item.packSize})
                </button>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function SmallRow({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "emerald" }) {
  return (
    <div className="flex items-center justify-between text-[9px] text-gray-500 dark:text-gray-400">
      <span>{label}</span>
      <span
        className={cn(
          "font-mono font-bold",
          tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}

function ListView({
  items,
  getVendor,
  hidePrices,
  onCreateOrder,
  isCreatingOrder,
}: {
  items: VmiPortalInventoryItemDto[];
  getVendor: (vendorId: string) => VmiPortalVendorDto | undefined;
  hidePrices: boolean;
  onCreateOrder: (item: VmiPortalInventoryItemDto) => void;
  isCreatingOrder: boolean;
}) {
  if (items.length === 0) {
    return (
      <div className="rounded-xl bg-white py-8 text-center text-xs text-gray-500 shadow-sm dark:bg-[#0E1321]">
        Brak produktów pasujących do kryteriów wyszukiwania.
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2 rounded-xl bg-white p-2 shadow-sm dark:bg-[#0E1321]">
      {items.map((item) => {
        const vendor = getVendor(item.vendorId);
        const status = getStatusLabel(item.status);

        return (
          <div
            key={item.id}
            className="flex flex-col justify-between gap-3 rounded-lg bg-white p-2 text-xs transition-colors hover:bg-gray-50 dark:bg-[#131A2E] dark:hover:bg-gray-800/40 sm:flex-row sm:items-center"
          >
            <div className="flex min-w-0 flex-1 items-center gap-3">
              <Image
                src={item.imageUrl}
                alt={item.productName}
                width={44}
                height={44}
                className="h-11 w-11 shrink-0 rounded bg-gray-100 object-cover"
              />
              <div className="min-w-0">
                <button className="line-clamp-1 cursor-pointer text-left text-xs font-bold leading-snug text-gray-900 transition-colors hover:text-blue-600 dark:text-white dark:hover:text-blue-400">
                  {item.productName}
                </button>
                <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-[9px] text-gray-400">
                  <span>SKU: {item.vendorSku}</span>
                  <span>•</span>
                  <span>Kategoria: {item.category}</span>
                  <span>•</span>
                  <span className="font-semibold text-gray-500 dark:text-gray-400">{vendor?.name}</span>
                </div>
              </div>
            </div>

            <div className="flex shrink-0 flex-wrap items-center justify-between gap-4 py-1 sm:justify-end sm:gap-6 sm:py-0">
              <CompactStat label="Magazyn centralny" value={`${item.warehouseQty}`} tone="emerald" />
              <CompactStat label="Stan u Ciebie" value={`${item.currentStock} / ${item.targetStock}`} />
              <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase shadow-sm", status.color)}>
                {status.text}
              </span>
              {!hidePrices ? (
                <div className="min-w-[75px] text-right font-mono">
                  <span className="block text-[9px] text-gray-450">Netto</span>
                  <span className="text-xs font-black text-gray-950 dark:text-white">
                    {formatPrice(item.promoPrice ?? item.price)}
                  </span>
                </div>
              ) : null}
            </div>

            <div className="flex shrink-0 items-center justify-end gap-1.5">
              <button className="cursor-pointer rounded bg-gray-50 px-2.5 py-1 text-[10px] font-bold text-gray-700 transition-colors hover:bg-gray-100 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700">
                Przelicz
              </button>
              <button
                type="button"
                disabled={isCreatingOrder}
                onClick={() => onCreateOrder(item)}
                className="flex cursor-pointer items-center gap-1 rounded bg-[#2A3B4C] px-2.5 py-1 text-[10px] font-extrabold text-white transition-colors hover:bg-[#1E2B38] disabled:cursor-not-allowed disabled:opacity-50 dark:bg-blue-600 dark:hover:bg-blue-500"
              >
                <Plus className="h-3 w-3" />
                Kup (+{item.packSize})
              </button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

function CompactStat({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "emerald" }) {
  return (
    <div className="text-left font-sans">
      <span className="block text-[9px] text-gray-400 sm:text-right">{label}</span>
      <span
        className={cn(
          "flex items-center justify-end gap-1 font-mono font-bold",
          tone === "emerald" ? "text-emerald-600 dark:text-emerald-400" : "text-gray-700 dark:text-gray-300",
        )}
      >
        {value}
      </span>
    </div>
  );
}
