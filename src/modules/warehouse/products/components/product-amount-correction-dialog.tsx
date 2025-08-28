"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ProductWithDetails } from "@/lib/mock/products-extended";
import { Tables } from "@/supabase/types/types";
import { useProductFilters } from "@/modules/warehouse/products/hooks/use-product-filters";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Check, ChevronsUpDown } from "lucide-react";
import { cn } from "@/lib/utils";

interface ProductAmountCorrectionDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: ProductWithDetails;
}

export function ProductAmountCorrectionDialog({
  open,
  onOpenChange,
  product,
}: ProductAmountCorrectionDialogProps) {
  const { availableLocations } = useProductFilters([]); // Assuming this hook provides all locations
  const [selectedLocation, setSelectedLocation] = React.useState<Tables<"locations"> | null>(null);
  const [amount, setAmount] = React.useState<number | "">("");
  const [locationSearchOpen, setLocationSearchOpen] = React.useState(false);

  React.useEffect(() => {
    if (!open) {
      setSelectedLocation(null);
      setAmount("");
    }
  }, [open]);

  const handleSave = () => {
    if (selectedLocation && amount !== "") {
      // console.log(
      //   `Correcting amount for product ${product.name} at ${selectedLocation.name}: ${amount}`
      // );
      // Here you would typically call an API to update the stock
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[425px]">
        <DialogHeader>
          <DialogTitle>Korekta ilości produktu</DialogTitle>
          <DialogDescription>
            Zmień ilość produktu "{product.name}" w wybranej lokalizacji.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 py-4">
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="location" className="text-right">
              Lokalizacja
            </Label>
            <Popover open={locationSearchOpen} onOpenChange={setLocationSearchOpen}>
              <PopoverTrigger asChild>
                <Button
                  variant="outline"
                  role="combobox"
                  aria-expanded={locationSearchOpen}
                  className="col-span-3 justify-between"
                >
                  {selectedLocation ? selectedLocation.name : "Wybierz lokalizację..."}
                  <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-[--radix-popover-trigger-width] p-0">
                <Command>
                  <CommandInput placeholder="Szukaj lokalizacji..." />
                  <CommandList>
                    <CommandEmpty>Brak lokalizacji.</CommandEmpty>
                    <CommandGroup>
                      {availableLocations.map((location) => (
                        <CommandItem
                          key={location.id}
                          value={location.name}
                          onSelect={() => {
                            setSelectedLocation(location);
                            setLocationSearchOpen(false);
                          }}
                        >
                          <Check
                            className={cn(
                              "mr-2 h-4 w-4",
                              selectedLocation?.id === location.id ? "opacity-100" : "opacity-0"
                            )}
                          />
                          {location.name}
                        </CommandItem>
                      ))}
                    </CommandGroup>
                  </CommandList>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="grid grid-cols-4 items-center gap-4">
            <Label htmlFor="amount" className="text-right">
              Ilość
            </Label>
            <Input
              id="amount"
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value === "" ? "" : parseFloat(e.target.value))}
              className="col-span-3"
            />
          </div>
        </div>
        <div className="flex justify-end">
          <Button onClick={handleSave}>Zapisz</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
