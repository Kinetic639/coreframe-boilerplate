"use client";

import { useTranslations } from "next-intl";
import { Share, SquarePlus } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

function Key({ children }: { children: React.ReactNode }) {
  return (
    <span className="mx-0.5 inline-flex size-6 items-center justify-center rounded-md border bg-muted align-middle">
      {children}
    </span>
  );
}

/**
 * iPhone / iPad in Safari: push works only in the app added to the Home
 * Screen, and only the user can add it (there is no install prompt).
 */
export function IosInstallDialog({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("notificationCenter.push.ios");
  const steps = [
    t.rich("step1", {
      b: (chunks) => <b>{chunks}</b>,
      icon: () => (
        <Key>
          <Share className="size-3.5 text-blue-500" aria-hidden />
        </Key>
      ),
    }),
    t.rich("step2", {
      b: (chunks) => <b>{chunks}</b>,
      icon: () => (
        <Key>
          <SquarePlus className="size-3.5" aria-hidden />
        </Key>
      ),
    }),
    t("step3"),
  ];

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md" data-testid="ios-install-dialog">
        <DialogHeader className="flex-row items-center gap-3 space-y-0 text-left">
          {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
          <img
            src="/pwa/icon-192.png"
            alt=""
            className="size-11 shrink-0 rounded-[11px] border"
            width={44}
            height={44}
          />
          <div className="space-y-1">
            <DialogTitle>{t("title")}</DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </div>
        </DialogHeader>
        <ol className="space-y-3 text-sm">
          {steps.map((step, index) => (
            <li key={index} className="flex items-start gap-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-accent text-xs font-semibold text-accent-foreground">
                {index + 1}
              </span>
              <span className="pt-0.5 leading-6">{step}</span>
            </li>
          ))}
        </ol>
        <DialogFooter>
          <Button variant="outline" className="w-full" onClick={() => onOpenChange(false)}>
            {t("close")}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
