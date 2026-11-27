"use client";

import { useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { BellRing, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PUSH_PROMPT_DISMISSED_KEY } from "@/lib/push/client";
import { usePwaStore } from "@/lib/stores/v2/pwa-store";
import { IosInstallDialog } from "./ios-install-dialog";
import { announcePushResult } from "./push-result-toast";

function readDismissed(): boolean {
  try {
    return localStorage.getItem(PUSH_PROMPT_DISMISSED_KEY) === "1";
  } catch {
    return false;
  }
}

/**
 * One-time invitation in the notifications drawer to turn on push on this
 * device. Closing it (either button) hides it for good on this device;
 * Konto → Powiadomienia keeps the switch.
 */
export function PushPrompt() {
  const t = useTranslations("notificationCenter.push");
  const pushState = usePwaStore((s) => s.pushState);
  const busy = usePwaStore((s) => s.busy);
  const enable = usePwaStore((s) => s.enable);
  const [dismissed, setDismissed] = useState(true);
  const [iosOpen, setIosOpen] = useState(false);

  useEffect(() => setDismissed(readDismissed()), []);

  const dismiss = () => {
    setDismissed(true);
    try {
      localStorage.setItem(PUSH_PROMPT_DISMISSED_KEY, "1");
    } catch {
      // Private mode: it shows again next time, nothing worse
    }
  };

  const visible = !dismissed && (pushState === "off" || pushState === "ios-install");
  if (!visible && !iosOpen) return null;

  return (
    <>
      {visible ? (
        <div
          className="m-2.5 rounded-lg border border-primary/35 bg-primary/10 p-3"
          data-testid="push-prompt"
        >
          <div className="flex items-start gap-2">
            <BellRing className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold">{t("prompt.title")}</p>
              <p className="mt-0.5 text-xs text-muted-foreground">{t("prompt.body")}</p>
            </div>
            <button
              type="button"
              onClick={dismiss}
              aria-label={t("prompt.close")}
              className="-mr-1 -mt-1 flex size-7 items-center justify-center rounded-md text-muted-foreground hover:bg-muted"
            >
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-2.5 flex gap-2 pl-6">
            <Button
              size="sm"
              disabled={busy}
              onClick={async () => {
                if (pushState === "ios-install") {
                  setIosOpen(true);
                  return;
                }
                const result = await enable();
                announcePushResult(result, t);
                if (result === "on" || result === "denied") dismiss();
              }}
            >
              {t("prompt.enable")}
            </Button>
            <Button size="sm" variant="ghost" onClick={dismiss}>
              {t("prompt.later")}
            </Button>
          </div>
        </div>
      ) : null}
      <IosInstallDialog open={iosOpen} onOpenChange={setIosOpen} />
    </>
  );
}
