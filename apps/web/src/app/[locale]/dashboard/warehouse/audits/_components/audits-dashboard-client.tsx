"use client";

import { useMemo, useState } from "react";
import { useTranslations } from "next-intl";
import {
  AlertTriangle,
  ArrowUpRight,
  ChevronRight,
  ClipboardCheck,
  Clock,
  Database,
  FileText,
  Plus,
  Search,
} from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  useCountSessionsQuery,
  type CountSessionListResult,
} from "@/hooks/queries/warehouse/audits";
import { AuditStatusBadge } from "./audit-status-badge";

interface AuditsDashboardClientProps {
  branchId: string | null;
  initialData: CountSessionListResult;
  canManage: boolean;
}

export function AuditsDashboardClient({
  branchId,
  initialData,
  canManage,
}: AuditsDashboardClientProps) {
  const t = useTranslations("warehouseInventory.audits.dashboard");
  const [search, setSearch] = useState("");

  const { data } = useCountSessionsQuery(branchId, {}, initialData);
  const sessions = useMemo(() => data?.rows ?? [], [data]);

  const stats = useMemo(() => {
    return {
      open: sessions.filter((s) => s.status === "draft" || s.status === "counting").length,
      review: sessions.filter((s) => s.status === "submitted").length,
      posted: sessions.filter((s) => s.status === "approved").length,
      total: sessions.length,
    };
  }, [sessions]);

  const filteredSessions = useMemo(() => {
    if (!search.trim()) return sessions;
    const needle = search.trim().toLowerCase();
    return sessions.filter((session) => {
      const countType = session.scope.count_type ?? "";
      return session.count_number.toLowerCase().includes(needle) || countType.includes(needle);
    });
  }, [sessions, search]);

  return (
    <div className="space-y-6">
      {/* Top banner */}
      <div className="relative flex flex-col gap-4 overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl sm:flex-row sm:items-center sm:justify-between">
        <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_100%_0%,hsl(var(--primary)/0.12)_0%,transparent_50%)]" />
        <div className="relative z-10">
          <div className="mb-1.5 flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-primary">
            <Database size={14} />
            <span>WMS</span>
          </div>
          <h1 className="text-xl font-bold tracking-tight text-foreground sm:text-2xl">
            {t("title")}
          </h1>
          <p className="mt-1 max-w-xl text-xs leading-relaxed text-muted-foreground">
            {t("description")}
          </p>
        </div>
        {canManage && (
          <Button asChild size="lg" className="relative z-10 shrink-0 uppercase tracking-widest">
            <Link href="/dashboard/warehouse/audits/new">
              <Plus size={16} className="mr-1.5" />
              {t("newAudit")}
            </Link>
          </Button>
        )}
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <StatCard icon={<Clock size={18} />} label={t("statOpen")} value={stats.open} tone="blue" />
        <StatCard
          icon={<AlertTriangle size={18} />}
          label={t("statReview")}
          value={stats.review}
          tone="amber"
        />
        <StatCard
          icon={<ClipboardCheck size={18} />}
          label={t("statPosted")}
          value={stats.posted}
          tone="emerald"
        />
        <StatCard
          icon={<ClipboardCheck size={18} />}
          label={t("statTotal")}
          value={stats.total}
          tone="primary"
        />
      </div>

      {/* Search + session list */}
      <div className="overflow-hidden rounded-xl border border-border bg-card shadow-md">
        <div className="flex flex-col gap-3 border-b border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="text-xs font-bold uppercase tracking-wider text-muted-foreground">
            {t("title")}
          </div>
          <div className="relative">
            <Search className="absolute left-3 top-2.5 text-muted-foreground" size={14} />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={t("searchPlaceholder")}
              className="w-full pl-9 sm:w-64"
            />
          </div>
        </div>

        {filteredSessions.length === 0 ? (
          <div className="flex flex-col items-center justify-center p-8 text-center">
            <ClipboardCheck size={36} className="mb-2 text-muted-foreground/50" />
            <p className="text-xs font-semibold text-foreground">{t("noSessionsTitle")}</p>
            <p className="mt-1 text-[10px] text-muted-foreground">{t("noSessionsDescription")}</p>
          </div>
        ) : (
          <div className="divide-y divide-border">
            {filteredSessions.map((session) => {
              const scope = session.scope;
              const countType = scope.count_type ?? "location";
              const progress =
                session.total_lines > 0
                  ? Math.round((session.counted_lines / session.total_lines) * 100)
                  : 0;

              return (
                <div key={session.id} className="p-4 transition-colors hover:bg-muted/20 sm:p-5">
                  <div className="flex flex-col justify-between gap-4 md:flex-row md:items-center">
                    <div className="flex-1 space-y-2">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="rounded border border-border bg-muted px-2 py-0.5 font-mono text-xs font-bold text-foreground">
                          {session.count_number}
                        </span>
                        <AuditStatusBadge status={session.status} />
                        <span className="rounded border border-border bg-muted px-2 py-0.5 text-[10px] font-bold text-primary">
                          {countType === "location" ? t("typeLocation") : t("typeSupplier")}
                        </span>
                      </div>
                      <p className="text-[11px] text-muted-foreground">
                        {countType === "location"
                          ? t("scopeLocations", {
                              count: scope.location_ids?.length ?? 0,
                              children: scope.include_children ? t("scopeLocationsChildren") : "",
                            })
                          : t("scopeSupplier")}
                      </p>
                      <p className="text-[11px] text-muted-foreground">
                        {t("createdOn", {
                          date: new Date(session.created_at).toLocaleDateString(),
                        })}
                      </p>
                    </div>

                    <div className="flex min-w-[150px] flex-row items-center justify-between gap-2 md:flex-col md:items-end md:text-right">
                      <div>
                        <div className="flex items-center justify-between gap-1.5 font-mono text-xs font-semibold text-foreground md:justify-end">
                          <span>{progress}%</span>
                          <span className="text-[10px] text-muted-foreground">
                            {t("itemsCount", { count: session.total_lines })}
                          </span>
                        </div>
                        <div className="mt-1 h-1.5 w-28 overflow-hidden rounded-full border border-border bg-muted">
                          <div
                            className={
                              session.status === "approved"
                                ? "h-full rounded-full bg-emerald-600 transition-all duration-500"
                                : "h-full rounded-full bg-primary transition-all duration-500"
                            }
                            style={{ width: `${progress}%` }}
                          />
                        </div>
                      </div>
                      {session.variance_lines > 0 && session.status !== "approved" && (
                        <div className="flex items-center gap-1 rounded-lg border border-amber-400/60 bg-amber-100 px-2 py-0.5 text-[10px] font-bold text-amber-600 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-400">
                          <AlertTriangle size={10} />
                          {t("varianceDetected", { count: session.variance_lines })}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-end gap-2 border-t border-border pt-3 md:border-t-0 md:pt-0">
                      {session.status === "draft" || session.status === "counting" ? (
                        <Button asChild variant="outline" size="sm" className="uppercase">
                          <Link
                            href={{
                              pathname: "/dashboard/warehouse/audits/[id]/count",
                              params: { id: session.id },
                            }}
                          >
                            {t("resumeCounting")}
                            <ChevronRight size={12} className="ml-1" />
                          </Link>
                        </Button>
                      ) : session.status === "submitted" ? (
                        <Button asChild variant="outline" size="sm" className="uppercase">
                          <Link
                            href={{
                              pathname: "/dashboard/warehouse/audits/[id]/review",
                              params: { id: session.id },
                            }}
                          >
                            {t("reviewVariances")}
                            <ArrowUpRight size={12} className="ml-1" />
                          </Link>
                        </Button>
                      ) : session.status === "approved" ? (
                        <Button asChild variant="secondary" size="sm" className="uppercase">
                          <Link
                            href={{
                              pathname: "/dashboard/warehouse/audits/[id]/report",
                              params: { id: session.id },
                            }}
                          >
                            <FileText size={12} className="mr-1" />
                            {t("viewReport")}
                          </Link>
                        </Button>
                      ) : null}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

function StatCard({
  icon,
  label,
  value,
  tone,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  tone: "blue" | "amber" | "emerald" | "primary";
}) {
  const toneClasses: Record<typeof tone, string> = {
    blue: "bg-blue-100 text-blue-600 border-blue-400/60 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-900/30",
    amber:
      "bg-amber-100 text-amber-600 border-amber-400/60 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-900/30",
    emerald:
      "bg-emerald-100 text-emerald-600 border-emerald-400/60 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-900/30",
    primary: "bg-primary/10 text-primary border-primary/20",
  };

  return (
    <div className="flex items-center gap-3.5 rounded-xl border border-border bg-card p-4 shadow-sm">
      <div className={`rounded-lg border p-2.5 ${toneClasses[tone]}`}>{icon}</div>
      <div>
        <div className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {label}
        </div>
        <div className="mt-0.5 font-mono text-lg font-bold text-foreground">{value}</div>
      </div>
    </div>
  );
}
