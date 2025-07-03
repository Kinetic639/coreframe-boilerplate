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

export function BranchSelector() {
  const [open, setOpen] = React.useState(false);
  const [isPending, startTransition] = useTransition();
  const hydrated = useHasHydrated();

  const {
    activeBranchId,
    availableBranches,
    activeBranch,
    setContext,
    activeOrg,
    activeOrgId,
    userModules,
  } = useAppStore();

  const handleBranchSelect = (branchId: string) => {
    startTransition(async () => {
      await changeBranch(branchId);

      const newBranch = availableBranches.find((b) => b.branch_id === branchId) ?? null;

      setContext({
        activeBranchId: branchId,
        activeBranch: newBranch,
        availableBranches,
        activeOrg,
        activeOrgId,
        userModules,
      });

      setOpen(false);
    });
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
    <Popover open={open} onOpenChange={setOpen}>
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
