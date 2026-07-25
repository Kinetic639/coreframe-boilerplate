import Link from "next/link";
import {
  AlertTriangle,
  ArrowRight,
  Bell,
  ChevronRight,
  Clock,
  Database,
  FileCheck,
  FileText,
  Globe,
  Layers,
  MapPin,
  MessageSquare,
  Package,
  Percent,
  Truck,
} from "lucide-react";
import type { VmiPortalDashboardDto } from "@/lib/vmi-portal/types";
import { cn } from "@/utils/cn";

interface PortalDashboardProps {
  dashboard: VmiPortalDashboardDto;
}

const attentionItems = [
  {
    title: "Propozycja uzupełnienia AutoParts Pro",
    description:
      "Nowa kalkulacja dostawy klocków i filtrów czeka na Twoje zatwierdzenie.",
    meta: "Wygasa za 2 dni",
    href: "/proposals",
    icon: FileCheck,
    tone: "blue",
  },
  {
    title: "Wycena specjalna SafetyCore BHP",
    description:
      "Dedykowana oferta na odzież i środki ochrony ma ograniczony termin ważności.",
    meta: "Ważna do 25 lipca",
    href: "/proposals",
    icon: Percent,
    tone: "amber",
  },
  {
    title: "Zlecone inwentaryzacje VMI",
    description:
      "Dostawca prosi o aktualizację stanu wybranych pozycji przed kolejną dostawą.",
    meta: "Inwentaryzacja VMI",
    href: "/stock-counts",
    icon: Clock,
    tone: "indigo",
  },
] as const;

const marketplaceTabs = [
  { label: "Zapytania ofertowe", count: 0, icon: FileText },
  { label: "Wysłane pytania", count: 0, icon: MessageSquare },
  { label: "Ulubione produkty", count: 0, icon: Package },
  { label: "Ulubieni dostawcy", count: 0, icon: Layers },
] as const;

function MetricCard({
  label,
  value,
  suffix,
  href,
  icon: Icon,
  isWarning = false,
}: {
  label: string;
  value: number;
  suffix: string;
  href: string;
  icon: typeof Layers;
  isWarning?: boolean;
}) {
  return (
    <Link
      href={href}
      className="group rounded-xl bg-card p-4 shadow-sm transition hover:bg-background"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </span>
        <Icon
          className={cn(
            "h-4 w-4 text-muted-foreground transition-colors group-hover:text-primary",
            isWarning && "text-destructive group-hover:text-destructive",
          )}
        />
      </div>
      <div className="mt-2 flex items-baseline gap-1.5">
        <span
          className={cn(
            "font-mono text-xl font-black text-foreground",
            isWarning && value > 0 && "text-destructive",
          )}
        >
          {value}
        </span>
        <span className="text-[10px] font-semibold text-muted-foreground">{suffix}</span>
      </div>
    </Link>
  );
}

function ActionCard({
  title,
  description,
  meta,
  href,
  icon: Icon,
  tone,
}: {
  title: string;
  description: string;
  meta: string;
  href: string;
  icon: typeof Database;
  tone: "red" | "blue" | "amber" | "indigo" | "orange";
}) {
  const toneClass = {
    red: "bg-red-50 text-red-600 dark:bg-red-950/25 dark:text-red-400",
    blue: "bg-blue-50 text-blue-600 dark:bg-blue-950/25 dark:text-blue-400",
    amber: "bg-amber-50 text-amber-700 dark:bg-amber-950/25 dark:text-amber-400",
    indigo: "bg-indigo-50 text-indigo-600 dark:bg-indigo-950/25 dark:text-indigo-400",
    orange: "bg-orange-50 text-orange-600 dark:bg-orange-950/25 dark:text-orange-400",
  }[tone];

  return (
    <Link
      href={href}
      className="flex items-start justify-between gap-3 rounded-xl bg-card p-3.5 shadow-sm transition hover:bg-background"
    >
      <div className="flex min-w-0 items-start gap-3">
        <div className={cn("mt-0.5 shrink-0 rounded-lg p-2.5", toneClass)}>
          <Icon className="h-5 w-5" />
        </div>
        <div className="min-w-0">
          <h3 className="text-xs font-bold text-foreground">{title}</h3>
          <p className="mt-1 text-[11px] leading-relaxed text-muted-foreground">{description}</p>
          <span className={cn("mt-2 inline-block rounded px-1.5 py-0.5 font-mono text-[9px] font-bold uppercase", toneClass)}>
            {meta}
          </span>
        </div>
      </div>
      <ChevronRight className="mt-2 h-5 w-5 shrink-0 text-muted-foreground" />
    </Link>
  );
}

