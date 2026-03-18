"use client";

import * as React from "react";
import { useTransition } from "react";
import { Check, ChevronsUpDown } from "lucide-react";
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
import { useAppStore } from "@/lib/stores/app-store";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { useHasHydrated } from "@/hooks/use-hydrated-value";
import { fetchAvailableBranches } from "@/lib/api/branches";

export function CompactBranchSelector() {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHasHydrated();

  const {
    activeBranchId,
    availableBranches,
    activeBranch,
    setActiveBranch,
    updateAvailableBranches,
    activeOrgId,
  } = useAppStore();

  const handleBranchSelect = (branchId: string) => {
    startTransition(async () => {
      try {
        await changeBranch(branchId);
        await setActiveBranch(branchId); // This will now auto-load locations and other branch data
        setOpen(false);
      } catch (error) {
        console.error("Failed to change branch:", error);
      }
    });
  };

  const handleOpenChange = async (newOpen: boolean) => {
    setOpen(newOpen);

    // Refresh available branches when opening the selector
    if (newOpen && activeOrgId) {
      try {
        const updatedBranches = await fetchAvailableBranches(activeOrgId);
        updateAvailableBranches(updatedBranches);
      } catch (error) {
        console.error("Failed to refresh branches:", error);
      }
    }
  };

  if (!hydrated) {
    return (
      <Button
        variant="ghost"
        size="sm"
        className="h-6 w-[120px] justify-between focus-visible:ring-1"
        disabled
      >
        <span className="truncate">Loading...</span>
        <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="ghost"
          size="sm"
          role="combobox"
          aria-expanded={open}
          className="h-6 w-[160px] justify-between focus-visible:ring-1"
          disabled={isPending}
        >
          <span className="truncate text-xs">{activeBranch?.name || "Select branch..."}</span>
          <ChevronsUpDown className="ml-1 h-3 w-3 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[150px] p-0" align="start">
        <Command>
          <CommandInput placeholder="Search branch..." className="h-8" />
          <CommandList>
            <CommandEmpty>No branch found.</CommandEmpty>
            <CommandGroup>
              {availableBranches.map((branch) => (
                <CommandItem
                  key={branch.branch_id}
                  value={branch.name ?? branch.slug ?? branch.branch_id}
                  onSelect={() => handleBranchSelect(branch.branch_id)}
                  className={cn(
                    "cursor-pointer transition-colors text-xs py-1",
                    "hover:bg-[rgba(var(--theme-color-rgb),0.08)]",
                    "hover:text-[var(--theme-color)]",
                    "focus:bg-[rgba(var(--theme-color-rgb),0.08)]",
                    "focus:text-[var(--theme-color)]"
                  )}
                >
                  <span className="flex-1 truncate">{branch.name}</span>
                  <Check
                    className={cn(
                      "ml-auto h-3 w-3",
                      activeBranchId === branch.branch_id ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
