"use client";

import { useEffect, useRef, useState } from "react";
import { useIsMutating } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Check, Loader2 } from "lucide-react";

/** Saves shorter than this show nothing, so quick ones do not flicker. */
const SHOW_AFTER_MS = 400;
const SAVED_FOR_MS = 2000;

/**
 * Says whether changes are still being saved. Every change shows on screen
 * at once (optimistic), so this is the one place that tells the user the
 * server has caught up.
 */
export function SaveIndicator() {
  const t = useTranslations("modules.planning.boards.save");
  const saving = useIsMutating() > 0;
  const [state, setState] = useState<"idle" | "saving" | "saved">("idle");
  const shown = useRef(false);

  useEffect(() => {
    if (saving) {
      const timer = window.setTimeout(() => {
        shown.current = true;
        setState("saving");
      }, SHOW_AFTER_MS);
      return () => window.clearTimeout(timer);
    }
    if (!shown.current) return;
    shown.current = false;
    setState("saved");
    const timer = window.setTimeout(() => setState("idle"), SAVED_FOR_MS);
    return () => window.clearTimeout(timer);
  }, [saving]);

  if (state === "idle") return null;
  return (
    <span
      role="status"
      aria-live="polite"
      className="text-muted-foreground flex items-center gap-1.5 text-xs"
    >
      {state === "saving" ? (
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
      ) : (
        <Check className="h-3.5 w-3.5" />
      )}
      {state === "saving" ? t("saving") : t("saved")}
    </span>
  );
}
