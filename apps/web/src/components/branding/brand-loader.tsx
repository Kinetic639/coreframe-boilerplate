"use client";

import { motion } from "framer-motion";
import { cn } from "@/utils";
import { BrandWordmark } from "./brand-wordmark";

export type BrandLoaderVariant = "pulse" | "beacon_swap";

interface BrandLoaderProps {
  variant?: BrandLoaderVariant;
  label?: string;
  className?: string;
  showWordmark?: boolean;
  logoClassName?: string;
}

interface CrystalLogoProps {
  variant: BrandLoaderVariant;
  className?: string;
}

function CrystalLogo({ variant, className }: CrystalLogoProps) {
  const beaconBase = (
    <>
      <motion.path
        d="M28 5 L5 53 L16 53 L28 29 Z"
        fill="#B45309"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{
          duration: 2.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0,
        }}
      />
      <motion.path
        d="M28 5 L51 53 L40 53 L28 29 Z"
        fill="#F59E0B"
        animate={{ opacity: [0.55, 1, 0.55] }}
        transition={{
          duration: 2.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.22,
        }}
      />
      <motion.path
        d="M28 7.5 L22 20 L28 29 L34 20 Z"
        fill="#FBBF24"
        opacity="0.95"
        animate={{ opacity: [0.4, 1, 0.4], scale: [0.96, 1.04, 0.96] }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={{
          duration: 2.2,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.4,
        }}
      />
      <path
        d="M14 34 L28 51 L42 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.34"
      />
    </>
  );

  if (variant === "beacon_swap") {
    return (
      <svg
        viewBox="0 0 56 56"
        className={cn("h-16 w-16", className)}
        fill="none"
        xmlns="http://www.w3.org/2000/svg"
      >
        {beaconBase}
        <motion.path
          d="M28 51 L14 34"
          stroke="#FCD34D"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, pathOffset: 0 }}
          animate={{
            pathLength: [0, 1, 0],
            pathOffset: [0, 0, 1],
            opacity: [0.45, 1, 0.45],
          }}
          transition={{ duration: 1.7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
        <motion.path
          d="M28 51 L42 34"
          stroke="#FCD34D"
          strokeWidth="2"
          strokeLinejoin="round"
          strokeLinecap="round"
          fill="none"
          initial={{ pathLength: 0, pathOffset: 0 }}
          animate={{
            pathLength: [0, 1, 0],
            pathOffset: [0, 0, 1],
            opacity: [0.45, 1, 0.45],
          }}
          transition={{ duration: 1.7, repeat: Number.POSITIVE_INFINITY, ease: "easeInOut" }}
        />
      </svg>
    );
  }

  return (
    <motion.svg
      viewBox="0 0 56 56"
      className={cn("h-16 w-16", className)}
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <motion.path
        d="M28 5 L5 53 L16 53 L28 29 Z"
        fill="#B45309"
        animate={{ opacity: [0.78, 1, 0.78], y: [0, -1.2, 0] }}
        transition={{
          duration: 1.9,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0,
        }}
      />
      <motion.path
        d="M28 5 L51 53 L40 53 L28 29 Z"
        fill="#F59E0B"
        animate={{ opacity: [0.78, 1, 0.78], y: [0, -1.2, 0] }}
        transition={{
          duration: 1.9,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.14,
        }}
      />
      <motion.path
        d="M28 7.5 L22 20 L28 29 L34 20 Z"
        fill="#FBBF24"
        opacity="0.95"
        animate={{ opacity: [0.6, 1, 0.6], scale: [0.98, 1.04, 0.98] }}
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={{
          duration: 1.9,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.28,
        }}
      />
      <motion.polyline
        points="14,34 28,51 42,34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        opacity="0.85"
        animate={{ opacity: [0.4, 0.95, 0.4] }}
        transition={{
          duration: 1.9,
          repeat: Number.POSITIVE_INFINITY,
          ease: "easeInOut",
          delay: 0.34,
        }}
      />
    </motion.svg>
  );
}

export function BrandLoader({
  variant = "pulse",
  label = "Ambra System",
  className,
  showWordmark = true,
  logoClassName,
}: BrandLoaderProps) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <CrystalLogo variant={variant} className={logoClassName} />
      {showWordmark ? <BrandWordmark size="sm" align="center" /> : null}
      {label ? (
        <p className="text-xs font-medium uppercase tracking-[0.12em] text-muted-foreground">
          {label}
        </p>
      ) : null}
    </div>
  );
}
