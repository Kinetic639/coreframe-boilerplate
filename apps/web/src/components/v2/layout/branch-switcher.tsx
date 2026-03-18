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
import type { BranchDataV2 } from "@/lib/stores/v2/app-store";

interface BranchSwitcherV2Props {
  /** Server-computed accessible branches for the current user */
  branches: BranchDataV2[];
  /** Server-resolved active branch ID */
  activeBranchId: string | null;
}

/**
 * Branch Switcher V2
 *
 * Dumb UI: receives server-computed `branches` and `activeBranchId` as props.
 * Does NOT read the branch list from Zustand — only reads org name for display.
 *
 * Flow:
 * 1. User selects branch from dropdown (from server-filtered list only)
 * 2. Calls changeBranch() server action (validates + persists to DB)
 * 3. On success: calls setActiveBranch() (updates Zustand active ID)
 * 4. React Query detects activeBranchId change and refetches permissions
 * 5. PermissionsSync updates user store
 */
export function BranchSwitcherV2({ branches, activeBranchId }: BranchSwitcherV2Props) {
  const { isMobile } = useSidebar();
  const [isPending, startTransition] = React.useTransition();

  // Branch list comes from server-computed props — NOT from the store.
  // activeBranchId from the store is used for display (updated optimistically on switch).
  // The prop is the server-authoritative initial value and SSR fallback.
  const { activeOrg, setActiveBranch, activeBranchId: storeActiveBranchId } = useAppStoreV2();

  // Prefer store value (reflects optimistic switch), fall back to server prop for SSR
  const currentActiveBranchId = storeActiveBranchId ?? activeBranchId;
  const activeBranch = branches.find((b) => b.id === currentActiveBranchId) ?? null;

  const handleBranchSelect = (branchId: string) => {
    if (branchId === currentActiveBranchId) return;

    startTransition(async () => {
      try {
        const result = await changeBranch(branchId);
        if (!result.success) {
          toast.error("error" in result ? result.error : "Failed to switch branch");
          return;
        }
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
            {branches.map((branch) => (
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
                {branch.id === currentActiveBranchId && (
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
