"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { PackageCheck } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  issueRepairOrderPartsAction,
  listRepairOrderIssueCandidatesAction,
} from "@/app/actions/workshop/issue";
import type { IssueCandidate } from "@/server/services/repair-order-issue.service";

type Props = {
  repairOrderId: string;
  zlNumber: string | null;
  canOperate: boolean;
};

type Selection = Record<string, { checked: boolean; quantity: string }>;

function key(c: IssueCandidate) {
  return `${c.kind}:${c.sourceId}`;
}

function qty(value: number) {
  return Number.isInteger(value) ? String(value) : value.toString();
}

function locLabel(c: IssueCandidate) {
  if (!c.location) return "—";
  return c.location.code && c.location.name
    ? `${c.location.code} · ${c.location.name}`
    : (c.location.code ?? c.location.name ?? "—");
}

/**
 * Phase 10F: issue parts to the technician on one RW (rozchód wewnętrzny,
 * 261 -- AutoStacja's WU). "Do przygotowania" are the parts in this
 * order's containers (handed over physically); "Do odhaczenia" is material
 * reserved at a location -- bulk clips etc. that the mechanics take
 * themselves -- ticked off on the same document, as in today's workflow.
 */
export function RepairOrderIssue({ repairOrderId, zlNumber, canOperate }: Props) {
  const t = useTranslations("modules.workshop.repairOrders.issue");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [candidates, setCandidates] = useState<IssueCandidate[]>([]);
  const [selection, setSelection] = useState<Selection>({});
  const [recipient, setRecipient] = useState("");
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  // Keep the load effect keyed on the order only, not on the translator.
  const loadErrorMessage = useRef(t("loadError"));
  loadErrorMessage.current = t("loadError");

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoading(true);
    listRepairOrderIssueCandidatesAction(repairOrderId)
      .then((result) => {
        if (cancelled) return;
        if (!result.success) {
          toast.error(loadErrorMessage.current);
          setCandidates([]);
          return;
        }
        setCandidates(result.data);
        setSelection(
          Object.fromEntries(
            result.data.map((c) => [key(c), { checked: true, quantity: qty(c.outstanding) }])
          )
        );
      })
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [open, repairOrderId]);

  const prepare = candidates.filter((c) => c.kind === "allocation");
  const tickOff = candidates.filter((c) => c.kind === "reservation");

  const chosen = useMemo(
    () =>
      candidates.flatMap((c) => {
        const sel = selection[key(c)];
        const n = Number((sel?.quantity ?? "").replace(",", "."));
        return sel?.checked && Number.isFinite(n) && n > 0 && n <= c.outstanding
          ? [{ c, quantity: n }]
          : [];
      }),
    [candidates, selection]
  );
  const invalidQty = candidates.some((c) => {
    const sel = selection[key(c)];
    if (!sel?.checked) return false;
    const n = Number(sel.quantity.replace(",", "."));
    return !Number.isFinite(n) || n <= 0 || n > c.outstanding;
  });
  const canSubmit = chosen.length > 0 && !invalidQty && recipient.trim().length > 0 && !submitting;

  function update(c: IssueCandidate, patch: Partial<{ checked: boolean; quantity: string }>) {
    setSelection((prev) => ({ ...prev, [key(c)]: { ...prev[key(c)], ...patch } }));
  }

  async function handleIssue() {
    if (!canSubmit) return;
    setSubmitting(true);
    try {
      const result = await issueRepairOrderPartsAction({
        repairOrderId,
        recipient: recipient.trim(),
        note: note.trim() || null,
        lines: chosen.map(({ c, quantity }) => ({
          kind: c.kind,
          sourceId: c.sourceId,
          repairOrderLineId: c.repairOrderLineId,
          quantity,
        })),
      });
      if (!result.success) {
        const code = (result as { success: false; error: string }).error;
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.unexpected"));
        return;
      }
      toast.success(t("issued", { number: result.data.documentNumber ?? "" }));
      setOpen(false);
      setRecipient("");
      setNote("");
      router.refresh();
    } catch {
      toast.error(t("errors.unexpected"));
    } finally {
      setSubmitting(false);
    }
  }

  function renderRow(c: IssueCandidate) {
    const sel = selection[key(c)] ?? { checked: false, quantity: "" };
    return (
      <div
        key={key(c)}
        className="border-border flex items-center gap-3 rounded-md border p-2"
        data-testid="issue-row"
      >
        <Checkbox
          checked={sel.checked}
          onCheckedChange={(v) => update(c, { checked: v === true })}
          aria-label={c.sku ?? c.productCode ?? ""}
          data-testid="issue-row-check"
        />
        <div className="min-w-0 flex-1">
          <p className="font-mono text-sm font-medium">{c.sku ?? c.productCode ?? "—"}</p>
          <p className="truncate text-xs">{c.productName ?? ""}</p>
          <p className="text-muted-foreground text-[11px]">
            {c.containers.length > 0
              ? t("fromContainers", { containers: c.containers.join(", "), location: locLabel(c) })
              : t("fromLocation", { location: locLabel(c) })}
          </p>
        </div>
        <Input
          value={sel.quantity}
          onChange={(e) => update(c, { quantity: e.target.value })}
          inputMode="decimal"
          className="w-20 font-mono"
          aria-label={t("quantity")}
          data-testid="issue-row-qty"
        />
        <span className="text-muted-foreground w-12 text-xs">/ {qty(c.outstanding)}</span>
      </div>
    );
  }

  if (!canOperate) return null;

  return (
    <>
      <div className="flex justify-end">
        <Button type="button" onClick={() => setOpen(true)} data-testid="issue-open">
          <PackageCheck className="mr-2 h-4 w-4" />
          {t("open")}
        </Button>
      </div>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(560px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>{t("title", { zl: zlNumber ?? "—" })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          {loading ? (
            <p className="text-muted-foreground text-sm">{t("loading")}</p>
          ) : candidates.length === 0 ? (
            <p className="text-muted-foreground text-sm" data-testid="issue-empty">
              {t("empty")}
            </p>
          ) : (
            <div className="flex max-h-[60vh] flex-col gap-4 overflow-y-auto">
              {prepare.length > 0 && (
                <section className="flex flex-col gap-2" data-testid="issue-group-prepare">
                  <h3 className="text-sm font-semibold">{t("groupPrepare")}</h3>
                  {prepare.map(renderRow)}
                </section>
              )}
              {tickOff.length > 0 && (
                <section className="flex flex-col gap-2" data-testid="issue-group-tickoff">
                  <h3 className="text-sm font-semibold">{t("groupTickOff")}</h3>
                  <p className="text-muted-foreground text-xs">{t("groupTickOffHint")}</p>
                  {tickOff.map(renderRow)}
                </section>
              )}

              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-recipient">{t("recipient")}</Label>
                <Input
                  id="issue-recipient"
                  value={recipient}
                  onChange={(e) => setRecipient(e.target.value)}
                  placeholder={t("recipientPlaceholder")}
                  data-testid="issue-recipient"
                />
              </div>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="issue-note">{t("note")}</Label>
                <Textarea
                  id="issue-note"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  rows={2}
                />
              </div>
            </div>
          )}

          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              onClick={handleIssue}
              disabled={!canSubmit}
              data-testid="issue-confirm"
            >
              {submitting ? t("issuing") : t("confirm", { count: chosen.length })}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
