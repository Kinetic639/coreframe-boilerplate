"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

type FancySpinnerProps = {
  className?: string;
};

const ringConfigs = [
  { size: 64, speed: 3.2, reverse: false, thickness: 4 },
  { size: 48, speed: 2.4, reverse: true, thickness: 2 },
  { size: 32, speed: 2.8, reverse: false, thickness: 3 },
];

const FancySpinner = ({ className }: FancySpinnerProps) => {
  return (
    <div className={cn("relative flex h-20 w-20 items-center justify-center", className)}>
      {ringConfigs.map((ring, index) => (
        <motion.div
          key={index}
          className="absolute rounded-full border-[var(--theme-color)] border-t-transparent"
          style={{
            height: `${ring.size}px`,
            width: `${ring.size}px`,
            borderWidth: `${ring.thickness}px`,
          }}
          animate={{ rotate: ring.reverse ? -360 : 360 }}
          transition={{
            repeat: Infinity,
            ease: "linear",
            duration: ring.speed,
          }}
        />
      ))}
      <motion.div
        className="z-10 h-4 w-4 rounded-full bg-[var(--theme-color)]"
        animate={{ scale: [1, 1.3, 1], opacity: [1, 0.6, 1] }}
        transition={{ repeat: Infinity, duration: 2, ease: "easeInOut" }}
      />
    </div>
  );
};

export default FancySpinner;
