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
import { useAppStore } from "@/lib/stores/app-store";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { fetchAvailableBranches } from "@/lib/api/branches";

export function SidebarBranchSwitcher() {
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = useTransition();

  const {
    activeOrg,
    activeBranch,
    activeBranchId,
    availableBranches,
    setActiveBranch,
    updateAvailableBranches,
    activeOrgId,
  } = useAppStore();

  const handleBranchSelect = (branchId: string) => {
    if (branchId === activeBranchId) return;

    startTransition(async () => {
      try {
        await changeBranch(branchId);
        await setActiveBranch(branchId);
      } catch (error) {
        console.error("Failed to change branch:", error);
      }
    });
  };

  const handleOpenChange = async (open: boolean) => {
    if (open && activeOrgId) {
      try {
        const updatedBranches = await fetchAvailableBranches(activeOrgId);
        updateAvailableBranches(updatedBranches);
      } catch (error) {
        console.error("Failed to refresh branches:", error);
      }
    }
  };

  if (!activeOrg || !activeBranch) {
    return null;
  }

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu onOpenChange={handleOpenChange}>
          <DropdownMenuTrigger asChild>
            <SidebarMenuButton
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isPending}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building2 className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">{activeOrg.name}</span>
                <span className="truncate text-xs">{activeBranch.name}</span>
              </div>
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
                key={branch.branch_id}
                onClick={() => handleBranchSelect(branch.branch_id)}
                className="gap-2 p-2"
                disabled={isPending}
              >
                <div className="flex size-6 items-center justify-center rounded-sm border">
                  <Building2 className="size-4 shrink-0" />
                </div>
                <span className="flex-1">{branch.name}</span>
                {activeBranchId === branch.branch_id && (
                  <Check className="size-4 text-muted-foreground" />
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
