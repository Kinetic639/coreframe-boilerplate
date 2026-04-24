import { cn } from "@/utils";

interface BrandWordmarkProps {
  size?: "sm" | "md" | "lg" | "hero";
  subtitle?: boolean;
  className?: string;
  align?: "left" | "center";
}

const WORDMARK_STYLES = {
  sm: {
    brand: "text-lg font-semibold tracking-[0.02em]",
    subtitle: "text-[0.4rem] tracking-[0.28em]",
    gap: "-mt-0.5",
  },
  md: {
    brand: "text-[1.35rem] font-semibold tracking-[0.02em]",
    subtitle: "text-[0.42rem] tracking-[0.28em]",
    gap: "-mt-0.5",
  },
  lg: {
    brand: "text-[1.8rem] font-semibold tracking-[0.025em]",
    subtitle: "text-[0.52rem] tracking-[0.34em]",
    gap: "-mt-1",
  },
  hero: {
    brand: "text-[2.75rem] font-semibold tracking-[0.03em] md:text-[3.5rem]",
    subtitle: "text-[0.6rem] tracking-[0.42em] md:text-[0.72rem]",
    gap: "-mt-1.5",
  },
} as const;

export function BrandWordmark({
  size = "md",
  subtitle = true,
  className,
  align = "left",
}: BrandWordmarkProps) {
  const styles = WORDMARK_STYLES[size];

  return (
    <span
      className={cn(
        "flex flex-col leading-none",
        align === "center" ? "items-center text-center" : "items-start text-left",
        className
      )}
    >
      <span className={cn("text-foreground", styles.brand)}>
        <span className="text-amber-600">A</span>mbra
      </span>
      {subtitle ? (
        <span
          className={cn(
            "font-semibold uppercase text-muted-foreground/80",
            styles.subtitle,
            styles.gap
          )}
        >
          System
        </span>
      ) : null}
    </span>
  );
}
