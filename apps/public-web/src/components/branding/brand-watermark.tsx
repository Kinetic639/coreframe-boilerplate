import { BrandLogoMark } from "./brand-logo-mark";
import { cn } from "@/utils";

interface BrandWatermarkProps {
  className?: string;
}

export function BrandWatermark({ className }: BrandWatermarkProps) {
  return (
    <div
      aria-hidden="true"
      className={cn("pointer-events-none select-none opacity-[0.08] grayscale", className)}
    >
      <div className="flex items-center gap-5 text-black">
        <BrandLogoMark size="xl" className="opacity-80 contrast-125 grayscale" />
        <div className="flex flex-col items-start leading-none">
          <span className="text-3xl font-semibold uppercase tracking-[0.18em]">Ambra</span>
          <span className="-mt-1 text-[0.48rem] font-semibold uppercase tracking-[0.42em] text-black/70">
            System
          </span>
        </div>
      </div>
    </div>
  );
}
