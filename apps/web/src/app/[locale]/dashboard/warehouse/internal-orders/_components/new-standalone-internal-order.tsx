"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { InternalOrderDialog } from "@/components/warehouse/internal-order-form";

/** "Nowe ZW" without a repair order: parts ordered by another branch or a client. */
export function NewStandaloneInternalOrderButton({
  warehouses = [],
}: {
  warehouses?: Array<{ code: string; name: string | null }>;
}) {
  const t = useTranslations("modules.warehouse.internalOrders.form");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} data-testid="zw-new-standalone">
        <FilePlus2 className="mr-1.5 h-4 w-4" />
        {t("newStandaloneButton")}
      </Button>
      <InternalOrderDialog open={open} onOpenChange={setOpen} warehouses={warehouses} />
    </>
  );
}
