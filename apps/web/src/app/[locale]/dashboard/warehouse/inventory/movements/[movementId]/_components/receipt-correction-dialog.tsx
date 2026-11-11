"use client";

import { useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { FileMinus, Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { postReceiptCorrectionAction } from "@/app/actions/warehouse/inventory";

export type CorrectableLine = {
  id: string;
  lineNumber: number;
  sku: string;
  productName: string;
  unitCode: string;
  quantity: number;
  /** Quantity still correctable (line quantity minus earlier posted KPZs). */
  correctable: number;
};

type Props = {
  movementId: string;
  documentNumber: string | null;
  lines: CorrectableLine[];
};

function fmt(value: number) {
  return Number.isInteger(value) ? String(value) : value.toString();
}

/**
 * KPZ -- a correction document linked to this PZ that takes back part of
 * what it brought in (short delivery, wrong or damaged part). The PZ itself
 * stays untouched; the KPZ is listed under it.
 */
export function ReceiptCorrectionDialog({ movementId, documentNumber, lines }: Props) {
  const t = useTranslations("warehouseInventory.movementDetail.correction");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(
    () =>
      lines.map((line) => {
        const raw = (quantities[line.id] ?? "").replace(",", ".").trim();
        const n = raw === "" ? 0 : Number(raw);
        const invalid = !Number.isFinite(n) || n < 0 || n > line.correctable;
        return { line, n, invalid };
      }),
    [lines, quantities]
  );
  const chosen = parsed.filter((p) => !p.invalid && p.n > 0);
  const anyInvalid = parsed.some((p) => p.invalid);
  const canSubmit = chosen.length > 0 && !anyInvalid && reason.trim().length > 0 && !isPending;

  const submit = () => {
    if (!canSubmit) return;
    startTransition(async () => {
      const result = await postReceiptCorrectionAction({
        movement_id: movementId,
        reason: reason.trim(),
        lines: chosen.map((p) => ({ original_line_id: p.line.id, quantity: p.n })),
      });
      if (!result.success || !("data" in result)) {
        const code = (result as { error?: string }).error ?? "unexpected";
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.unexpected"));
        return;
      }
      const data = result.data as { documentNumber: string | null };
      toast.success(t("done", { number: data.documentNumber ?? "" }));
      setOpen(false);
      setQuantities({});
      setReason("");
      router.refresh();
    });
  };

  if (!lines.some((l) => l.correctable > 0)) return null;

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="receipt-correction-open"
      >
        <FileMinus className="mr-1.5 h-3.5 w-3.5" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(640px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>{t("title", { number: documentNumber ?? "—" })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="flex max-h-[55vh] flex-col gap-2 overflow-y-auto">
            {parsed.map(({ line, invalid }) => (
              <div
                key={line.id}
                className="flex items-center gap-3 rounded-md border p-2"
                data-testid="receipt-correction-row"
              >
                <div className="min-w-0 flex-1">
                  <p className="font-mono text-sm font-medium">{line.sku || "—"}</p>
                  <p className="truncate text-xs">{line.productName}</p>
                  <p className="text-muted-foreground text-[11px]">
                    {t("lineInfo", {
                      quantity: fmt(line.quantity),
                      correctable: fmt(line.correctable),
                      unit: line.unitCode,
                    })}
                  </p>
                </div>
                <Input
                  value={quantities[line.id] ?? ""}
                  onChange={(e) => setQuantities((c) => ({ ...c, [line.id]: e.target.value }))}
                  inputMode="decimal"
                  placeholder="0"
                  disabled={line.correctable <= 0}
                  aria-invalid={invalid}
                  aria-label={t("quantity")}
                  className={`w-24 font-mono ${invalid ? "border-destructive" : ""}`}
                  data-testid="receipt-correction-qty"
                />
              </div>
            ))}
          </div>

          <div className="flex flex-col gap-1.5">
            <Label htmlFor="receipt-correction-reason">{t("reason")}</Label>
            <Textarea
              id="receipt-correction-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={2}
              data-testid="receipt-correction-reason"
            />
          </div>

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={submit}
              disabled={!canSubmit}
              data-testid="receipt-correction-confirm"
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("confirm", { count: chosen.length })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
