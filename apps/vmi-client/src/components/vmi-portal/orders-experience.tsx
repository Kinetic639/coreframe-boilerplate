"use client";

import * as React from "react";
import {
  ArrowLeft,
  Calendar,
  Check,
  ChevronRight,
  Clock,
  MessageSquare,
  Package,
  Search,
} from "lucide-react";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalLocationDto,
  VmiPortalOrderDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface OrdersExperienceProps {
  orders: VmiPortalOrderDto[];
  inventory: VmiPortalInventoryItemDto[];
  vendors: VmiPortalVendorDto[];
  locations: VmiPortalLocationDto[];
  activeLocationId: string;
}

function statusBadge(status: VmiPortalOrderDto["status"]) {
  switch (status) {
    case "Wysłane":
      return { text: "Nadesłane", className: "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400" };
    case "Potwierdzone":
      return { text: "Zatwierdzone", className: "bg-indigo-50 dark:bg-indigo-500/10 text-indigo-600 dark:text-indigo-400" };
    case "Częściowo potwierdzone":
      return { text: "Częściowe (Brak)", className: "bg-orange-50 dark:bg-orange-500/10 text-orange-600 dark:text-orange-400" };
    case "W transporcie":
    case "Wysłane (Kurier)":
      return { text: "W transporcie", className: "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400 animate-pulse" };
    case "Dostarczone":
      return { text: "Odebrane", className: "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400" };
    case "Anulowane":
      return { text: "Anulowane", className: "bg-gray-100 dark:bg-gray-800 text-gray-600 dark:text-gray-400" };
    default:
      return { text: status, className: "bg-gray-50 dark:bg-gray-900 text-gray-700 dark:text-gray-300" };
  }
}

function orderTotal(order: VmiPortalOrderDto) {
  return order.lines.reduce((sum, line) => sum + line.price * line.requestedQty, 0);
}

