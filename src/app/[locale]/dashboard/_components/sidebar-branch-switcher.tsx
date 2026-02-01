"use client";

import * as React from "react";
import { useTransition } from "react";
import { ChevronsUpDown, Building2, Check } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  useSidebar,
} from "@/components/ui/sidebar";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { toast } from "react-toastify";

export function SidebarBranchSwitcher() {
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();

  const { activeOrg, activeBranch, activeBranchId, availableBranches, setActiveBranch } =
    useAppStoreV2();

  const handleBranchSelect = (branchId: string) => {
    if (branchId === activeBranchId) return;

    startTransition(async () => {
      try {
        await changeBranch(branchId);
        setActiveBranch(branchId);
        toast.success("Branch switched successfully");
      } catch (error) {
        console.error("Failed to change branch:", error);
        toast.error("Failed to switch branch");
      }
    });
  };

  if (!activeOrg || !activeBranch) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="default"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isPending}
              tooltip={activeBranch.name}
            >
              <div className="flex aspect-square size-6 items-center justify-center rounded bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-3.5" />
              </div>
              <span className="truncate font-medium flex-1 text-left text-sm">
                {activeBranch.name}
              </span>
              <ChevronsUpDown className="ml-auto" />
            </SidebarMenuButton>
          </DropdownMenuTrigger>
          <DropdownMenuContent
            className="w-[--radix-dropdown-menu-trigger-width] min-w-56 rounded-lg"
            align="start"
            side={isMobile ? "bottom" : "right"}
            sideOffset={4}
          >
            <DropdownMenuLabel className="text-xs text-muted-foreground">
              Branches
            </DropdownMenuLabel>
            {availableBranches.map((branch) => (
              <DropdownMenuItem
                key={branch.id}
                onClick={() => handleBranchSelect(branch.id)}
                className="gap-2 p-2"
                disabled={isPending}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Building2 className="size-4 shrink-0" />
                </div>
                <span className="flex-1">{branch.name}</span>
                {activeBranchId === branch.id && <Check className="size-4 text-muted-foreground" />}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
