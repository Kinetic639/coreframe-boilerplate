"use client";

import * as React from "react";
import { ChevronsUpDown, Building } from "lucide-react";
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

/**
 * Branch Switcher V2
 *
 * Allows users to switch between available branches
 * Styled to match shadcn sidebar-07 example (TeamSwitcher)
 *
 * Flow:
 * 1. User selects branch from dropdown
 * 2. Calls changeBranch() server action (persists to DB)
 * 3. Calls setActiveBranch() (updates Zustand)
 * 4. React Query detects activeBranchId change and refetches permissions
 * 5. PermissionsSync updates user store
 */
export function BranchSwitcherV2() {
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = React.useTransition();

  const { activeOrg, activeBranch, availableBranches, setActiveBranch } = useAppStoreV2();

  const handleBranchSelect = (branchId: string) => {
    if (branchId === activeBranch?.id) return;

    startTransition(async () => {
      try {
        // Persist to database
        await changeBranch(branchId);

        // Update Zustand store (triggers React Query refetch via query key change)
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
              size="lg"
              className="data-[state=open]:bg-sidebar-accent data-[state=open]:text-sidebar-accent-foreground"
              disabled={isPending}
            >
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-sidebar-primary text-sidebar-primary-foreground">
                <Building className="size-4" />
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-medium">{activeOrg.name}</span>
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
                key={branch.id}
                onClick={() => handleBranchSelect(branch.id)}
                className="gap-2 p-2"
                disabled={isPending}
              >
                <div className="flex size-6 items-center justify-center rounded-md border">
                  <Building className="size-3.5 shrink-0" />
                </div>
                {branch.name}
                {branch.id === activeBranch?.id && (
                  <span className="ml-auto text-xs text-muted-foreground">✓</span>
                )}
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  );
}
