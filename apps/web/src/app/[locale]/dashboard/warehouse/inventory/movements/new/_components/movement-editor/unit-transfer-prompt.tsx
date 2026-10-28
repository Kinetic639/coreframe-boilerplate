"use client";

import { useTranslations } from "next-intl";
import { Loader2, Send } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

/**
 * Sending an MMJ-, worded as in AutoStacja: the goods move to another unit
 * and the receiving warehouse gets an MMJ+ "w drodze". "Nie — wstrzymaj"
 * keeps it as a draft (parts reserved, nothing sent, no number).
 */
export function UnitTransferPrompt({
  open,
  isPending,
  onSend,
  onHold,
  onCancel,
}: {
  open: boolean;
  isPending: boolean;
  onSend: () => void;
  onHold: () => void;
  onCancel: () => void;
}) {
  const t = useTranslations("warehouseInventory.movementEditor");
  return (
    <Dialog open={open} onOpenChange={(o) => !o && !isPending && onCancel()}>
      <DialogContent data-testid="unit-transfer-prompt">
        <DialogHeader>
          <DialogTitle>{t("unitTransferTitle")}</DialogTitle>
          <DialogDescription>{t("unitTransferNotice")}</DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2 sm:gap-0">
          <Button type="button" variant="outline" onClick={onHold} disabled={isPending}>
            {t("unitTransferHold")}
          </Button>
          <Button
            type="button"
            onClick={onSend}
            disabled={isPending}
            data-testid="unit-transfer-send"
          >
            {isPending ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <Send className="mr-2 h-4 w-4" />
            )}
            {t("unitTransferSend")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
