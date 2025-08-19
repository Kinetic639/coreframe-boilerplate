"use client";

import * as React from "react";
import { useTransition } from "react";
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
import { useAppStore } from "@/lib/stores/app-store";
import { changeBranch } from "@actions/changeBranch";
import { useHasHydrated } from "@/lib/hooks/use-hydrated-value";
import { fetchAvailableBranches } from "@/lib/api/branches";

export function BranchSelector() {
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
        setActiveBranch(branchId);
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
        variant="outline"
        className="w-[280px] justify-between border-0 bg-muted/50 focus-visible:ring-1"
        disabled
      >
        <div className="flex items-center gap-2">
          <Building2 className="h-4 w-4 text-muted-foreground" />
          <span className="truncate">Ładowanie...</span>
        </div>
        <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
      </Button>
    );
  }

  return (
    <Popover open={open} onOpenChange={handleOpenChange}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          role="combobox"
          aria-expanded={open}
          className="w-[280px] justify-between border-0 bg-muted/50 focus-visible:ring-1"
          disabled={isPending}
        >
          <div className="flex items-center gap-2">
            <Building2 className="h-4 w-4 text-muted-foreground" />
            <span className="truncate">{activeBranch?.name || "Wybierz oddział..."}</span>
          </div>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[280px] p-0">
        <Command>
          <CommandInput placeholder="Szukaj oddziału..." />
          <CommandList>
            <CommandEmpty>Nie znaleziono oddziału.</CommandEmpty>
            <CommandGroup>
              {availableBranches.map((branch) => (
                <CommandItem
                  key={branch.branch_id}
                  value={branch.name ?? branch.slug ?? branch.branch_id}
                  onSelect={() => handleBranchSelect(branch.branch_id)}
                  className={cn(
                    "cursor-pointer transition-colors",
                    "hover:bg-[rgba(var(--theme-color-rgb),0.08)]",
                    "hover:text-[var(--theme-color)]",
                    "focus:bg-[rgba(var(--theme-color-rgb),0.08)]",
                    "focus:text-[var(--theme-color)]"
                  )}
                >
                  <div className="flex flex-1 items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    <div className="flex flex-col">
                      <span className="font-medium">{branch.name}</span>
                      {branch.slug && (
                        <span className="text-xs text-muted-foreground">{branch.slug}</span>
                      )}
                    </div>
                  </div>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
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