export function OrdersExperience({
  orders,
  inventory,
  vendors,
  locations,
  activeLocationId,
}: OrdersExperienceProps) {
  const [selectedOrderId, setSelectedOrderId] = React.useState<string | null>(null);
  const [searchQuery, setSearchQuery] = React.useState("");
  const [statusFilter, setStatusFilter] = React.useState<"all" | "active" | "archived">("all");

  const activeLocationName =
    locations.find((location) => location.id === activeLocationId)?.name ?? "Wybrany oddział";

  const getVendor = (vendorId: string) => vendors.find((vendor) => vendor.id === vendorId);
  const getProduct = (inventoryItemId: string) => inventory.find((item) => item.id === inventoryItemId);

  const filteredOrders = orders
    .filter((order) => order.locationId === activeLocationId)
    .filter((order) => {
      const vendor = getVendor(order.vendorId);
      const query = searchQuery.trim().toLowerCase();
      if (query) {
        const matchesNumber = order.orderNumber.toLowerCase().includes(query);
        const matchesVendor = vendor?.name.toLowerCase().includes(query) ?? false;
        if (!matchesNumber && !matchesVendor) return false;
      }
      if (statusFilter === "active" && ["Dostarczone", "Anulowane"].includes(order.status)) return false;
      if (statusFilter === "archived" && !["Dostarczone", "Anulowane"].includes(order.status)) return false;
      return true;
    });

  const activeOrder = orders.find((order) => order.id === selectedOrderId);
  const activeVendor = activeOrder ? getVendor(activeOrder.vendorId) : undefined;

  if (activeOrder && activeVendor) {
    const badge = statusBadge(activeOrder.status);

    return (
      <section className="space-y-5">
        <div className="flex items-center justify-between gap-3 pb-3">
          <div className="flex min-w-0 items-center gap-3">
            <button
              type="button"
              onClick={() => setSelectedOrderId(null)}
              className="rounded-lg bg-gray-100 p-1.5 text-gray-500 transition-colors hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
              aria-label="Wróć do listy zamówień"
            >
              <ArrowLeft className="h-4 w-4" />
            </button>
            <div className="min-w-0">
              <h1 className="truncate text-sm font-bold text-gray-950 dark:text-white">
                Zamówienie {activeOrder.orderNumber}
              </h1>
              <p className="text-[11px] text-gray-500 dark:text-gray-400">
                Źródło: <span className="font-semibold text-gray-750 dark:text-gray-300">{activeOrder.origin}</span>{" "}
                • {activeOrder.date}
              </p>
            </div>
          </div>

          <span className={cn("rounded px-2.5 py-1 text-[10px] font-extrabold uppercase", badge.className)}>
            {badge.text}
          </span>
        </div>

        <div className="grid grid-cols-1 gap-5 lg:grid-cols-12">
          <aside className="h-fit rounded-xl bg-white p-4 shadow-sm dark:bg-[#0E1321] lg:col-span-4">
            <span className="block text-[10px] font-bold uppercase tracking-wider text-gray-400 dark:text-gray-500">
              Status realizacji zamówienia
            </span>
            <div className="relative mt-4 space-y-5 pl-6 before:absolute before:bottom-2 before:left-2 before:top-2 before:w-0.5 before:bg-gray-150 dark:before:bg-gray-800">
              {activeOrder.timeline.map((step, index) => {
                const isLast = index === activeOrder.timeline.length - 1;
                return (
                  <div key={`${step.status}-${step.date}`} className="relative text-xs">
                    <span
                      className={cn(
                        "absolute -left-6 top-0.5 flex h-4.5 w-4.5 items-center justify-center rounded-full",
                        isLast
                          ? "bg-blue-600 text-white"
                          : "bg-emerald-50 text-emerald-600 dark:bg-emerald-950 dark:text-emerald-400",
                      )}
                    >
                      {isLast ? <Clock className="h-2.5 w-2.5" /> : <Check className="h-2.5 w-2.5" />}
                    </span>
                    <p className={cn("font-bold", isLast ? "text-blue-600 dark:text-blue-400" : "text-emerald-600 dark:text-emerald-400")}>
                      {step.status}
                    </p>
                    <p className="mt-0.5 text-[11px] text-gray-400 dark:text-gray-500">{step.description}</p>
                    <p className="mt-1 font-mono text-[10px] text-gray-400">{step.date}</p>
                  </div>
                );
              })}
            </div>
          </aside>

          <div className="space-y-4 lg:col-span-8">
            <div className="grid grid-cols-1 gap-4 rounded-xl bg-gray-50 p-4 text-xs shadow-sm dark:bg-gray-900/40 sm:grid-cols-2">
              <div className="space-y-1">
                <span className="block text-gray-400 dark:text-gray-500">Dostawca VMI</span>
                <span className="block text-sm font-bold text-gray-950 dark:text-white">{activeVendor.name}</span>
                <span className="block text-[11px] text-gray-500 dark:text-gray-400">
                  Opiekun: {activeVendor.accountManager.name}
                </span>
              </div>
              <div className="space-y-1 sm:text-right">
                <span className="block text-gray-400 dark:text-gray-500">Planowany termin dostawy</span>
                <span className="block text-sm font-bold text-blue-600 dark:text-blue-400">
                  {activeOrder.requestedDeliveryDate}
                </span>
                <span className="block text-[10px] text-gray-400 dark:text-gray-500">
                  Oddział: {activeLocationName}
                </span>
              </div>
            </div>

            <div className="overflow-hidden rounded-xl bg-white shadow-sm dark:bg-[#0E1321]">
              <div className="flex items-center justify-between bg-gray-50 px-4 py-3 dark:bg-[#131A2E]">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-950 dark:text-white">
                  Pozycje zamówienia ({activeOrder.lines.length})
                </span>
                <span className="text-[10px] font-mono text-gray-400 dark:text-gray-500">Ambra Inventory Code</span>
              </div>

              <div className="divide-y divide-[#E1E3E6] dark:divide-gray-850">
                {activeOrder.lines.map((line) => {
                  const product = getProduct(line.inventoryItemId);
                  return (
                    <div key={line.inventoryItemId} className="flex items-center justify-between gap-3 p-3.5 text-xs">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-gray-400 dark:bg-gray-800">
                          <Package className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate font-bold text-gray-950 dark:text-white">
                            {product?.productName ?? "Produkt"}
                          </p>
                          <p className="mt-0.5 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                            SKU: {product?.vendorSku ?? "BRAK"} • Opakowanie: {product?.packSize ?? 1} {product?.unit ?? "szt."}
                          </p>
                        </div>
                      </div>

                      <div className="shrink-0 text-right">
                        <p className="font-mono font-bold text-gray-950 dark:text-white">{line.requestedQty} szt.</p>
                        <p className="font-mono text-[10px] text-gray-400 dark:text-gray-500">
                          {(line.price * line.requestedQty).toFixed(2)} zł
                        </p>
                      </div>
                    </div>
                  );
                })}
              </div>

              <div className="flex items-center justify-between bg-gray-50/60 p-4 text-xs dark:bg-gray-950/40">
                <span className="font-semibold text-gray-500 dark:text-gray-400">Łączna wartość zamówienia:</span>
                <div className="text-right">
                  <p className="font-mono text-base font-black text-gray-950 dark:text-white">
                    {orderTotal(activeOrder).toFixed(2)} zł
                  </p>
                  <p className="text-[10px] text-gray-400 dark:text-gray-500">Netto (+23% VAT)</p>
                </div>
              </div>
            </div>

            <button
              type="button"
              className="flex w-full items-center justify-center gap-2 rounded-xl bg-white py-3.5 text-xs font-semibold text-gray-950 shadow-sm transition-colors hover:bg-gray-50 dark:bg-gray-800 dark:text-white dark:hover:bg-gray-750"
            >
              <MessageSquare className="h-4 w-4 text-blue-600 dark:text-blue-400" />
              Napisz do dostawcy w sprawie tego zamówienia
            </button>
          </div>
        </div>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between pb-2">
        <div>
          <h1 className="font-display text-base font-bold text-gray-950 dark:text-white">Spis zamówień VMI</h1>
          <p className="text-xs text-gray-500 dark:text-gray-400">Monitorowane dostawy do oddziału {activeLocationName}</p>
        </div>
        <span className="rounded bg-white px-2.5 py-0.5 font-mono text-[10px] text-gray-500 shadow-sm dark:bg-gray-900 dark:text-gray-400">
          Łącznie: {filteredOrders.length}
        </span>
      </div>

      <div className="flex flex-col justify-between gap-3 rounded-xl bg-white p-3 shadow-sm dark:bg-[#0E1321] sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400 dark:text-gray-500" />
          <input
            type="text"
            placeholder="Szukaj po numerze zamówienia, dostawcy..."
            value={searchQuery}
            onChange={(event) => setSearchQuery(event.target.value)}
            className="w-full rounded-lg bg-gray-50 py-1.5 pl-9 pr-3 text-xs text-gray-900 placeholder:text-gray-400 focus:outline-none dark:bg-[#0C101A] dark:text-white"
          />
        </div>

        <div className="flex shrink-0 rounded-lg bg-gray-55 p-1 text-xs dark:bg-gray-950">
          {[
            ["all", "Wszystkie"],
            ["active", "W realizacji"],
            ["archived", "Zakończone"],
          ].map(([value, label]) => (
            <button
              key={value}
              type="button"
              onClick={() => setStatusFilter(value as typeof statusFilter)}
              className={cn(
                "rounded-md px-3 py-1 text-xs font-medium transition-colors",
                statusFilter === value
                  ? "bg-white font-bold text-gray-950 shadow-sm dark:bg-gray-800 dark:text-white"
                  : "text-gray-400 hover:text-gray-600 dark:hover:text-gray-200",
              )}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2.5">
        {filteredOrders.map((order) => {
          const vendor = getVendor(order.vendorId);
          const badge = statusBadge(order.status);
          return (
            <button
              key={order.id}
              type="button"
              onClick={() => setSelectedOrderId(order.id)}
              className="flex flex-col justify-between gap-3 rounded-xl bg-white p-4 text-left shadow-sm transition-all hover:bg-gray-50 dark:bg-[#0E1321] dark:hover:bg-[#111728] sm:flex-row sm:items-center"
            >
              <div className="space-y-1.5">
                <div className="flex items-center gap-2">
                  <span className="font-mono text-xs font-black text-gray-900 dark:text-white">{order.orderNumber}</span>
                  <span className={cn("rounded px-1.5 py-0.5 text-[9px] font-extrabold uppercase", badge.className)}>
                    {badge.text}
                  </span>
                </div>
                <p className="text-[11px] text-gray-500 dark:text-gray-400">
                  Dostawca: <strong className="text-gray-800 dark:text-white">{vendor?.name ?? "Dostawca"}</strong> •{" "}
                  {order.lines.length} pozycji
                </p>
                <div className="flex flex-wrap items-center gap-2 font-mono text-[10px] text-gray-400 dark:text-gray-500">
                  <Calendar className="h-3 w-3" />
                  <span>Złożone: {order.date}</span>
                  <span>•</span>
                  <span>Dostawa: {order.requestedDeliveryDate}</span>
                </div>
              </div>

              <div className="flex items-center justify-between pt-2 sm:flex-col sm:items-end sm:pt-0">
                <p className="font-mono text-sm font-black text-gray-950 dark:text-white">{orderTotal(order).toFixed(2)} zł</p>
                <span className="flex items-center gap-0.5 text-[10px] text-gray-400 dark:text-gray-500">
                  Szczegóły
                  <ChevronRight className="h-3.5 w-3.5" />
                </span>
              </div>
            </button>
          );
        })}
      </div>
    </section>
  );
}
