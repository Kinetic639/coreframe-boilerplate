"use client";

import { AccordionItem, AccordionTrigger, AccordionContent } from "@/components/ui/accordion";
import { usePersistentAccordionState } from "@/lib/hooks/usePersistentAccordionState";
import { cn } from "@/lib/utils";

export function PersistentAccordionItem({
  id,
  label,
  icon: Icon,
  children,
  className,
  nested = false,
}: {
  id: string;
  label: string;
  icon?: React.ElementType;
  children: React.ReactNode;
  className?: string;
  nested?: boolean;
}) {
  const [open, setOpen] = usePersistentAccordionState(id);

  return (
    <AccordionItem value={id} className={cn("relative border-none", className)}>
      {nested && (
        <span className="absolute bottom-0 left-[-10px] top-0 w-px bg-current opacity-50 grayscale" />
      )}

      <AccordionTrigger
        onClick={() => setOpen(!open)}
        className={cn(
          "rounded-md px-2 py-2 text-base no-underline hover:bg-white/10",
          open && "bg-white/10 font-medium"
        )}
      >
        <div className="flex items-center">
          {Icon && <Icon className="h-4 w-4 flex-shrink-0" />}
          <span className="ml-3 text-sm">{label}</span>
        </div>
      </AccordionTrigger>

      <AccordionContent className="px-0 pb-0 pt-1">{children}</AccordionContent>
    </AccordionItem>
  );
}
