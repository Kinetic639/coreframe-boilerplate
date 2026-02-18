"use client";

import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

export function BackButton({ label }: { label: string }) {
  return (
    <Button onClick={() => window.history.back()} variant="default" className="flex-1">
      <ArrowLeft className="mr-2 h-4 w-4" />
      {label}
    </Button>
  );
}
