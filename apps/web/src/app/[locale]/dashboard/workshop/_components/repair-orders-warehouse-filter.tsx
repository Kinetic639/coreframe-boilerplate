"use client";

import { useTransition } from "react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

const ALL = "__all";

/**
 * Warehouse filter for the RepairOrder list (`?mag=`): the same order number exists in several
 * DMS warehouses of a branch, so the list can be narrowed to one of them.
 */
export function RepairOrdersWarehouseFilter({
  warehouses,
  value,
}: {
  warehouses: { code: string; name: string | null }[];
  value: string | null;
}) {
  const t = useTranslations("modules.workshop.repairOrders.warehouseFilter");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [, startTransition] = useTransition();

  if (warehouses.length === 0) return null;

  return (
    <Select
      value={value ?? ALL}
      onValueChange={(next) => {
        const params = new URLSearchParams(searchParams.toString());
        if (next === ALL) params.delete("mag");
        else params.set("mag", next);
        const query = params.toString();
        startTransition(() => router.replace(query ? `${pathname}?${query}` : pathname));
      }}
    >
      <SelectTrigger className="h-9 w-48" aria-label={t("label")}>
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value={ALL}>{t("all")}</SelectItem>
        {warehouses.map((w) => (
          <SelectItem key={w.code} value={w.code}>
            {w.code}
            {w.name ? ` · ${w.name}` : ""}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}
