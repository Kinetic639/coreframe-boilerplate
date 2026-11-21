"use client";

import { useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { getQrSettingsAction, saveQrSettingsAction } from "@/app/actions/qr/registry";

/** The organization's QR settings: when unused codes expire. */
export function QrSettingsDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("modules.qr.management.registry");
  const [days, setDays] = useState<string>("");
  const [isSaving, startSave] = useTransition();

  useEffect(() => {
    if (!open) return;
    let live = true;
    getQrSettingsAction().then((result) => {
      if (live && result.success) setDays(String(result.data.unused_expiry_days));
    });
    return () => {
      live = false;
    };
  }, [open]);

  const value = Number(days);
  const valid = days.trim() !== "" && Number.isInteger(value) && value >= 0 && value <= 3650;

  function save() {
    if (!valid) return;
    startSave(async () => {
      const result = await saveQrSettingsAction({ unused_expiry_days: value });
      if (result.success) {
        toast.success(t("saved"));
        onOpenChange(false);
      } else {
        toast.error((result as { success: false; error: string }).error);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("settingsTitle")}</DialogTitle>
          <DialogDescription>{t("settingsDescription")}</DialogDescription>
        </DialogHeader>
        <form
          className="flex flex-col gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            save();
          }}
        >
          <Label htmlFor="qr-expiry-days">{t("expiryDays")}</Label>
          <Input
            id="qr-expiry-days"
            type="number"
            inputMode="numeric"
            min={0}
            max={3650}
            value={days}
            onChange={(event) => setDays(event.target.value)}
            disabled={isSaving}
            className="w-32"
          />
          <DialogFooter className="mt-4">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("cancel")}
            </Button>
            <Button type="submit" disabled={!valid || isSaving}>
              {t("save")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
