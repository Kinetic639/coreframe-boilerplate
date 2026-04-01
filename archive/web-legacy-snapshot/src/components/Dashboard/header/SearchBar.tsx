"use client";

import React from "react";
import { Input } from "@/components/ui/input";
import { Search } from "lucide-react";

export function SearchBar() {
  return (
    <div className="relative flex items-center">
      <Search className="absolute left-2 h-4 w-4 text-muted-foreground" />
      <Input
        type="text"
        placeholder="Search everything..."
        className="h-9 pl-8 w-[200px] lg:w-[300px]"
      />
    </div>
  );
}
