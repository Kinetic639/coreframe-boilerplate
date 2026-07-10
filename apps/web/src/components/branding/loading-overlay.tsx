"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { BrandLoader } from "./brand-loader";

interface LoadingOverlayProps {
  visible: boolean;
  /** Same text shown on the button that triggered this overlay (e.g. its
   * "Uruchamianie..." / "Launching..." loading label) — keeps the overlay
   * and the button it grew out of telling the same story. */
  label: string;
}

/**
 * Full-app blocking overlay for slow, navigation-ending actions (launch
 * audit, submit for review, bulk-approve, post & book). A disabled button
 * alone still lets an impatient user keep clicking elsewhere while they
 * wait — this covers the whole screen so there's nothing left to click, and
 * makes unmistakably clear that something is happening. Portaled to
 * document.body so it sits above the dashboard shell/sidebar, not just the
 * screen's own content column.
 */
export function LoadingOverlay({ visible, label }: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[9990] flex items-center justify-center bg-background/70 backdrop-blur-md"
    >
      <BrandLoader
        variant="beacon_swap"
        label={label}
        showWordmark
        className="scale-150"
        logoClassName="h-20 w-20"
      />
    </div>,
    document.body
  );
}
