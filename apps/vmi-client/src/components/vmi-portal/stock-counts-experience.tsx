"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  ArrowRight,
  Barcode,
  Camera,
  CheckCircle,
  FileText,
  Minus,
  Plus,
  Save,
  Wifi,
  WifiOff,
} from "lucide-react";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalLocationDto,
  VmiPortalStockCountRequestDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface StockCountsExperienceProps {
  vendors: VmiPortalVendorDto[];
  locations: VmiPortalLocationDto[];
  inventory: VmiPortalInventoryItemDto[];
  requests: VmiPortalStockCountRequestDto[];
  activeLocationId: string;
}

type Step = 1 | 2 | 3 | 4;
type CountMode = "requested" | "low_stock" | "full_assortment";
type SessionItem = {
  inventoryItemId: string;
  countedQty: number | null;
  status: "not_counted" | "counted" | "zero_stock" | "unable_to_count" | "recount" | "note_added";
  note: string;
};

export function StockCountsExperience({
  vendors,
  locations,
  inventory,
  requests,
  activeLocationId,
}: StockCountsExperienceProps) {
  const [step, setStep] = React.useState<Step>(1);
  const [selectedVendorId, setSelectedVendorId] = React.useState("");
  const [selectedLocationId, setSelectedLocationId] = React.useState(activeLocationId);
  const [countingMode, setCountingMode] = React.useState<CountMode>("low_stock");
  const [isOnline, setIsOnline] = React.useState(true);
  const [currentIndex, setCurrentIndex] = React.useState(0);
  const [sessionItems, setSessionItems] = React.useState<SessionItem[]>([]);
  const [photoAdded, setPhotoAdded] = React.useState<Record<string, boolean>>({});
  const [message, setMessage] = React.useState("");

  const selectedVendor = vendors.find((vendor) => vendor.id === selectedVendorId);
  const selectedLocation = locations.find((location) => location.id === selectedLocationId);
  const countingProducts = sessionItems
    .map((item) => inventory.find((product) => product.id === item.inventoryItemId))
    .filter(Boolean) as VmiPortalInventoryItemDto[];
  const activeProduct = countingProducts[currentIndex];
  const activeSessionItem = activeProduct
    ? sessionItems.find((item) => item.inventoryItemId === activeProduct.id)
    : undefined;

  const startCounting = () => {
    const vendorItems = inventory.filter(
      (item) => item.vendorId === selectedVendorId && item.locationId === selectedLocationId,
    );
    const requestProductIds = new Set(
      requests
        .filter((request) => request.vendorId === selectedVendorId && request.locationId === selectedLocationId)
        .flatMap((request) => request.inventoryItemIds),
    );
    const products =
      countingMode === "requested"
        ? vendorItems.filter((item) => requestProductIds.has(item.id)).slice(0, 6)
        : countingMode === "low_stock"
          ? vendorItems.filter((item) => ["Below minimum", "Out of stock", "Approaching minimum", "Needs verification", "Count outdated"].includes(item.status))
          : vendorItems;
    const fallback = products.length > 0 ? products : vendorItems.slice(0, 4);
    const draft = readDraft(selectedVendorId, selectedLocationId, countingMode);
    setSessionItems(
      fallback.map((item) => {
        const existing = draft?.items.find((draftItem) => draftItem.inventoryItemId === item.id);
        return existing ?? { inventoryItemId: item.id, countedQty: null, status: "not_counted", note: "" };
      }),
    );
    setCurrentIndex(0);
    setStep(4);
  };

  const saveDraft = () => {
    window.localStorage.setItem(
      draftKey(selectedVendorId, selectedLocationId, countingMode),
      JSON.stringify({ vendorId: selectedVendorId, locationId: selectedLocationId, mode: countingMode, items: sessionItems, lastSaved: new Date().toISOString() }),
    );
    setMessage("Szkic inwentaryzacji zapisany lokalnie.");
    window.setTimeout(() => setMessage(""), 3000);
  };

  const updateActiveItem = (patch: Partial<SessionItem>) => {
    if (!activeProduct) return;
    setSessionItems((current) =>
      current.map((item) =>
        item.inventoryItemId === activeProduct.id ? { ...item, ...patch } : item,
      ),
    );
  };

  const updateQty = (value: number | null) => {
    updateActiveItem({
      countedQty: value === null ? null : Math.max(0, value),
      status: value === null ? "not_counted" : value === 0 ? "zero_stock" : "counted",
    });
  };

  const completeCount = () => {
    if (selectedVendorId) {
      window.localStorage.removeItem(draftKey(selectedVendorId, selectedLocationId, countingMode));
    }
    setMessage("Spis wysłany do dostawcy VMI.");
    setStep(1);
    setSelectedVendorId("");
    setSessionItems([]);
  };

  const countedCount = sessionItems.filter((item) => item.status !== "not_counted").length;

  return (
    <section className="min-h-[calc(100vh-9rem)] overflow-hidden rounded-2xl bg-white shadow-sm dark:bg-[#0E1321]">
      <header className="flex items-center justify-between gap-3 bg-white px-4 py-3 dark:bg-[#131A2E]">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => {
              if (step === 4) {
                saveDraft();
                setStep(3);
              } else if (step > 1) {
                setStep((step - 1) as Step);
              }
            }}
            className="rounded-lg bg-[#F0F2F5] p-1.5 text-gray-600 transition-colors hover:bg-gray-200 hover:text-[#2A3B4C] dark:bg-gray-800 dark:text-gray-400 dark:hover:bg-gray-700 dark:hover:text-white"
            aria-label="Wróć"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <div>
            <h1 className="font-display text-sm font-semibold tracking-wide text-[#2A3B4C] dark:text-white">
              Szybki Stan & Inwentaryzacja VMI
            </h1>
            {step === 4 && selectedVendor ? (
              <p className="text-xs text-gray-550 dark:text-gray-400">
                {selectedVendor.name} • {selectedLocation?.name}
              </p>
            ) : null}
          </div>
        </div>

        <div className="flex items-center gap-2">
          {step === 4 ? (
            <button
              type="button"
              onClick={saveDraft}
              className="hidden items-center gap-1.5 rounded-lg bg-white px-2.5 py-1 text-xs font-medium text-gray-700 hover:bg-gray-50 dark:bg-[#0E1321] dark:text-gray-300 dark:hover:bg-gray-800 sm:flex"
            >
              <Save className="h-3.5 w-3.5" />
              Zapisz szkic
            </button>
          ) : null}
          <button
            type="button"
            onClick={() => setIsOnline((value) => !value)}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold",
              isOnline
                ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                : "animate-pulse bg-amber-50 text-amber-700 dark:bg-amber-950/20 dark:text-amber-450",
            )}
          >
            {isOnline ? <Wifi className="h-3 w-3" /> : <WifiOff className="h-3 w-3" />}
            {isOnline ? "ONLINE" : "OFFLINE (SZKIC)"}
          </button>
        </div>
      </header>

      <div className="p-4 md:p-6">
        {message ? (
          <div className="mb-4 rounded-xl bg-blue-50 p-3 text-center text-xs font-medium text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
            {message}
          </div>
        ) : null}

        {step === 1 ? (
          <WizardStep eyebrow="Krok 1 z 3" title="Wybierz dostawcę asortymentu" description="Skanowanie i aktualizacja stanów magazynowych dotyczy zawsze konkretnego partnera handlowego.">
            {vendors.map((vendor) => (
              <button
                key={vendor.id}
                type="button"
                onClick={() => {
                  setSelectedVendorId(vendor.id);
                  setStep(2);
                }}
                className="flex w-full items-center justify-between rounded-xl bg-white p-4 text-left shadow-sm transition-all hover:scale-[1.01] hover:bg-gray-50 dark:bg-[#0E1321]/50 dark:hover:bg-gray-800/10"
              >
                <div>
                  <h2 className="text-base font-bold text-[#1A1C1E] dark:text-white">{vendor.name}</h2>
                  <p className="mt-0.5 text-xs text-gray-500 dark:text-gray-400">{vendor.industry}</p>
                </div>
                <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 dark:bg-gray-800">
                  <ArrowRight className="h-4 w-4 text-gray-500 dark:text-gray-400" />
                </div>
              </button>
            ))}
          </WizardStep>
        ) : null}

        {step === 2 ? (
          <WizardStep eyebrow="Krok 2 z 3" title="Wybierz lokalizację warsztatu" description="Wskaż oddział, w którym fizycznie liczysz produkty.">
            {locations.map((location) => {
              const selected = selectedLocationId === location.id;
              return (
                <button
                  key={location.id}
                  type="button"
                  onClick={() => {
                    setSelectedLocationId(location.id);
                    setStep(3);
                  }}
                  className={cn(
                    "flex w-full items-start justify-between rounded-xl p-4 text-left transition-all",
                    selected
                      ? "bg-blue-50/50 dark:bg-blue-950/20"
                      : "bg-white shadow-sm hover:bg-gray-50/50 dark:bg-[#0E1321]/50 dark:hover:bg-gray-800/10",
                  )}
                >
                  <div>
                    <h2 className={cn("text-sm font-bold", selected ? "text-blue-600 dark:text-blue-400" : "text-[#1A1C1E] dark:text-white")}>{location.name}</h2>
                    <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{location.address}</p>
                  </div>
                  {selected ? <span className="mt-0.5 h-5 w-5 rounded-full bg-blue-500 ring-4 ring-blue-500/10" /> : null}
                </button>
              );
            })}
          </WizardStep>
        ) : null}

        {step === 3 ? (
          <WizardStep eyebrow="Krok 3 z 3" title="Wybierz zakres liczenia" description="Tryb można zmienić przed startem. Szkice są zapisywane lokalnie, tak jak w prototypie.">
            {[
              ["low_stock", "Niskie stany", "Policz tylko pozycje alarmowe i wymagające kontroli."],
              ["requested", "Zlecenia dostawców", "Policz produkty z aktywnych próśb o spis."],
              ["full_assortment", "Pełny asortyment", "Przejdź przez cały katalog dostawcy dla tej lokalizacji."],
            ].map(([value, title, description]) => (
              <button
                key={value}
                type="button"
                onClick={() => setCountingMode(value as CountMode)}
                className={cn(
                  "w-full rounded-xl p-4 text-left transition-all",
                  countingMode === value
                    ? "bg-blue-50 text-blue-700 ring-1 ring-blue-500/20 dark:bg-blue-950/20 dark:text-blue-300"
                    : "bg-white shadow-sm hover:bg-gray-50 dark:bg-[#0E1321]/50 dark:text-gray-300 dark:hover:bg-gray-800/10",
                )}
              >
                <h2 className="text-sm font-black">{title}</h2>
                <p className="mt-1 text-xs text-gray-500 dark:text-gray-400">{description}</p>
              </button>
            ))}
            <button
              type="button"
              onClick={startCounting}
              className="mt-2 flex w-full items-center justify-center gap-2 rounded-xl bg-[#2A3B4C] py-3 text-xs font-black uppercase tracking-wider text-white transition-colors hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              Rozpocznij liczenie
              <ArrowRight className="h-4 w-4" />
            </button>
          </WizardStep>
        ) : null}

        {step === 4 && activeProduct && activeSessionItem ? (
          <div className="grid grid-cols-1 gap-5 md:grid-cols-12">
            <aside className="space-y-3 md:col-span-4">
              <div className="flex items-center justify-between text-xs text-gray-500 dark:text-gray-400">
                <span>Postęp inwentaryzacji</span>
                <span className="font-mono font-bold text-blue-600 dark:text-blue-400">
                  {countedCount} / {sessionItems.length}
                </span>
              </div>
              <div className="max-h-[520px] space-y-2 overflow-y-auto pr-1">
                {countingProducts.map((product, index) => (
                  <button
                    key={product.id}
                    type="button"
                    onClick={() => setCurrentIndex(index)}
                    className={cn(
                      "flex w-full items-center justify-between gap-3 rounded-xl p-3 text-left transition-all",
                      currentIndex === index
                        ? "bg-blue-50/30 font-medium dark:bg-blue-950/10"
                        : "bg-white shadow-sm hover:bg-gray-50 dark:bg-[#0E1321]/50 dark:hover:bg-gray-800/10",
                    )}
                  >
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-semibold text-[#1A1C1E] dark:text-white">{product.productName}</h2>
                      <p className="mt-0.5 truncate font-mono text-[10px] text-gray-400 dark:text-gray-505">{product.vendorSku}</p>
                    </div>
                    <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-semibold text-gray-500 dark:bg-gray-800 dark:text-gray-400">
                      {sessionItems.find((item) => item.inventoryItemId === product.id)?.status === "not_counted" ? "Nie liczono" : "OK"}
                    </span>
                  </button>
                ))}
              </div>
            </aside>

            <div className="flex flex-col justify-between space-y-4 md:col-span-8">
              <div className="space-y-4 rounded-2xl bg-white p-4 shadow-sm dark:bg-[#0E1321]/30">
                <div className="flex items-start gap-4">
                  <div className="relative h-20 w-20 shrink-0 overflow-hidden rounded-xl bg-gray-100 dark:bg-gray-800">
                    <Image
                      src={activeProduct.imageUrl}
                      alt={activeProduct.productName}
                      fill
                      sizes="80px"
                      className="object-cover"
                      unoptimized
                    />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <span className="rounded bg-blue-50 px-2 py-0.5 text-[10px] font-bold uppercase text-blue-700 dark:bg-blue-950/20 dark:text-blue-400">
                      {activeProduct.category}
                    </span>
                    <h2 className="text-sm font-bold leading-snug text-[#1A1C1E] dark:text-white">{activeProduct.productName}</h2>
                    <div className="flex flex-wrap gap-x-3 gap-y-1 font-mono text-xs text-gray-550 dark:text-gray-405">
                      <span>SKU: {activeProduct.vendorSku}</span>
                      <span>Op. zbiorcze: {activeProduct.packSize} {activeProduct.unit}</span>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-3 gap-2 rounded-xl bg-[#F0F2F5] px-3 py-2.5 text-center text-xs dark:bg-gray-800/55">
                  <CountMetric label="Ostatni stan" value={`${activeProduct.currentStock} szt.`} />
                  <CountMetric label="Minimum" value={`${activeProduct.minStock} szt.`} tone="amber" />
                  <CountMetric label="Cel optymalny" value={`${activeProduct.targetStock} szt.`} tone="emerald" />
                </div>

                <div className="space-y-3">
                  <div className="text-center">
                    <label className="text-xs font-semibold uppercase tracking-wider text-gray-500 dark:text-gray-400">
                      Fizyczna ilość na półce
                    </label>
                  </div>
                  <div className="flex items-center justify-center gap-4">
                    <button type="button" onClick={() => updateQty(Math.max(0, (activeSessionItem.countedQty ?? 0) - activeProduct.packSize))} className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#F0F2F5] text-gray-700 transition-all active:scale-95 dark:bg-gray-800 dark:text-gray-300">
                      <span className="absolute -mt-7 text-[10px] text-gray-400">-{activeProduct.packSize}</span>
                      <Minus className="h-5 w-5" />
                    </button>
                    <input
                      type="number"
                      placeholder="?"
                      value={activeSessionItem.countedQty ?? ""}
                      onChange={(event) => updateQty(event.target.value === "" ? null : Number(event.target.value))}
                      className="w-24 rounded-xl bg-white py-2 text-center font-mono text-xl font-bold text-gray-900 focus:outline-none focus:ring-2 focus:ring-blue-500 dark:bg-[#0E1321] dark:text-white"
                    />
                    <button type="button" onClick={() => updateQty((activeSessionItem.countedQty ?? 0) + activeProduct.packSize)} className="relative flex h-12 w-12 items-center justify-center rounded-xl bg-[#2A3B4C] text-white transition-all active:scale-95 dark:bg-blue-600">
                      <span className="absolute -mt-7 text-[10px] text-blue-200 dark:text-blue-300">+{activeProduct.packSize}</span>
                      <Plus className="h-5 w-5" />
                    </button>
                  </div>

                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <ActionButton active={activeSessionItem.status === "zero_stock"} onClick={() => updateQty(0)}>Wyzeruj</ActionButton>
                    <ActionButton active={activeSessionItem.status === "unable_to_count"} onClick={() => updateActiveItem({ countedQty: null, status: "unable_to_count" })}>Brak dostępu</ActionButton>
                    <ActionButton active={activeSessionItem.status === "recount"} onClick={() => updateActiveItem({ status: "recount" })}>Do weryfikacji</ActionButton>
                  </div>
                </div>

                <div className="grid grid-cols-1 gap-3 pt-2 sm:grid-cols-2">
                  <div className="relative">
                    <FileText className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                    <input
                      type="text"
                      placeholder="Dodaj notatkę..."
                      value={activeSessionItem.note}
                      onChange={(event) => updateActiveItem({ note: event.target.value, status: event.target.value ? "note_added" : activeSessionItem.status })}
                      className="w-full rounded-xl bg-white py-2 pl-9 pr-2.5 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-1 focus:ring-blue-500 dark:bg-[#0E1321]/60 dark:text-white"
                    />
                  </div>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setPhotoAdded((current) => ({ ...current, [activeProduct.id]: !current[activeProduct.id] }))}
                      className={cn(
                        "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-3 py-2 text-xs font-medium transition-colors",
                        photoAdded[activeProduct.id]
                          ? "bg-emerald-50 text-emerald-700 dark:bg-emerald-950/20 dark:text-emerald-400"
                          : "bg-[#F0F2F5] text-gray-700 dark:bg-gray-800 dark:text-gray-300",
                      )}
                    >
                      <Camera className="h-4 w-4" />
                      {photoAdded[activeProduct.id] ? "Zdjęcie dodane" : "Załącz zdjęcie"}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setMessage(`Zeskanowano kod produktu: ${activeProduct.vendorSku}. Dodano +${activeProduct.packSize} szt.`);
                        updateQty((activeSessionItem.countedQty ?? 0) + activeProduct.packSize);
                      }}
                      className="rounded-xl bg-blue-700 px-3 py-2 text-white transition-colors hover:bg-blue-600 dark:bg-blue-600 dark:hover:bg-blue-500"
                      aria-label="Skanuj kod kreskowy"
                    >
                      <Barcode className="h-4 w-4" />
                    </button>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2">
                <button type="button" onClick={() => setCurrentIndex((value) => Math.max(0, value - 1))} disabled={currentIndex === 0} className="flex items-center gap-1 rounded-xl bg-gray-100 px-4 py-2 text-xs font-semibold text-gray-700 transition-all disabled:opacity-40 dark:bg-gray-800 dark:text-gray-300">
                  <ArrowLeft className="h-4 w-4" />
                  Poprzedni
                </button>
                {currentIndex < countingProducts.length - 1 ? (
                  <button type="button" onClick={() => setCurrentIndex((value) => value + 1)} className="flex items-center gap-1 rounded-xl bg-[#2A3B4C] px-4 py-2 text-xs font-semibold text-white dark:bg-blue-600">
                    Następny
                    <ArrowRight className="h-4 w-4" />
                  </button>
                ) : (
                  <button type="button" onClick={completeCount} className="flex items-center gap-1.5 rounded-xl bg-emerald-700 px-5 py-2.5 text-xs font-bold text-white dark:bg-emerald-600">
                    <CheckCircle className="h-4 w-4" />
                    Zakończ i wyślij
                  </button>
                )}
              </div>
            </div>
          </div>
        ) : null}
      </div>
    </section>
  );
}