export function PortalDashboard({ dashboard }: PortalDashboardProps) {
  const lowStockCount = dashboard.metrics.lowStockItems;
  const primaryLowStock = dashboard.lowStockItems[0];

  return (
    <section className="space-y-6">
      <div className="relative overflow-hidden rounded-2xl bg-[#2A3B4C] p-6 text-white shadow-sm">
        <div className="relative z-10 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="h-2.5 w-2.5 rounded-full bg-emerald-400" />
              <span className="font-mono text-[10px] font-bold uppercase tracking-wider text-slate-300">
                Dostęp VMI aktywny
              </span>
            </div>
            <h1 className="font-display text-xl font-bold text-white md:text-2xl">
              Witaj, {dashboard.user.name}
            </h1>
            <p className="text-xs text-slate-300">
              Firma: <strong className="text-white">{dashboard.user.organization}</strong> • Rola:{" "}
              <span className="font-semibold text-blue-200">{dashboard.user.role}</span>
            </p>
          </div>

          <div className="flex items-center gap-2.5 rounded-xl bg-[#1E2B38] p-2">
            <div className="rounded-lg bg-blue-500/10 p-1.5 text-blue-300">
              <MapPin className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <p className="text-[9px] font-bold uppercase tracking-wide text-slate-400">
                Aktywny oddział
              </p>
              <p className="text-xs font-bold text-white">{dashboard.activeLocation.name}</p>
              <p className="text-[10px] text-slate-400">{dashboard.activeLocation.address}</p>
            </div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
        <MetricCard label="Dostawcy" value={dashboard.metrics.vendors} suffix="aktywne" href="/portal/vendors" icon={Layers} />
        <MetricCard label="Monitowane" value={dashboard.metrics.monitoredItems} suffix="pozycji" href="/inventory" icon={Package} />
        <MetricCard label="Niski stan" value={lowStockCount} suffix="do uzupełnienia" href="/inventory" icon={AlertTriangle} isWarning />
        <MetricCard label="Dostawy VMI" value={dashboard.metrics.pendingProposals} suffix="propozycje" href="/proposals" icon={FileCheck} />
        <MetricCard label="W realizacji" value={dashboard.metrics.activeOrders} suffix="zamówień" href="/orders" icon={Truck} />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
        <div className="space-y-4 lg:col-span-7">
          <div className="flex items-center justify-between">
            <h2 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
              <AlertTriangle className="h-4 w-4 text-destructive" />
              Wymaga uwagi
            </h2>
            <span className="rounded-full bg-red-50 px-2 py-0.5 text-[10px] font-bold text-red-600 dark:bg-red-950/20 dark:text-red-400">
              Krytyczne
            </span>
          </div>

          <div className="grid gap-3">
            <ActionCard
              title="Niski zapas chemii i części"
              description={
                primaryLowStock
                  ? `W lokalizacji ${dashboard.activeLocation.name} produkt ${primaryLowStock.productName} spadł poniżej bezpiecznego poziomu VMI.`
                  : `W lokalizacji ${dashboard.activeLocation.name} nie ma krytycznych braków.`
              }
              meta="CleanChem / AutoParts"
              href="/inventory"
              icon={Database}
              tone="red"
            />
            {attentionItems.map((item) => (
              <ActionCard key={item.title} {...item} />
            ))}
            {dashboard.activeOrders[0] ? (
              <ActionCard
                title="Zamówienie częściowo potwierdzone"
                description="Dostawca zgłosił częściową dostępność pozycji. Sprawdź zamówienie i zdecyduj, czy akceptujesz dostawę etapową."
                meta={dashboard.activeOrders[0].orderNumber}
                href="/orders"
                icon={Truck}
                tone="orange"
              />
            ) : null}
          </div>
        </div>

        <aside className="space-y-6 lg:col-span-5">
          <section className="space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="flex items-center gap-2 font-display text-xs font-bold uppercase tracking-wider text-muted-foreground">
                <Bell className="h-4 w-4 text-blue-500" />
                Ostatnie powiadomienia
              </h2>
              <Link href="/messages" className="text-xs font-bold text-primary hover:underline">
                Pokaż wszystkie
              </Link>
            </div>

            <div className="rounded-2xl bg-card p-4 shadow-sm">
              <div className="space-y-4 text-xs">
                {dashboard.messageThreads.map((thread) => (
                  <Link key={thread.id} href="/messages" className="flex gap-3">
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-blue-500" />
                    <span className="space-y-0.5">
                      <span className="block font-medium text-foreground">{thread.subject}</span>
                      <span className="block text-[10px] text-muted-foreground">
                        Nieprzeczytane: {thread.unreadCount} •{" "}
                        {new Date(thread.lastUpdated).toLocaleString("pl-PL")}
                      </span>
                    </span>
                  </Link>
                ))}
                <div className="flex gap-3">
                  <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-500" />
                  <span className="space-y-0.5">
                    <span className="block font-medium text-foreground">
                      Dostarczono ostatnie zamówienie CleanChem
                    </span>
                    <span className="block text-[10px] text-muted-foreground">
                      Wczoraj, 10:30 • CleanChem
                    </span>
                  </span>
                </div>
              </div>
            </div>
          </section>

          <section className="rounded-2xl bg-card p-5 shadow-sm">
            <div className="flex items-center justify-between gap-4">
              <div>
                <h2 className="font-display text-sm font-black uppercase tracking-tight text-foreground">
                  Oczekujące propozycje
                </h2>
                <p className="mt-1 text-xs text-muted-foreground">
                  Decyzje wymagane przed kolejną dostawą.
                </p>
              </div>
              <Link href="/proposals" className="text-xs font-bold text-primary hover:underline">
                Otwórz
              </Link>
            </div>
            <div className="mt-4 space-y-3">
              {dashboard.pendingProposals.map((proposal) => (
                <Link key={proposal.id} href="/proposals" className="block rounded-xl bg-background p-3">
                  <p className="font-mono text-[10px] font-black text-primary">{proposal.proposalNumber}</p>
                  <p className="mt-1 text-xs font-bold text-foreground">
                    {proposal.totalValue.toLocaleString("pl-PL")} PLN
                  </p>
                  <p className="text-[10px] text-muted-foreground">
                    Pilne pozycje: {proposal.urgentLinesCount} • ważne do {proposal.expiryDate}
                  </p>
                </Link>
              ))}
            </div>
          </section>
        </aside>
      </div>

      <section className="rounded-2xl bg-card p-6 text-left text-xs shadow-sm">
        <div className="flex flex-col justify-between gap-4 border-b border-border pb-4 sm:flex-row sm:items-center">
          <div>
            <h2 className="flex items-center gap-2 font-display text-base font-black uppercase tracking-tight text-foreground">
              <Globe className="h-5 w-5 text-primary" />
              Twoja aktywność w Marketplace B2B
            </h2>
            <p className="mt-1 text-xs text-muted-foreground">
              Zapytania ofertowe, pytania do dostawców oraz zapisane produkty i firmy z katalogu publicznego.
            </p>
          </div>
          <Link
            href="/vendors"
            className="inline-flex items-center gap-1.5 self-start rounded-xl bg-primary/10 px-4 py-2 text-xs font-extrabold uppercase tracking-wide text-primary transition hover:bg-primary/15 sm:self-center"
          >
            Otwórz Marketplace
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2 border-b border-border pb-3">
          {marketplaceTabs.map((tab, index) => {
            const Icon = tab.icon;
            return (
              <div
                key={tab.label}
                className={cn(
                  "flex items-center gap-1.5 rounded-xl px-3.5 py-2 text-xs font-bold uppercase",
                  index === 0
                    ? "bg-primary text-primary-foreground"
                    : "text-muted-foreground hover:bg-muted",
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label} ({tab.count})
              </div>
            );
          })}
        </div>

        <div className="flex min-h-40 flex-col items-center justify-center py-10 text-center text-muted-foreground">
          <FileText className="h-10 w-10 opacity-40" />
          <p className="mt-3 text-xs font-extrabold text-foreground">
            Brak wysłanych zapytań ofertowych
          </p>
          <p className="mt-1 max-w-md text-[10px]">
            Dodaj wybrane towary dostawców do zapytania w Marketplace i wyślij je w kilka chwil.
          </p>
          <Link
            href="/vendors"
            className="mt-4 rounded-lg bg-muted px-4 py-1.5 text-xs font-bold text-foreground transition hover:bg-background"
          >
            Szukaj produktów i stwórz RFQ
          </Link>
        </div>
      </section>
    </section>
  );
}
