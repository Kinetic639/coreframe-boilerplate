"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2, Undo2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { reverseMovementAction } from "@/app/actions/warehouse/inventory";

type Props = {
  movementId: string;
  documentNumber: string | null;
};

/**
 * Storno: posts a 900 that takes back every line of this movement, as if
 * it never happened. The original stays in history marked as reversed.
 */
export function MovementReverseDialog({ movementId, documentNumber }: Props) {
  const t = useTranslations("warehouseInventory.movementDetail.reverse");
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [isPending, startTransition] = useTransition();

  const submit = () => {
    if (!reason.trim()) return;
    startTransition(async () => {
      const result = await reverseMovementAction({ id: movementId, reason: reason.trim() });
      if (!result.success || !("data" in result)) {
        const code = (result as { error?: string }).error ?? "unexpected";
        toast.error(t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.unexpected"));
        return;
      }
      const data = result.data as { reversalDocumentNumber: string | null };
      toast.success(t("done", { number: data.reversalDocumentNumber ?? "" }));
      setOpen(false);
      setReason("");
      router.refresh();
    });
  };

  return (
    <>
      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={() => setOpen(true)}
        data-testid="movement-reverse-open"
      >
        <Undo2 className="mr-1.5 h-3.5 w-3.5" />
        {t("open")}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="w-[min(480px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
          <DialogHeader>
            <DialogTitle>{t("title", { number: documentNumber ?? "—" })}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="movement-reverse-reason">{t("reason")}</Label>
            <Textarea
              id="movement-reverse-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder={t("reasonPlaceholder")}
              rows={3}
              data-testid="movement-reverse-reason"
            />
          </div>
          <div className="flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Button type="button" variant="ghost" onClick={() => setOpen(false)}>
              {t("cancel")}
            </Button>
            <Button
              type="button"
              variant="destructive"
              onClick={submit}
              disabled={!reason.trim() || isPending}
              data-testid="movement-reverse-confirm"
            >
              {isPending && <Loader2 className="mr-1.5 h-3.5 w-3.5 animate-spin" />}
              {t("confirm")}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
