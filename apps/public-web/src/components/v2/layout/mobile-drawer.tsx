"use client";

import { Sheet, SheetContent, SheetTrigger } from "@/components/ui/sheet";
import { Button } from "@/components/ui/button";
import { Menu } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";

interface MobileDrawerProps {
  trigger?: React.ReactNode;
  children: React.ReactNode;
  side?: "left" | "right" | "top" | "bottom";
  className?: string;
}

export function MobileDrawer({ trigger, children, side = "left", className }: MobileDrawerProps) {
  const [open, setOpen] = useState(false);

  return (
    <Sheet open={open} onOpenChange={setOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <Button variant="ghost" size="icon" className="md:hidden">
            <Menu className="h-5 w-5" />
            <span className="sr-only">Toggle navigation menu</span>
          </Button>
        )}
      </SheetTrigger>
      <SheetContent side={side} className={cn("w-[300px] sm:w-[400px] p-0", className)}>
        <div className="flex flex-col h-full overflow-y-auto">{children}</div>
      </SheetContent>
    </Sheet>
  );
}
