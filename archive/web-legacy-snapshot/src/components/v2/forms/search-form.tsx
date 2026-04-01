"use client";

import { Search, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { useState, useEffect } from "react";

interface SearchFormProps {
  placeholder?: string;
  value?: string;
  onSearch: (query: string) => void;
  onClear?: () => void;
  debounce?: number;
  className?: string;
}

export function SearchForm({
  placeholder = "Search...",
  value: externalValue = "",
  onSearch,
  onClear,
  debounce = 300,
  className,
}: SearchFormProps) {
  const [value, setValue] = useState(externalValue);

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      onSearch(value);
    }, debounce);

    return () => clearTimeout(timer);
  }, [value, debounce, onSearch]);

  // Update internal value when external value changes
  useEffect(() => {
    setValue(externalValue);
  }, [externalValue]);

  const handleClear = () => {
    setValue("");
    onSearch("");
    if (onClear) {
      onClear();
    }
  };

  return (
    <div className={cn("relative flex items-center", className)}>
      <Search className="absolute left-3 h-4 w-4 text-muted-foreground pointer-events-none" />
      <Input
        type="text"
        placeholder={placeholder}
        value={value}
        onChange={(e) => setValue(e.target.value)}
        className="pl-9 pr-9"
      />
      {value && (
        <Button
          type="button"
          variant="ghost"
          size="sm"
          className="absolute right-1 h-7 w-7 p-0"
          onClick={handleClear}
        >
          <X className="h-4 w-4" />
        </Button>
      )}
    </div>
  );
}
