"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { Building2 } from "lucide-react";
import Image from "next/image";

export function SidebarOrgHeader() {
  const { activeOrg } = useAppStoreV2();

  if (!activeOrg) {
    return null;
  }

  return (
    <div className="flex items-center gap-3 px-3 py-3 border-b group-data-[collapsible=icon]:hidden">
      {/* Logo */}
      {activeOrg.logo_url ? (
        <Image
          src={activeOrg.logo_url}
          alt={activeOrg.name}
          width={40}
          height={40}
          className="size-10 rounded-md object-cover shrink-0"
        />
      ) : (
        <div className="flex size-10 items-center justify-center rounded-md bg-primary text-primary-foreground shrink-0">
          <Building2 className="size-5" />
        </div>
      )}

      {/* Name and Name 2 */}
      <div className="flex flex-col min-w-0">
        <span className="truncate text-base">{activeOrg.name}</span>
        {activeOrg.name_2 && <span className="truncate text-base">{activeOrg.name_2}</span>}
      </div>
    </div>
  );
}
