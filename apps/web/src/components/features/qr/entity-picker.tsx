"use client";

import { useEffect, useRef, useState } from "react";
import { Check, ChevronsUpDown, Loader2, Search } from "lucide-react";
import { cn } from "@/utils";
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

export interface EntityPickerItem {
  id: string;
  title: string;
  subtitle?: string | null;
}

interface EntityPickerProps<T extends EntityPickerItem> {
  search: (query: string) => Promise<T[]>;
  onSelect: (item: T) => void;
  selectedId?: string | null;
  placeholder?: string;
  emptyLabel?: string;
  loadingLabel?: string;
  disabled?: boolean;
  className?: string;
}

/**
 * Generic search-as-you-type combobox for picking one existing entity (e.g.
 * a ticket or task) via a server action. Debounced, server-side filtered
 * (`shouldFilter={false}` — the `search` callback does the filtering).
 */
export function EntityPicker<T extends EntityPickerItem>({
  search,
  onSelect,
  selectedId,
  placeholder = "Search…",
  emptyLabel = "No results found",
  loadingLabel = "Searching…",
  disabled = false,
  className,
}: EntityPickerProps<T>) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<T[]>([]);
  const [loading, setLoading] = useState(false);
  const requestIdRef = useRef(0);

  useEffect(() => {
    if (!open) return;
    const requestId = ++requestIdRef.current;
    setLoading(true);
    const timer = setTimeout(async () => {
      const data = await search(query);
      if (requestIdRef.current === requestId) {
        setResults(data);
        setLoading(false);
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [open, query, search]);

  return (
    <Popover open={open} onOpenChange={disabled ? undefined : setOpen}>
      <PopoverTrigger asChild>
        <Button
          type="button"
          variant="outline"
          role="combobox"
          aria-expanded={open}
          disabled={disabled}
          className={cn("w-full justify-between font-normal", className)}
        >
          <span className="truncate text-sm text-muted-foreground">{placeholder}</span>
          <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-80 p-0" align="start">
        <Command shouldFilter={false}>
          <CommandInput placeholder={placeholder} value={query} onValueChange={setQuery} />
          <CommandList>
            {loading ? (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                {loadingLabel}
              </div>
            ) : (
              <>
                <CommandEmpty>
                  <div className="flex flex-col items-center gap-1 py-4">
                    <Search className="h-5 w-5 text-muted-foreground" />
                    <span className="text-sm text-muted-foreground">{emptyLabel}</span>
                  </div>
                </CommandEmpty>
                <CommandGroup>
                  {results.map((item) => (
                    <CommandItem
                      key={item.id}
                      value={item.id}
                      onSelect={() => {
                        onSelect(item);
                        setOpen(false);
                      }}
                    >
                      <div className="flex min-w-0 flex-col">
                        <span className="truncate text-sm">{item.title}</span>
                        {item.subtitle && (
                          <span className="truncate text-xs text-muted-foreground">
                            {item.subtitle}
                          </span>
                        )}
                      </div>
                      <Check
                        className={cn(
                          "ml-auto h-4 w-4 shrink-0",
                          selectedId === item.id ? "opacity-100" : "opacity-0"
                        )}
                      />
                    </CommandItem>
                  ))}
                </CommandGroup>
              </>
            )}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}
