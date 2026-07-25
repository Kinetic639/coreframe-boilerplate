"use client";

import * as React from "react";
import Image from "next/image";
import {
  ArrowLeft,
  Check,
  ChevronRight,
  FileText,
  Info,
  MessageSquare,
  Package,
  ShoppingBag,
} from "lucide-react";
import type {
  VmiPortalInventoryItemDto,
  VmiPortalProposalDto,
  VmiPortalVendorDto,
} from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface ProposalsExperienceProps {
  proposals: VmiPortalProposalDto[];
  inventory: VmiPortalInventoryItemDto[];
  vendors: VmiPortalVendorDto[];
}

function proposalStatusClass(status: VmiPortalProposalDto["status"]) {
  if (status === "Zaakceptowana" || status === "Zatwierdzona") {
    return "bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400";
  }
  if (status === "Odrzucona") return "bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400";
  if (status === "Wymaga zmian") return "bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400";
  return "bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400";
}

export function ProposalsExperience({ proposals, inventory, vendors }: ProposalsExperienceProps) {
  const [activeTab, setActiveTab] = React.useState<"quotations" | "rfqs">("quotations");
  const [selectedProposalId, setSelectedProposalId] = React.useState<string | null>(null);
  const [localProposals, setLocalProposals] = React.useState(proposals);
  const [rfqs, setRfqs] = React.useState<Array<{ id: string; number: string; vendorId: string; date: string; status: string }>>([]);

  React.useEffect(() => {
    try {
      const stored = window.localStorage.getItem("ambra-marketplace-rfqs");
      setRfqs(stored ? JSON.parse(stored) : []);
    } catch {
      setRfqs([]);
    }
  }, []);

  const selectedProposal = localProposals.find((proposal) => proposal.id === selectedProposalId);
  const selectedVendor = selectedProposal
    ? vendors.find((vendor) => vendor.id === selectedProposal.vendorId)
    : undefined;

  const getVendor = (vendorId: string) => vendors.find((vendor) => vendor.id === vendorId);
  const getProduct = (inventoryItemId: string) => inventory.find((item) => item.id === inventoryItemId);

  const acceptProposal = (proposalId: string) => {
    setLocalProposals((current) =>
      current.map((proposal) =>
        proposal.id === proposalId ? { ...proposal, status: "Zaakceptowana" } : proposal,
      ),
    );
    setSelectedProposalId(null);
  };

  return (
    <section className="space-y-6 text-left">
      <div>
        <h1 className="font-display text-xl font-black uppercase tracking-tight text-gray-950 dark:text-white">
          Oferty i zapytania
        </h1>
        <p className="text-xs text-gray-500 dark:text-gray-400">
          Zarządzaj otrzymanymi wycenami handlowymi od stałych dostawców oraz składaj nowe zapytania ofertowe (RFQ).
        </p>
      </div>

      <div className="flex overflow-x-auto border-b border-gray-200 pb-px dark:border-gray-800">
        <button
          type="button"
          onClick={() => {
            setActiveTab("quotations");
            setSelectedProposalId(null);
          }}
          className={cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === "quotations"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-450 hover:text-gray-900 dark:hover:text-white",
          )}
        >
          Otrzymane oferty i wyceny ({localProposals.length})
        </button>
        <button
          type="button"
          onClick={() => {
            setActiveTab("rfqs");
            setSelectedProposalId(null);
          }}
          className={cn(
            "whitespace-nowrap border-b-2 px-4 py-2.5 text-xs font-bold uppercase tracking-wider transition-all",
            activeTab === "rfqs"
              ? "border-blue-600 text-blue-600 dark:border-blue-400 dark:text-blue-400"
              : "border-transparent text-gray-450 hover:text-gray-900 dark:hover:text-white",
          )}
        >
          Twoje Zapytania RFQ ({rfqs.length})
        </button>
      </div>

      {activeTab === "quotations" && !selectedProposal ? (
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {localProposals.map((proposal) => {
            const vendor = getVendor(proposal.vendorId);
            return (
              <article
                key={proposal.id}
                className="flex flex-col justify-between space-y-4 rounded-xl border border-gray-150 bg-white p-4 shadow-sm transition-all hover:shadow-md dark:border-gray-850 dark:bg-[#0E1321]"
              >
                <div className="space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="font-mono text-[10px] font-black uppercase text-blue-600 dark:text-blue-400">
                      {proposal.proposalNumber}
                    </span>
                    <span className={cn("rounded-full px-2 py-0.5 text-[9px] font-bold uppercase tracking-wide", proposalStatusClass(proposal.status))}>
                      {proposal.status}
                    </span>
                  </div>

                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-gray-100 text-xs font-bold dark:bg-gray-800">
                      {vendor?.name.charAt(0) ?? "D"}
                    </div>
                    <div className="min-w-0">
                      <h2 className="truncate text-xs font-bold text-gray-900 dark:text-white">{vendor?.name ?? "Dostawca"}</h2>
                      <p className="text-[10px] text-gray-450">Wycena asortymentowa</p>
                    </div>
                  </div>

                  <div className="space-y-1.5 rounded-lg bg-gray-50 p-2.5 text-[10px] dark:bg-gray-950/40">
                    <div className="flex justify-between">
                      <span className="text-gray-400">Liczba pozycji:</span>
                      <span className="font-bold">{proposal.lines.length}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="font-medium text-gray-400">Ważność oferty do:</span>
                      <span className="font-mono font-bold text-gray-700 dark:text-gray-300">{proposal.expiryDate}</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-2">
                  <div>
                    <p className="text-[9px] font-semibold uppercase text-gray-450">Suma oferty</p>
                    <p className="font-mono text-xs font-black text-gray-900 dark:text-white">
                      {proposal.totalValue.toLocaleString("pl-PL", { minimumFractionDigits: 2 })} PLN
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setSelectedProposalId(proposal.id)}
                    className="flex items-center gap-1 rounded-lg bg-[#2A3B4C] px-3 py-1.5 text-[10px] font-bold uppercase tracking-wider text-white transition-colors hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500"
                  >
                    Szczegóły
                    <ChevronRight className="h-3.5 w-3.5" />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      ) : null}

      {activeTab === "quotations" && selectedProposal && selectedVendor ? (
        <article className="space-y-6 rounded-2xl border border-gray-150 bg-white p-4 shadow-sm dark:border-gray-850 dark:bg-[#0E1321] sm:p-6">
          <div className="flex flex-col justify-between gap-3 sm:flex-row sm:items-center">
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => setSelectedProposalId(null)}
                className="rounded-lg bg-gray-100 p-1.5 text-gray-500 transition-colors hover:text-gray-900 dark:bg-gray-800 dark:text-gray-400 dark:hover:text-white"
                aria-label="Wróć do ofert"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
              <div>
                <p className="font-mono text-xs font-black text-blue-600 dark:text-blue-400">
                  {selectedProposal.proposalNumber}
                </p>
                <h2 className="text-base font-black text-gray-950 dark:text-white">{selectedVendor.name}</h2>
              </div>
            </div>
            <span className={cn("w-fit rounded-full px-2.5 py-1 text-[10px] font-bold uppercase", proposalStatusClass(selectedProposal.status))}>
              {selectedProposal.status}
            </span>
          </div>

          <div className="grid grid-cols-1 gap-3 rounded-xl bg-gray-50 p-3 text-xs dark:bg-gray-950/40 sm:grid-cols-3">
            <SmallInfo label="Ważna do" value={selectedProposal.expiryDate} />
            <SmallInfo label="Warunki dostawy" value={selectedProposal.deliveryConditions} />
            <SmallInfo label="Wartość netto" value={`${selectedProposal.totalValue.toFixed(2)} PLN`} strong />
          </div>

          <div className="space-y-3">
            <h3 className="text-xs font-bold uppercase tracking-wider text-gray-400">Pozycje wycenione ({selectedProposal.lines.length})</h3>
            <div className="divide-y divide-gray-100 overflow-hidden rounded-xl border border-gray-100 dark:divide-gray-850 dark:border-gray-850">
              {selectedProposal.lines.map((line) => {
                const product = getProduct(line.inventoryItemId);
                const savings = (line.originalPrice - line.offeredPrice) * line.qty;
                return (
                  <div key={line.inventoryItemId} className="flex flex-col justify-between gap-4 p-4 text-xs transition-colors hover:bg-gray-50/50 dark:hover:bg-gray-800/10 sm:flex-row sm:items-center">
                    <div className="flex min-w-0 gap-3">
                      <div className="relative h-10 w-10 shrink-0 overflow-hidden rounded-lg bg-gray-100 dark:bg-gray-800">
                        {product?.imageUrl ? (
                          <Image src={product.imageUrl} alt={product.productName} fill sizes="40px" className="object-cover" />
                        ) : (
                          <Package className="m-3 h-4 w-4 text-gray-400" />
                        )}
                      </div>
                      <div className="min-w-0">
                        <h4 className="truncate font-bold text-gray-900 dark:text-white">{product?.productName ?? "Produkt"}</h4>
                        <p className="font-mono text-[10px] text-gray-400">
                          SKU: {product?.vendorSku ?? "BRAK"} • Jedn: {product?.unit ?? "szt."}
                        </p>
                        {line.reason ? <p className="mt-1 text-[10px] text-gray-500 dark:text-gray-400">{line.reason}</p> : null}
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-4 font-mono sm:grid-cols-4 sm:text-center">
                      <PriceMetric label="Ilość" value={String(line.qty)} />
                      <PriceMetric label="Cena katalogowa" value={`${line.originalPrice.toFixed(2)} PLN`} muted />
                      <PriceMetric label="Cena oferty" value={`${line.offeredPrice.toFixed(2)} PLN`} accent />
                      <PriceMetric label="Suma netto" value={`${(line.offeredPrice * line.qty).toFixed(2)} PLN`} strong extra={savings > 0 ? `Oszczędność: -${savings.toFixed(2)} PLN` : undefined} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {selectedProposal.notes ? (
            <div className="flex gap-3 rounded-xl border border-blue-100/50 bg-blue-50/40 p-3.5 text-xs text-gray-600 dark:border-blue-900/20 dark:bg-blue-950/10 dark:text-gray-400">
              <Info className="mt-0.5 h-4 w-4 shrink-0 text-blue-500" />
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Uwagi dostawcy:</p>
                <p className="mt-0.5 leading-relaxed">{selectedProposal.notes}</p>
              </div>
            </div>
          ) : null}

          <div className="grid gap-2 sm:grid-cols-[1fr_auto_auto]">
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl border border-gray-200 py-2.5 text-xs font-extrabold uppercase tracking-wider text-gray-700 transition-colors hover:bg-gray-50 dark:border-gray-800 dark:text-gray-300 dark:hover:bg-gray-850"
            >
              <MessageSquare className="h-3.5 w-3.5 text-blue-500" />
              Czat z opiekunem
            </button>
            <button
              type="button"
              onClick={() => acceptProposal(selectedProposal.id)}
              className="flex items-center justify-center gap-2 rounded-xl bg-emerald-600 px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-emerald-500"
            >
              <Check className="h-4 w-4" />
              Akceptuj ofertę
            </button>
            <button
              type="button"
              className="flex items-center justify-center gap-2 rounded-xl bg-[#2A3B4C] px-5 py-2.5 text-xs font-extrabold uppercase tracking-wider text-white transition-colors hover:bg-[#1E2B38] dark:bg-blue-600 dark:hover:bg-blue-500"
            >
              <ShoppingBag className="h-4 w-4" />
              Zamów
            </button>
          </div>
        </article>
      ) : null}

      {activeTab === "rfqs" ? (
        <div className="space-y-4">
          <h2 className="flex items-center gap-2 text-sm font-extrabold uppercase tracking-tight text-gray-900 dark:text-white">
            <span className="h-2 w-2 rounded-full bg-blue-500" />
            Wysłane zapytania i historia wycen ({rfqs.length})
          </h2>
          {rfqs.length === 0 ? (
            <div className="mx-auto max-w-lg space-y-4 rounded-2xl border border-gray-150 bg-white px-4 py-12 text-center shadow-sm dark:border-gray-850 dark:bg-[#0E1321]">
              <FileText className="mx-auto h-10 w-10 text-gray-300 dark:text-gray-700" />
              <h3 className="text-sm font-bold text-gray-800 dark:text-gray-200">Brak wysłanych zapytań</h3>
              <p className="text-xs leading-relaxed text-gray-400">
                Historia wszystkich złożonych zapytań ofertowych oraz nadesłanych przez dostawców wycen specjalnych będzie gromadzona w tym panelu.
              </p>
            </div>
          ) : (
            rfqs.map((rfq) => (
              <div key={rfq.id} className="rounded-2xl border border-gray-150 bg-white p-5 text-xs shadow-sm dark:border-gray-850 dark:bg-[#0E1321]">
                <p className="font-mono font-black text-blue-600 dark:text-blue-400">{rfq.number}</p>
                <p className="mt-1 text-gray-500 dark:text-gray-400">{rfq.status} • {rfq.date}</p>
              </div>
            ))
          )}
        </div>
      ) : null}
    </section>
  );
}

function SmallInfo({ label, value, strong = false }: { label: string; value: string; strong?: boolean }) {
  return (
    <div>
      <p className="text-[10px] font-bold uppercase tracking-wider text-gray-400">{label}</p>
      <p className={cn("mt-1 text-xs text-gray-700 dark:text-gray-300", strong && "font-mono font-black text-gray-950 dark:text-white")}>{value}</p>
    </div>
  );
}

function PriceMetric({
  label,
  value,
  muted,
  accent,
  strong,
  extra,
}: {
  label: string;
  value: string;
  muted?: boolean;
  accent?: boolean;
  strong?: boolean;
  extra?: string;
}) {
  return (
    <div>
      <p className="font-sans text-[9px] text-gray-400">{label}</p>
      <p
        className={cn(
          "text-[11px]",
          muted && "text-gray-400 line-through",
          accent && "font-bold text-blue-600 dark:text-blue-400",
          strong && "font-black text-gray-900 dark:text-white",
        )}
      >
        {value}
      </p>
      {extra ? <p className="font-sans text-[9px] font-bold text-emerald-500">{extra}</p> : null}
    </div>
  );
}
