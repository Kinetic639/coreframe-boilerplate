"use client";

import Image from "next/image";
import { motion } from "framer-motion";
import { useTranslations } from "next-intl";
import { BrandLoader } from "@/components/branding";
import { cn } from "@/lib/utils";

type LoaderProps = {
  logoUrl?: string | null;
  orgName?: string | null;
  orgName2?: string | null;
  message?: string;
  fullScreen?: boolean;
  className?: string;
};

/**
 * Full-area (or full-screen) loading screen with the animated Ambra logo —
 * the same branded loader as the route `loading.tsx` screens (PageLoader).
 */
export default function Loader({
  logoUrl,
  orgName,
  orgName2,
  message,
  fullScreen = false,
  className,
}: LoaderProps) {
  const t = useTranslations("common");
  const hasBranding = Boolean(logoUrl || orgName || orgName2);

  return (
    <div
      role="status"
      aria-live="polite"
      className={cn(
        fullScreen ? "fixed inset-0 z-50" : "h-full w-full",
        "flex flex-col items-center justify-center gap-6 bg-muted/10 text-center",
        className
      )}
    >
      {hasBranding ? (
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, scale: 0.98 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.6, ease: "easeOut" }}
        >
          <div className="relative flex h-16 w-16 items-center justify-center overflow-hidden rounded bg-muted shadow-sm">
            {logoUrl ? (
              <Image
                src={logoUrl}
                alt={orgName ? `${orgName} logo` : "Organization logo"}
                width={64}
                height={64}
                className="h-16 w-16 rounded object-cover"
              />
            ) : null}
          </div>

          <motion.div
            className="flex flex-col gap-1 overflow-hidden text-left font-medium leading-none text-[var(--theme-color)] transition-opacity duration-200"
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1, duration: 0.5 }}
          >
            {orgName ? <span>{orgName}</span> : null}
            {orgName2 ? <span>{orgName2}</span> : null}
          </motion.div>
        </motion.div>
      ) : null}

      <BrandLoader
        variant="beacon_swap"
        label={message ?? t("loading")}
        showWordmark={false}
        logoClassName="h-[7.68rem] w-[7.68rem]"
      />
    </div>
  );
}
