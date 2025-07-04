"use client";

import { motion } from "framer-motion";

export const WaveDotsLoader = () => {
  return (
    <div className="flex h-4 items-end gap-1 px-1">
      {[0, 1, 2, 3].map((i) => (
        <motion.span
          key={i}
          className="block h-1.5 w-1.5 rounded-full bg-[color:var(--font-color)]"
          animate={{
            y: [0, -6, 0],
          }}
          transition={{
            duration: 0.8,
            repeat: Infinity,
            ease: "easeInOut",
            delay: i * 0.25, // <<< THIS CREATES THE WAVE
          }}
        />
      ))}
    </div>
  );
};