function WizardStep({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: React.ReactNode;
}) {
  return (
    <div className="mx-auto max-w-xl space-y-6 py-4">
      <div className="space-y-2 text-center">
        <span className="text-xs font-bold uppercase tracking-wider text-blue-600 dark:text-blue-400">{eyebrow}</span>
        <h2 className="font-display text-xl font-bold text-gray-950 dark:text-white">{title}</h2>
        <p className="text-sm text-gray-500 dark:text-gray-400">{description}</p>
      </div>
      <div className="grid grid-cols-1 gap-3">{children}</div>
    </div>
  );
}

function CountMetric({ label, value, tone = "default" }: { label: string; value: string; tone?: "default" | "amber" | "emerald" }) {
  return (
    <div>
      <div className="text-[11px] text-gray-500 dark:text-gray-400">{label}</div>
      <div className={cn("mt-1 font-mono font-bold", tone === "amber" && "text-amber-700 dark:text-amber-450", tone === "emerald" && "text-emerald-700 dark:text-emerald-450", tone === "default" && "text-gray-800 dark:text-gray-200")}>
        {value}
      </div>
    </div>
  );
}

function ActionButton({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded-xl px-1 py-2 text-center text-[11px] font-medium transition-colors",
        active
          ? "bg-amber-500 font-semibold text-white"
          : "bg-[#F0F2F5] text-gray-700 hover:bg-gray-200 dark:bg-gray-800 dark:text-gray-300 dark:hover:bg-gray-700",
      )}
    >
      {children}
    </button>
  );
}

function draftKey(vendorId: string, locationId: string, mode: CountMode) {
  return `vmi_draft_${vendorId}_${locationId}_${mode}`;
}

function readDraft(vendorId: string, locationId: string, mode: CountMode): { items: SessionItem[] } | null {
  try {
    const raw = window.localStorage.getItem(draftKey(vendorId, locationId, mode));
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
