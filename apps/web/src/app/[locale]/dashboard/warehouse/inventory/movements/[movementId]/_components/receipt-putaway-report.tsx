"use client";

import { useTranslations } from "next-intl";
import { Download, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import type { ReceiptReportLine } from "@/server/services/inventory-receiving.service";

type Props = {
  documentNumber: string | null;
  lines: ReceiptReportLine[];
};

function locLabel(code: string | null, name: string | null) {
  if (code && name) return `${code} · ${name}`;
  return code ?? name ?? "—";
}

function qty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toString();
}

function csvCell(value: string) {
  return /[";\n]/.test(value) ? `"${value.replaceAll('"', '""')}"` : value;
}

/**
 * Zone 5: the PZ's putaway report -- per line its ZL, where it actually
 * went (location, MM document, RO container) and what still waits in the
 * receiving zone. Exportable as CSV for updating DMS/AutoStacja by hand.
 */
export function ReceiptPutawayReport({ documentNumber, lines }: Props) {
  const t = useTranslations("warehouseInventory.receiptReport");
  const total = lines.reduce((s, l) => s + l.quantity, 0);
  const waiting = lines.reduce((s, l) => s + l.pendingQuantity, 0);
  const done = waiting === 0;

  function exportCsv() {
    const header = [
      t("columns.sku"),
      t("columns.name"),
      t("columns.quantity"),
      t("columns.zl"),
      t("columns.location"),
      t("columns.container"),
      t("columns.pending"),
    ];
    const rows = lines.map((l) => [
      l.sku,
      l.productName,
      `${qty(l.quantity)} ${l.unitCode}`.trim(),
      l.zlNumber ?? "",
      l.putaway
        .map((p) => `${locLabel(p.locationCode, p.locationName)} (${qty(p.quantity)})`)
        .join(", "),
      l.containers.map((c) => c.code).join(", "),
      qty(l.pendingQuantity),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(";")).join("\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${(documentNumber ?? "PZ").replaceAll("/", "-")}-rozlokowanie.csv`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
  }

  return (
    <section
      className="flex flex-col gap-3 rounded-md border p-4 print:border-0"
      data-testid="receipt-putaway-report"
    >
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-lg font-semibold tracking-tight">{t("title")}</h2>
          <p className="text-muted-foreground text-sm">{t("subtitle")}</p>
        </div>
        <div className="flex items-center gap-2 print:hidden">
          <Badge variant={done ? "default" : "secondary"} data-testid="receipt-report-status">
            {done
              ? t("statusDone")
              : t("statusWaiting", { waiting: qty(waiting), total: qty(total) })}
          </Badge>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={exportCsv}
            data-testid="receipt-report-csv"
          >
            <Download className="mr-2 h-4 w-4" />
            {t("csv")}
          </Button>
          <Button type="button" variant="outline" size="sm" onClick={() => window.print()}>
            <Printer className="mr-2 h-4 w-4" />
            {t("print")}
          </Button>
        </div>
      </div>

      <div className="overflow-x-auto rounded-md border">
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead>{t("columns.sku")}</TableHead>
              <TableHead>{t("columns.name")}</TableHead>
              <TableHead className="text-right">{t("columns.quantity")}</TableHead>
              <TableHead>{t("columns.zl")}</TableHead>
              <TableHead>{t("columns.location")}</TableHead>
              <TableHead>{t("columns.container")}</TableHead>
              <TableHead className="text-right">{t("columns.pending")}</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {lines.map((l) => (
              <TableRow key={l.lineNumber} data-testid="receipt-report-row">
                <TableCell className="font-mono text-xs font-medium">{l.sku}</TableCell>
                <TableCell className="text-sm">{l.productName}</TableCell>
                <TableCell className="text-right font-mono text-xs">
                  {qty(l.quantity)} {l.unitCode}
                </TableCell>
                <TableCell className="font-mono text-xs">{l.zlNumber ?? "—"}</TableCell>
                <TableCell className="text-xs">
                  {l.putaway.length === 0
                    ? "—"
                    : l.putaway.map((p, i) => (
                        <div key={i}>
                          <span className="font-mono">
                            {locLabel(p.locationCode, p.locationName)}
                          </span>{" "}
                          <span className="text-muted-foreground">
                            ({qty(p.quantity)}
                            {p.documentNumber ? ` · ${p.documentNumber}` : ""})
                          </span>
                        </div>
                      ))}
                </TableCell>
                <TableCell className="font-mono text-xs">
                  {l.containers.length === 0 ? "—" : l.containers.map((c) => c.code).join(", ")}
                </TableCell>
                <TableCell
                  className={
                    l.pendingQuantity > 0
                      ? "text-right font-mono text-xs font-semibold text-amber-600"
                      : "text-right font-mono text-xs"
                  }
                >
                  {qty(l.pendingQuantity)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    </section>
  );
}
