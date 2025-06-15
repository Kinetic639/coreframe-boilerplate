"use client";

import React from "react";
import Image from "next/image";
import { motion } from "framer-motion";
import FancySpinner from "./FancySpinner";

type LoaderStaticProps = {
  logoUrl?: string | null;
  orgName?: string | null;
  fullScreen?: boolean;
};

export default function Loader({ logoUrl, orgName, fullScreen = false }: LoaderStaticProps) {
  const hasLogo = !!logoUrl;
  const hasName = !!orgName;

  return (
    <div
      className={`${
        fullScreen ? "fixed inset-0 z-50" : "h-full w-full"
      } flex flex-col items-center justify-center gap-6 bg-muted/10 text-center`}
    >
      <motion.div
        className="flex flex-col items-center gap-2"
        initial={{ opacity: 0, scale: 0.98 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 0.6, ease: "easeOut" }}
      >
        {/* Logo or fallback */}
        <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded bg-muted shadow-sm">
          {hasLogo && (
            <Image
              src={logoUrl!}
              alt="Logo organizacji"
              width={64}
              height={64}
              className="h-16 w-16 rounded object-cover"
            />
          )}
        </div>

        {/* Name or fallback */}
        <motion.div
          className="text-xl font-semibold tracking-tight text-foreground"
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1, duration: 0.5 }}
        >
          {hasName ? orgName : "Ładowanie..."}
        </motion.div>
      </motion.div>

      {/* Spinner */}
      <div>
        <FancySpinner />
      </div>
    </div>
  );
}
