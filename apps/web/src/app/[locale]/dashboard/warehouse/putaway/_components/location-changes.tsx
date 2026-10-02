"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Loader2, MapPin, MapPinOff } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { listLocationChangesAction } from "@/app/actions/warehouse/putaway-scan";
import type { LocationChange } from "@/server/services/putaway-scan.service";
import { locLabel } from "./putaway-utils";

type Range = "today" | "yesterday" | "week";

function since(range: Range): string {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  if (range === "yesterday") d.setDate(d.getDate() - 1);
  if (range === "week") d.setDate(d.getDate() - 6);
  return d.toISOString();
}

/**
 * "Do przepisania": repair orders whose locations changed (put away, moved,
 * issued), each with where it is now -- new places highlighted -- and the
 * places it left. Temporary aid for copying locations into AutoStacja in
 * one sitting instead of walking to the computer after every shelf.
 */
export function LocationChanges() {
  const t = useTranslations("modules.warehouse.putaway.changes");
  const [range, setRange] = useState<Range>("today");
  const [rows, setRows] = useState<LocationChange[] | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setRows(null);
    setError(false);
    listLocationChangesAction(since(range)).then((res) => {
      if (cancelled) return;
      if (!res.success) setError(true);
      else setRows(res.data);
    });
    return () => {
      cancelled = true;
    };
  }, [range]);

  return (
    <div className="flex flex-col gap-3" data-testid="location-changes">
      <div className="grid grid-cols-3 gap-1 rounded-lg border p-1">
        {(["today", "yesterday", "week"] as const).map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => setRange(r)}
            className={cn(
              "h-10 rounded-md text-sm",
              range === r ? "bg-primary text-primary-foreground" : "text-muted-foreground"
            )}
          >
            {t(`range.${r}`)}
          </button>
        ))}
      </div>
      <p className="text-muted-foreground text-xs">{t("hint")}</p>

      {error ? (
        <p className="text-destructive text-sm">{t("error")}</p>
      ) : rows === null ? (
        <p className="text-muted-foreground flex items-center gap-2 text-sm">
          <Loader2 className="h-4 w-4 animate-spin" />
          {t("loading")}
        </p>
      ) : rows.length === 0 ? (
        <p className="text-muted-foreground py-8 text-center text-sm">{t("empty")}</p>
      ) : (
        rows.map((row) => (
          <article
            key={row.repairOrderId}
            className="bg-card rounded-lg border p-3"
            data-testid="location-change"
          >
            <p className="font-mono text-sm font-semibold break-all">ZL {row.zlNumber ?? "—"}</p>
            <p className="text-muted-foreground text-xs">
              {[row.clientName, row.vehicleBrand].filter(Boolean).join(" · ") || "—"}
            </p>
            <div className="mt-2 flex flex-col gap-1.5">
              {row.current.length === 0 && (
                <p className="text-muted-foreground text-xs">{t("nowhere")}</p>
              )}
              {row.current.map((loc) => (
                <div key={loc.id} className="flex items-start gap-2 text-sm">
                  <MapPin className="mt-0.5 h-4 w-4 shrink-0" />
                  <div className="min-w-0 flex-1">
                    <span className={cn(loc.isNew && "font-semibold")}>
                      {locLabel(loc.code, loc.name)}
                    </span>
                    {loc.containers.length > 0 && (
                      <span className="text-muted-foreground block text-xs">
                        {loc.containers.join(", ")}
                      </span>
                    )}
                  </div>
                  {loc.isNew && <Badge className="shrink-0">{t("new")}</Badge>}
                </div>
              ))}
              {row.released.map((loc) => (
                <div key={loc.id} className="text-muted-foreground flex items-start gap-2 text-sm">
                  <MapPinOff className="mt-0.5 h-4 w-4 shrink-0" />
                  <span className="line-through">{locLabel(loc.code, loc.name)}</span>
                  <span className="text-xs">{t("released")}</span>
                </div>
              ))}
            </div>
          </article>
        ))
      )}
    </div>
  );
}
