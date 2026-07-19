"use client";

import { cn } from "./utils";

const LOGO_SIZE = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
} as const;

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

const LOGO_SIZE_BY_LOCKUP = {
  sm: "sm",
  md: "md",
  lg: "lg",
  hero: "xl",
} as const;

const GAP_BY_LOCKUP = {
  sm: "gap-2",
  md: "gap-2.5",
  lg: "gap-3.5",
  hero: "gap-4.5",
} as const;

export type BrandLogoSize = keyof typeof LOGO_SIZE;
export type BrandLockupSize = keyof typeof LOGO_SIZE_BY_LOCKUP;

export interface BrandLogoMarkProps {
  size?: BrandLogoSize;
  className?: string;
  priority?: boolean;
}

export function BrandLogoMark({ size = "md", className }: BrandLogoMarkProps) {
  const px = LOGO_SIZE[size];

  return (
    <img
      src="/branding/ambra-crystal-floating.svg"
      alt="Ambra logo"
      width={px}
      height={px}
      className={cn("shrink-0", className)}
    />
  );
}

export function BrandLogoMarkHover({ size = "md", className }: BrandLogoMarkProps) {
  const px = LOGO_SIZE[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("ambra-logo-hover shrink-0", className)}
      aria-hidden="true"
    >
      <path
        className="ambra-logo-arm ambra-logo-arm-left"
        d="M28 5 L5 53 L16 53 L28 29 Z"
        fill="#B45309"
      />
      <path
        className="ambra-logo-arm ambra-logo-arm-right"
        d="M28 5 L51 53 L40 53 L28 29 Z"
        fill="#F59E0B"
      />
      <path className="ambra-logo-core" d="M28 7.5 L22 20 L28 29 L34 20 Z" fill="#FBBF24" />
      <path
        className="ambra-logo-chevron"
        d="M14 34 L28 51 L42 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
      />
      <path
        className="ambra-logo-beacon"
        d="M28 51 L14 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        pathLength="1"
      />
      <path
        className="ambra-logo-beacon"
        d="M28 51 L42 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        pathLength="1"
      />
    </svg>
  );
}

export interface BrandWordmarkProps {
  size?: BrandLockupSize;
  subtitle?: string | false;
  className?: string;
  align?: "left" | "center";
}

export function BrandWordmark({
  size = "md",
  subtitle = "System",
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
        <span className="sr-only">Ambra</span>
        <span aria-hidden="true">
          <span className="text-amber-500">A</span>mbra
        </span>
      </span>
      {subtitle ? (
        <span
          className={cn(
            "font-semibold uppercase text-muted-foreground/80",
            styles.subtitle,
            styles.gap
          )}
        >
          {subtitle}
        </span>
      ) : null}
    </span>
  );
}

export interface BrandLockupProps {
  size?: BrandLockupSize;
  className?: string;
  align?: "left" | "center";
  subtitle?: string | false;
  showSubtitle?: boolean;
  showLogo?: boolean;
  hoverAnimation?: boolean;
}

export function BrandLockup({
  size = "md",
  className,
  align = "left",
  subtitle = "System",
  showSubtitle = true,
  showLogo = true,
  hoverAnimation = false,
}: BrandLockupProps) {
  return (
    <div
      className={cn(
        "flex items-center",
        GAP_BY_LOCKUP[size],
        align === "center" ? "justify-center" : "justify-start",
        className
      )}
    >
      {showLogo ? (
        hoverAnimation ? (
          <BrandLogoMarkHover size={LOGO_SIZE_BY_LOCKUP[size]} />
        ) : (
          <BrandLogoMark size={LOGO_SIZE_BY_LOCKUP[size]} />
        )
      ) : null}
      <BrandWordmark size={size} subtitle={showSubtitle ? subtitle : false} align={align} />
    </div>
  );
}
