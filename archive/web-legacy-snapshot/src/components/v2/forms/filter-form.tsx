"use client";

import { z } from "zod";
import { FormWrapper } from "./form-wrapper";
import { Filter, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { useState } from "react";

interface FilterFormProps<T extends z.ZodType> {
  schema: T;
  defaultValues?: Partial<z.infer<T>>;
  onApply: (filters: z.infer<T>) => void;
  onClear?: () => void;
  activeFiltersCount?: number;
  trigger?: React.ReactNode;
  children: React.ReactNode;
}

export function FilterForm<T extends z.ZodType>({
  schema,
  defaultValues,
  onApply,
  onClear,
  activeFiltersCount = 0,
  trigger,
  children,
}: FilterFormProps<T>) {
  const [open, setOpen] = useState(false);

  const handleSubmit = (data: z.infer<T>) => {
    onApply(data);
    setOpen(false);
  };

  const handleClear = () => {
    if (onClear) {
      onClear();
    }
    setOpen(false);
  };

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="outline" className="relative">
            <Filter className="mr-2 h-4 w-4" />
            Filters
            {activeFiltersCount > 0 && (
              <span className="ml-2 flex h-5 w-5 items-center justify-center rounded-full bg-primary text-xs text-primary-foreground">
                {activeFiltersCount}
              </span>
            )}
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side="right" className="w-full sm:max-w-md overflow-y-auto">
        <SheetHeader>
          <SheetTitle>Filters</SheetTitle>
          <SheetDescription>Apply filters to narrow down your results</SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          <FormWrapper
            schema={schema}
            onSubmit={handleSubmit}
            defaultValues={defaultValues}
            submitLabel="Apply Filters"
            resetLabel="Clear All"
            onSuccess={() => setOpen(false)}
          >
            {children}
          </FormWrapper>

          {onClear && activeFiltersCount > 0 && (
            <Button type="button" variant="ghost" className="w-full mt-2" onClick={handleClear}>
              <X className="mr-2 h-4 w-4" />
              Clear Filters
            </Button>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
