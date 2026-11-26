"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { compareVersions } from "@repo/app-version";
import { Button } from "@/components/ui/button";
import { BUILD_COMMIT, BUILD_VERSION } from "@/lib/app-version";
import { WhatsNewDialog } from "./whats-new-dialog";
import { useWhatsNewStore } from "./whats-new-store";

/** How often an open tab asks whether a newer version was deployed. */
export const VERSION_POLL_MS = 5 * 60_000;
/** Returning to the tab checks too, but not more often than this. */
const MIN_CHECK_GAP_MS = 60_000;
export const LAST_SEEN_VERSION_KEY = "ambra.lastSeenVersion";

function readLastSeen(): string | null {
  try {
    return window.localStorage.getItem(LAST_SEEN_VERSION_KEY);
  } catch {
    return null;
  }
}

function writeLastSeen(version: string) {
  try {
    window.localStorage.setItem(LAST_SEEN_VERSION_KEY, version);
  } catch {
    // Private mode or blocked storage: the "updated" note just shows again next time.
  }
}

/**
 * Mounted once per app shell: the "What's new" window, a note after the app was updated,
 * and a request to reload when a newer version was deployed while the tab was open.
 */
export function AppVersionHost() {
  const t = useTranslations("appVersion");
  const open = useWhatsNewStore((s) => s.open);
  const setOpen = useWhatsNewStore((s) => s.setOpen);
  const tRef = useRef(t);
  tRef.current = t;

  // After an update: one note with a link to the changes.
  useEffect(() => {
    const lastSeen = readLastSeen();
    writeLastSeen(BUILD_VERSION);
    if (!lastSeen || compareVersions(BUILD_VERSION, lastSeen) <= 0) return;
    toast.info(
      <div className="flex flex-col gap-2">
        <span>{tRef.current("updated", { version: BUILD_VERSION })}</span>
        <Button
          size="sm"
          variant="outline"
          className="self-start"
          onClick={() => useWhatsNewStore.getState().setOpen(true)}
        >
          {tRef.current("seeChanges")}
        </Button>
      </div>,
      { toastId: "app-version-updated", autoClose: 15_000 }
    );
  }, []);

  // While the tab is open: compare with the deployment that answers now.
  useEffect(() => {
    if (!BUILD_COMMIT) return; // Local runs have no commit to compare.
    let notified = false;
    let lastCheck = 0;

    const check = async () => {
      if (notified || Date.now() - lastCheck < MIN_CHECK_GAP_MS) return;
      lastCheck = Date.now();
      try {
        const res = await fetch("/api/version", { cache: "no-store" });
        if (!res.ok) return;
        const data = (await res.json()) as { version?: string; commit?: string | null };
        if (!data.commit || data.commit === BUILD_COMMIT) return;
        notified = true;
        const newer = data.version && data.version !== BUILD_VERSION ? data.version : null;
        toast.info(
          <div className="flex flex-col gap-2">
            <span>
              {newer
                ? tRef.current("updateAvailableVersion", { version: newer })
                : tRef.current("updateAvailable")}
            </span>
            <Button size="sm" className="self-start" onClick={() => window.location.reload()}>
              {tRef.current("reload")}
            </Button>
          </div>,
          { toastId: "app-version-available", autoClose: false, closeOnClick: false }
        );
      } catch {
        // Offline or a failed request: try again at the next check.
      }
    };

    const onVisible = () => {
      if (document.visibilityState === "visible") void check();
    };
    const timer = window.setInterval(() => void check(), VERSION_POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, []);

  return <WhatsNewDialog open={open} onOpenChange={setOpen} />;
}
