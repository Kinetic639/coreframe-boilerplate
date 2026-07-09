"use client";

import { Clock } from "lucide-react";
import { useLocale, useTranslations } from "next-intl";

interface AuditTrailEvent {
  time: string;
  title: string;
  description: string;
}

interface ReportAuditTrailProps {
  createdAt: string;
  updatedAt: string;
  approvedAt: string | null;
  totalLines: number;
}

function formatTime(iso: string, locale: string) {
  return new Date(iso).toLocaleTimeString(locale, { hour: "2-digit", minute: "2-digit" });
}

/**
 * Built from real timestamps only (created_at/updated_at/approved_at) —
 * never fabricated like the prototype's mocked timeline. Disclosed
 * simplification: inventory_count_sessions has no dedicated `submitted_at`
 * column, so the "submitted" event uses `updated_at` as the closest
 * approximation (the last write before the approve RPC sets approved_at).
 */
export function ReportAuditTrail({
  createdAt,
  updatedAt,
  approvedAt,
  totalLines,
}: ReportAuditTrailProps) {
  const t = useTranslations("warehouseInventory.audits.report");
  const locale = useLocale();

  const events: AuditTrailEvent[] = [
    {
      time: formatTime(createdAt, locale),
      title: t("eventCreated"),
      description: t("eventCreatedDesc", { count: totalLines }),
    },
    {
      time: formatTime(updatedAt, locale),
      title: t("eventSubmitted"),
      description: t("eventSubmittedDesc"),
    },
  ];
  if (approvedAt) {
    events.push({
      time: formatTime(approvedAt, locale),
      title: t("eventApproved"),
      description: t("eventApprovedDesc"),
    });
  }

  return (
    <div className="space-y-4 rounded-xl border border-border bg-card p-4 shadow-md">
      <h4 className="flex items-center gap-1.5 font-mono text-xs font-bold uppercase tracking-wider text-foreground">
        <Clock size={16} className="text-primary" />
        <span>{t("auditTrailTitle")}</span>
      </h4>

      <div className="relative ml-2.5 space-y-4 border-l border-border pl-4">
        {events.map((ev, idx) => (
          <div key={idx} className="relative">
            <div className="absolute -left-[22px] top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full border-2 border-primary bg-card">
              <div className="h-1.5 w-1.5 rounded-full bg-primary" />
            </div>
            <div className="space-y-0.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs font-bold text-foreground">{ev.title}</span>
                <span className="font-mono text-[10px] text-muted-foreground">{ev.time}</span>
              </div>
              <p className="text-[11px] leading-normal text-muted-foreground">{ev.description}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
