"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { FilePlus2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  InternalOrderDialog,
  type InternalOrderPosition,
} from "@/components/warehouse/internal-order-form";

/** "Nowe ZW" of a repair order: order parts (positions or new parts) for it. */
export function NewInternalOrderButton({
  repairOrderId,
  lines,
}: {
  repairOrderId: string;
  lines: InternalOrderPosition[];
}) {
  const t = useTranslations("modules.warehouse.internalOrders.form");
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" size="sm" onClick={() => setOpen(true)} data-testid="zw-new">
        <FilePlus2 className="mr-1.5 h-4 w-4" />
        {t("newButton")}
      </Button>
      <InternalOrderDialog
        open={open}
        onOpenChange={setOpen}
        repairOrderId={repairOrderId}
        positions={lines}
      />
    </>
  );
}
