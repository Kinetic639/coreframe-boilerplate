"use client";

import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { Link } from "@/i18n/navigation";
import { Building2 } from "lucide-react";
import Image from "next/image";

export function SidebarOrgHeader() {
  const { activeOrg } = useAppStoreV2();

  if (!activeOrg) {
    return null;
  }

  return (
    <Link
      href="/dashboard/organization/public-profile"
      className="flex items-center gap-3 border-b px-3 py-3 transition-colors hover:bg-sidebar-accent group-data-[collapsible=icon]:hidden"
    >
      {/* Logo */}
      {activeOrg.logo_url ? (
        <Image
          src={activeOrg.logo_url}
          alt={activeOrg.name}
          width={40}
          height={40}
          className="size-10 shrink-0 rounded-md object-cover"
        />
      ) : (
        <div className="flex size-10 shrink-0 items-center justify-center rounded-md bg-primary text-primary-foreground">
          <Building2 className="size-5" />
        </div>
      )}

      {/* Name and Name 2 */}
      <div className="flex min-w-0 flex-col">
        <span className="truncate text-base">{activeOrg.name}</span>
        {activeOrg.name_2 && <span className="truncate text-base">{activeOrg.name_2}</span>}
      </div>
    </Link>
  );
}
