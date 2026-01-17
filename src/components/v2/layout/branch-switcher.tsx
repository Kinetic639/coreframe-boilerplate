"use client";

import * as React from "react";
import { Check, ChevronsUpDown, Building2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { toast } from "react-toastify";

/**
 * Branch Switcher V2
 *
 * Allows users to switch between available branches
 *
 * Flow:
 * 1. User selects branch
 * 2. Calls changeBranch() server action (persists to DB)
 * 3. Calls setActiveBranch() (updates Zustand)
 * 4. React Query detects activeBranchId change and refetches permissions
 * 5. PermissionsSync updates user store
 *
 * Uses existing changeBranch action from src/app/actions/changeBranch.ts
 */
export function BranchSwitcherV2() {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = React.useTransition();

  const { activeBranchId, availableBranches, activeBranch, setActiveBranch } = useAppStoreV2();

  const handleBranchSelect = (branchId: string) => {
    startTransition(async () => {
      try {
        // Persist to database
        await changeBranch(branchId);

        // Update Zustand store (triggers React Query refetch via query key change)
        setActiveBranch(branchId);

        setOpen(false);
        toast.success("Branch switched successfully");
      } catch (error) {
        console.error("Failed to change branch:", error);
        toast.error("Failed to switch branch");
        // Don't update store on error
      }
    });
  };

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[220px] justify-between"
          disabled={isPending}
        >
          <Building2 className="mr-2 h-4 w-4" />
          <span className="truncate">{activeBranch?.name || "Select branch..."}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[220px] p-0">
        <Command>
          <CommandInput placeholder="Search branch..." />
          <CommandList>
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              {availableBranches.map((branch) => (
                <CommandItem
                  key={branch.id}
                  value={branch.name}
                  onSelect={() => handleBranchSelect(branch.id)}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      activeBranchId === branch.id ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {branch.name}
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
