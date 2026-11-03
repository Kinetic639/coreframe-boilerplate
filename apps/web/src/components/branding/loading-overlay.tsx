"use client";

import { useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { Check, Circle, Loader2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { BrandLoader } from "./brand-loader";

export type LoadingOverlayStep = {
  key: string;
  label: string;
  status: "done" | "active" | "pending";
};

interface LoadingOverlayProps {
  visible: boolean;
  /** Same text shown on the button that triggered this overlay (e.g. its
   * "Uruchamianie..." / "Launching..." loading label) — keeps the overlay
   * and the button it grew out of telling the same story. */
  label: string;
  /** Optional progress tracker under the logo: what is done, what runs now. */
  steps?: LoadingOverlayStep[];
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
export function LoadingOverlay({ visible, label, steps }: LoadingOverlayProps) {
  const [mounted, setMounted] = useState(false);
  useEffect(() => setMounted(true), []);

  if (!mounted || !visible) return null;

  return createPortal(
    <div
      role="status"
      aria-live="polite"
      className="fixed inset-0 z-[var(--z-loading-overlay)] flex items-center justify-center bg-background/70 backdrop-blur-md"
    >
      <div className="flex flex-col items-center gap-14 px-4">
        <BrandLoader
          variant="beacon_swap"
          label={label}
          showWordmark
          className="scale-150"
          logoClassName="h-20 w-20"
        />
        {steps && steps.length > 0 && (
          <ol className="w-full max-w-sm space-y-2.5" data-testid="loading-overlay-steps">
            {steps.map((step) => (
              <li
                key={step.key}
                data-status={step.status}
                className={cn(
                  "flex items-center gap-2.5 text-sm transition-colors",
                  step.status === "pending" && "text-muted-foreground",
                  step.status === "active" && "font-medium text-foreground",
                  step.status === "done" && "text-foreground"
                )}
              >
                {step.status === "done" ? (
                  <Check className="h-4 w-4 shrink-0 text-primary" />
                ) : step.status === "active" ? (
                  <Loader2 className="h-4 w-4 shrink-0 animate-spin text-primary" />
                ) : (
                  <Circle className="h-4 w-4 shrink-0 opacity-40" />
                )}
                {step.label}
              </li>
            ))}
          </ol>
        )}
      </div>
    </div>,
    document.body
  );
}
