"use client";
import React, { useState } from "react";
import { motion } from "framer-motion";
import Image from "next/image";
import { ImageOff } from "lucide-react";
import { SidebarHeader, useSidebar } from "../../ui/sidebar";
import { Link } from "@/i18n/navigation";

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

  const showPlaceholder = !logo || hasError;

  return (
    <SidebarHeader className="py-2">
      <Link href="/" className="h-full w-full">
        <div className="m-0 flex min-w-0 items-center gap-2">
          <div className="relative flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded bg-muted">
            {showPlaceholder ? (
              <ImageOff className="text-muted-foreground" size={24} />
            ) : (
              <Image
                src={logo}
                alt="Organization logo"
                width={40}
                height={40}
                className="h-10 w-10 rounded object-cover"
                onError={() => setHasError(true)}
                priority
              />
            )}
          </div>

          <motion.div
            initial={false}
            animate={{ opacity: isExpanded ? 1 : 0 }}
            transition={{ duration: 0.2, delay: 0.15 }}
            className="flex flex-col gap-1 overflow-hidden whitespace-nowrap font-medium leading-none text-[color:var(--font-color)] transition-opacity duration-200"
          >
            <span>{name}</span>
            <span>{name2}</span>
          </motion.div>
        </div>
      </Link>
    </SidebarHeader>
  );
};

export default AppSidebarHeader;
