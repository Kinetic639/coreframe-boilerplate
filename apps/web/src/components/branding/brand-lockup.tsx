import { cn } from "@/utils";
import { BrandLogoMark } from "./brand-logo-mark";
import { BrandLogoMarkHover } from "./brand-logo-mark-hover";
import { BrandWordmark } from "./brand-wordmark";

interface BrandLockupProps {
  size?: "sm" | "md" | "lg" | "hero";
  className?: string;
  align?: "left" | "center";
  showSubtitle?: boolean;
  showLogo?: boolean;
  hoverAnimation?: boolean;
}

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

export function BrandLockup({
  size = "md",
  className,
  align = "left",
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
          <BrandLogoMark size={LOGO_SIZE_BY_LOCKUP[size]} priority={size === "hero"} />
        )
      ) : null}
      <BrandWordmark size={size} subtitle={showSubtitle} align={align} />
    </div>
  );
}
