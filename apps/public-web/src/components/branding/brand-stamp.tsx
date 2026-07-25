import { cn } from "@/utils";
import { BrandLogoMark } from "./brand-logo-mark";

type StampSize = "sm" | "md" | "lg";

interface BrandStampProps {
  size?: StampSize;
  className?: string;
}

interface BrandStampLockupProps extends BrandStampProps {
  align?: "left" | "center";
}

const STAMP_STYLES = {
  sm: {
    wrap: "gap-2",
    logo: "sm",
    brand: "text-[0.78rem] tracking-[0.12em]",
    system: "text-[0.34rem] tracking-[0.26em] -mt-0.5",
  },
  md: {
    wrap: "gap-2.5",
    logo: "md",
    brand: "text-[0.96rem] tracking-[0.14em]",
    system: "text-[0.38rem] tracking-[0.28em] -mt-0.5",
  },
  lg: {
    wrap: "gap-3",
    logo: "lg",
    brand: "text-[1.12rem] tracking-[0.15em]",
    system: "text-[0.44rem] tracking-[0.3em] -mt-0.5",
  },
} as const;

const LOGO_ONLY_STYLES = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

const PURE_BW_STYLES = {
  sm: "h-7 w-7",
  md: "h-9 w-9",
  lg: "h-12 w-12",
} as const;

function PureBlackWhiteLogo({ size = "md", className }: BrandStampProps) {
  return (
    <svg
      viewBox="0 0 56 56"
      aria-hidden="true"
      className={cn("shrink-0", PURE_BW_STYLES[size], className)}
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M28 5 L5 53 L16 53 L28 29 Z" fill="#000000" />
      <path d="M28 5 L51 53 L40 53 L28 29 Z" fill="#000000" />
      <path d="M28 7.5 L22 20 L28 29 L34 20 Z" fill="#ffffff" />
      <path
        d="M10.3 29.6 L13.1 33 M42.9 33 L45.7 29.6"
        stroke="#000000"
        strokeWidth="2"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14 34 L28 51 L42 34"
        stroke="#000000"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
      <path
        d="M14.4 34.5 L20.9 42.2 M35.1 42.2 L41.6 34.5"
        stroke="#ffffff"
        strokeWidth="1.45"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
      />
    </svg>
  );
}

export function BrandStamp({ size = "md", className }: BrandStampProps) {
  const styles = STAMP_STYLES[size];

  return (
    <div
      aria-hidden="true"
      className={cn("inline-flex items-center text-black grayscale", styles.wrap, className)}
    >
      <BrandLogoMark size={styles.logo} className="shrink-0 opacity-90 contrast-125 grayscale" />
      <div className="flex flex-col items-start leading-none">
        <span className={cn("font-semibold uppercase", styles.brand)}>Ambra</span>
        <span className={cn("font-semibold uppercase text-black/72", styles.system)}>System</span>
      </div>
    </div>
  );
}

export function BrandStampLogoOnly({ size = "md", className }: BrandStampProps) {
  return (
    <BrandLogoMark
      size={size}
      className={cn(
        "shrink-0 opacity-90 contrast-125 grayscale",
        LOGO_ONLY_STYLES[size],
        className
      )}
    />
  );
}

export function BrandStampPureBw({ size = "md", className }: BrandStampProps) {
  return <PureBlackWhiteLogo size={size} className={className} />;
}

export function BrandStampLockup({
  size = "md",
  className,
  align = "left",
}: BrandStampLockupProps) {
  const styles = STAMP_STYLES[size];

  return (
    <div
      className={cn(
        "inline-flex items-center text-black grayscale",
        styles.wrap,
        align === "center" ? "justify-center" : "justify-start",
        className
      )}
    >
      <BrandStampLogoOnly size={size} />
      <div
        className={cn(
          "flex flex-col leading-none",
          align === "center" ? "items-center text-center" : "items-start text-left"
        )}
      >
        <span className={cn("font-semibold uppercase", styles.brand)}>Ambra</span>
        <span className={cn("font-semibold uppercase text-black/72", styles.system)}>System</span>
      </div>
    </div>
  );
}

export function BrandStampPureBwLockup({
  size = "md",
  className,
  align = "left",
}: BrandStampLockupProps) {
  const styles = STAMP_STYLES[size];

  return (
    <div
      className={cn(
        "inline-flex items-center text-black",
        styles.wrap,
        align === "center" ? "justify-center" : "justify-start",
        className
      )}
    >
      <BrandStampPureBw size={size} />
      <div
        className={cn(
          "flex flex-col leading-none",
          align === "center" ? "items-center text-center" : "items-start text-left"
        )}
      >
        <span className={cn("font-semibold uppercase", styles.brand)}>Ambra</span>
        <span className={cn("font-semibold uppercase text-black/72", styles.system)}>System</span>
      </div>
    </div>
  );
}
