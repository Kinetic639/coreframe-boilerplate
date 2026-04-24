import Image from "next/image";
import { cn } from "@/utils";

interface BrandLogoMarkProps {
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
  priority?: boolean;
}

const SIZE_MAP = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
} as const;

export function BrandLogoMark({ size = "md", className, priority = false }: BrandLogoMarkProps) {
  const px = SIZE_MAP[size];

  return (
    <Image
      src="/branding/ambra-crystal-floating.svg"
      alt="Ambra logo"
      width={px}
      height={px}
      priority={priority}
      className={cn("shrink-0", className)}
    />
  );
}
