"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { SidebarHeader } from "../../ui/sidebar";
import { Link } from "@/i18n/navigation";
import SidebarQuickActions from "./SidebarQuickActions";
import { useSidebar } from "@/components/ui/sidebar";

const AppSidebarHeader = ({
  logo,
  name,
  name2,
}: {
  logo?: string;
  name?: string;
  name2?: string;
}) => {
  const { state } = useSidebar();
  const isExpanded = state === "expanded";

  const [hasError, setHasError] = useState(false);
  const [shouldCenter, setShouldCenter] = useState(!isExpanded);
  const showPlaceholder = !logo || hasError;

  // Handle delayed centering animation
  useEffect(() => {
    if (isExpanded) {
      // When expanding, immediately set to left alignment
      setShouldCenter(false);
    } else {
      // When collapsing, delay centering until after text animation completes
      const timer = setTimeout(() => {
        setShouldCenter(true);
      }, 150); // Delay by 150ms to allow text to fade out first
      return () => clearTimeout(timer);
    }
  }, [isExpanded]);

  const handleImageError = (e: React.SyntheticEvent<HTMLImageElement, Event>) => {
    setHasError(true);
    console.error("Failed to load logo image:", e);
  };

  return (
    <SidebarHeader className="p-2">
      <Link href="/" className="block w-full">
        <motion.div
          initial={false}
          animate={{
            justifyContent: shouldCenter ? "center" : "flex-start",
          }}
          transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
          className="flex items-center"
        >
          {/* Logo Container - Fixed size container */}
          <motion.div
            initial={false}
            animate={{
              width: isExpanded ? 40 : 48,
              height: isExpanded ? 40 : 48,
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="relative flex shrink-0 items-center justify-center overflow-hidden rounded bg-muted"
          >
            {showPlaceholder ? (
              <ImageOff className="text-[color:var(--font-color)]/50 h-6 w-6" />
            ) : (
              <Image
                src={logo}
                alt="Organization logo"
                fill
                className="rounded object-cover"
                onError={handleImageError}
                priority
              />
            )}
          </motion.div>

          {/* Text Container - Always present in DOM */}
          <motion.div
            initial={false}
            animate={{
              opacity: isExpanded ? 1 : 0,
              width: isExpanded ? "auto" : 0,
              marginLeft: isExpanded ? 12 : 0,
            }}
            transition={{ duration: 0.3, ease: [0.16, 1, 0.3, 1] }}
            className="flex flex-col gap-0.5 overflow-hidden whitespace-nowrap font-medium leading-tight text-[color:var(--font-color)]"
          >
            {name && <span className="text-base font-semibold">{name}</span>}
            {name2 && <span className="text-[color:var(--font-color)]/70 text-sm">{name2}</span>}
          </motion.div>
        </motion.div>
      </Link>

      <SidebarQuickActions />
    </SidebarHeader>
  );
};

export default AppSidebarHeader;
