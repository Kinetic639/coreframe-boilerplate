"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { cn } from "@/utils";

const SIZE_MAP = {
  xs: 20,
  sm: 28,
  md: 36,
  lg: 48,
  xl: 64,
} as const;

interface BrandLogoMarkHoverProps {
  size?: keyof typeof SIZE_MAP;
  className?: string;
}

export function BrandLogoMarkHover({ size = "md", className }: BrandLogoMarkHoverProps) {
  const [hovered, setHovered] = useState(false);
  const px = SIZE_MAP[size];

  return (
    <svg
      width={px}
      height={px}
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={cn("shrink-0", className)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      {/* Left arm */}
      <motion.path
        d="M28 5 L5 53 L16 53 L28 29 Z"
        fill="#B45309"
        animate={hovered ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
        transition={
          hovered
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0 }
            : { duration: 0.3 }
        }
      />

      {/* Right arm */}
      <motion.path
        d="M28 5 L51 53 L40 53 L28 29 Z"
        fill="#F59E0B"
        animate={hovered ? { opacity: [0.55, 1, 0.55] } : { opacity: 1 }}
        transition={
          hovered
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.22 }
            : { duration: 0.3 }
        }
      />

      {/* Rhomboid */}
      <motion.path
        d="M28 7.5 L22 20 L28 29 L34 20 Z"
        fill="#FBBF24"
        animate={
          hovered
            ? { opacity: [0.4, 1, 0.4], scale: [0.96, 1.04, 0.96] }
            : { opacity: 0.95, scale: 1 }
        }
        style={{ transformBox: "fill-box", transformOrigin: "center" }}
        transition={
          hovered
            ? { duration: 2.2, repeat: Infinity, ease: "easeInOut", delay: 0.4 }
            : { duration: 0.3 }
        }
      />

      {/* Base chevron — full opacity at rest, dims when beacon arms appear */}
      <motion.path
        d="M14 34 L28 51 L42 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        animate={hovered ? { opacity: 0.34 } : { opacity: 0.85 }}
        transition={{ duration: 0.3 }}
      />

      {/* Beacon left arm */}
      <motion.path
        d="M28 51 L14 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
        animate={
          hovered
            ? { pathLength: [0, 1, 0], pathOffset: [0, 0, 1], opacity: [0.45, 1, 0.45] }
            : { pathLength: 0, pathOffset: 0, opacity: 0 }
        }
        transition={
          hovered ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }
        }
      />

      {/* Beacon right arm */}
      <motion.path
        d="M28 51 L42 34"
        stroke="#FCD34D"
        strokeWidth="2"
        strokeLinejoin="round"
        strokeLinecap="round"
        fill="none"
        initial={{ pathLength: 0, pathOffset: 0, opacity: 0 }}
        animate={
          hovered
            ? { pathLength: [0, 1, 0], pathOffset: [0, 0, 1], opacity: [0.45, 1, 0.45] }
            : { pathLength: 0, pathOffset: 0, opacity: 0 }
        }
        transition={
          hovered ? { duration: 1.7, repeat: Infinity, ease: "easeInOut" } : { duration: 0.25 }
        }
      />
    </svg>
  );
}
