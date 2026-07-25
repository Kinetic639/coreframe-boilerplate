import type { ReactNode } from "react";
import { cn } from "@/utils";
import { BrandLockup } from "./brand-lockup";

interface BrandBannerProps {
  eyebrow?: string;
  title: string;
  description?: string;
  children?: ReactNode;
  className?: string;
  compact?: boolean;
}

export function BrandBanner({
  eyebrow = "Ambra Brand System",
  title,
  description,
  children,
  className,
  compact = false,
}: BrandBannerProps) {
  return (
    <div
      className={cn(
        "overflow-hidden rounded-3xl border border-amber-200/70 bg-[linear-gradient(135deg,rgba(255,251,235,0.95),rgba(255,255,255,1)_48%,rgba(254,243,199,0.85))] p-6 shadow-sm",
        compact ? "p-5" : "p-7 md:p-9",
        className
      )}
    >
      <div className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
        <div className="space-y-4">
          <div className="inline-flex rounded-full border border-amber-300/80 bg-white/80 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.22em] text-amber-700">
            {eyebrow}
          </div>
          <BrandLockup size={compact ? "md" : "lg"} />
          <div className="max-w-2xl space-y-2">
            <h2
              className={cn(
                "font-semibold tracking-tight text-slate-950",
                compact ? "text-2xl" : "text-3xl md:text-4xl"
              )}
            >
              {title}
            </h2>
            {description ? (
              <p className="max-w-xl text-sm leading-6 text-slate-600 md:text-base">
                {description}
              </p>
            ) : null}
          </div>
        </div>
        {children ? <div className="shrink-0">{children}</div> : null}
      </div>
    </div>
  );
}
