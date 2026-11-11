"use client";

import { useState } from "react";
import { useRouter } from "@/i18n/navigation";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { RepairOrderAdvisorCandidate } from "@/server/services/repair-orders.service";
import { useCreateRepairOrderMutation } from "@/hooks/queries/workshop";

interface NewRepairOrderFormProps {
  advisorCandidates: RepairOrderAdvisorCandidate[];
  /** DMS warehouses of the active branch; with them the number is entered as number + warehouse. */
  warehouses?: { code: string; name: string | null; orderPrefix: "ZL" | "ZLEC" }[];
  canManageAll: boolean;
  ownAdvisorContactId: string | null;
}

const UNASSIGNED = "__unassigned__";

export function NewRepairOrderForm({
  advisorCandidates,
  warehouses = [],
  canManageAll,
  ownAdvisorContactId,
}: NewRepairOrderFormProps) {
  const t = useTranslations("modules.workshop.repairOrders");
  const router = useRouter();

  const [zlNumber, setZlNumber] = useState("");
  // Number + warehouse + year -> full DMS number (ZL/178024/26/3112/BL), prefix from the warehouse.
  const [orderNo, setOrderNo] = useState("");
  const [warehouseCode, setWarehouseCode] = useState(warehouses[0]?.code ?? "");
  const [year, setYear] = useState(String(new Date().getFullYear() % 100).padStart(2, "0"));
  const warehouse = warehouses.find((w) => w.code === warehouseCode) ?? null;
  const composedNumber =
    warehouse && orderNo && /^\d{2}$/.test(year)
      ? `${warehouse.orderPrefix}/${orderNo}/${year}/${warehouse.code}/BL`
      : null;
  const useWarehouses = warehouses.length > 0;
  const [orderNumber, setOrderNumber] = useState("");
  const [vin, setVin] = useState("");
  const [vehicleBrand, setVehicleBrand] = useState("");
  const [clientName, setClientName] = useState("");
  const [dealerName, setDealerName] = useState("");
  const [advisorValue, setAdvisorValue] = useState(UNASSIGNED);
  const [assignToSelf, setAssignToSelf] = useState(false);

  const createMutation = useCreateRepairOrderMutation((order) => {
    router.push({ pathname: "/dashboard/workshop/[id]", params: { id: order.id } });
  });

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const advisorContactId = canManageAll
      ? advisorValue === UNASSIGNED
        ? null
        : advisorValue
      : assignToSelf
        ? ownAdvisorContactId
        : null;

    createMutation.mutate({
      zl_number: useWarehouses ? composedNumber : zlNumber || null,
      order_number: orderNumber || null,
      vin: vin || null,
      vehicle_brand: vehicleBrand || null,
      client_name: clientName || null,
      dealer_name: dealerName || null,
      advisor_contact_id: advisorContactId,
    });
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-5">
      <p className="text-muted-foreground text-sm">{t("newOrder.description")}</p>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {useWarehouses ? (
          <div className="flex flex-col gap-1.5 sm:col-span-2">
            <Label htmlFor="ro-order-no">{t("newOrder.orderNo")}</Label>
            <div className="flex flex-wrap gap-2">
              <Input
                id="ro-order-no"
                value={orderNo}
                onChange={(e) => setOrderNo(e.target.value.replace(/\D/g, "").slice(0, 10))}
                placeholder="178024"
                inputMode="numeric"
                className="w-36 font-mono"
              />
              <Select value={warehouseCode} onValueChange={setWarehouseCode}>
                <SelectTrigger className="w-56" aria-label={t("columns.warehouse")}>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {warehouses.map((w) => (
                    <SelectItem key={w.code} value={w.code}>
                      {t("columns.warehouse")} {w.code}
                      {w.name ? ` · ${w.name}` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Input
                value={year}
                onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 2))}
                inputMode="numeric"
                className="w-16 font-mono"
                aria-label={t("newOrder.year")}
              />
            </div>
            <span className="text-muted-foreground text-xs">
              {composedNumber
                ? t("newOrder.composedNumber", { number: composedNumber })
                : t("newOrder.orderNoHint")}
            </span>
          </div>
        ) : (
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="ro-zl-number">{t("columns.zlNumber")}</Label>
            <Input
              id="ro-zl-number"
              value={zlNumber}
              onChange={(e) => setZlNumber(e.target.value)}
              placeholder={t("newOrder.zlNumberPlaceholder")}
              className="font-mono"
            />
            <span className="text-muted-foreground text-xs">{t("newOrder.zlNumberHint")}</span>
          </div>
        )}
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-order-number">{t("columns.orderNumber")}</Label>
          <Input
            id="ro-order-number"
            value={orderNumber}
            onChange={(e) => setOrderNumber(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-vin">{t("columns.vin")}</Label>
          <Input
            id="ro-vin"
            value={vin}
            onChange={(e) => setVin(e.target.value)}
            className="font-mono"
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-brand">{t("detail.vehicleBrand")}</Label>
          <Input
            id="ro-brand"
            value={vehicleBrand}
            onChange={(e) => setVehicleBrand(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-client">{t("detail.clientName")}</Label>
          <Input
            id="ro-client"
            value={clientName}
            onChange={(e) => setClientName(e.target.value)}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <Label htmlFor="ro-dealer">{t("detail.dealerName")}</Label>
          <Input
            id="ro-dealer"
            value={dealerName}
            onChange={(e) => setDealerName(e.target.value)}
          />
        </div>
      </div>

      {canManageAll ? (
        <div className="flex flex-col gap-1.5">
          <Label>{t("columns.advisor")}</Label>
          <Select value={advisorValue} onValueChange={setAdvisorValue}>
            <SelectTrigger className="w-full sm:w-72" data-testid="new-order-advisor-select">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value={UNASSIGNED}>{t("detail.unassignedAdvisor")}</SelectItem>
              {advisorCandidates.map((c) => (
                <SelectItem key={c.id} value={c.id}>
                  {c.displayName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      ) : (
        ownAdvisorContactId && (
          <div className="flex items-center gap-2">
            <Checkbox
              id="ro-assign-self"
              checked={assignToSelf}
              onCheckedChange={(v) => setAssignToSelf(v === true)}
            />
            <Label htmlFor="ro-assign-self" className="text-sm font-normal">
              {t("newOrder.assignToSelf")}
            </Label>
          </div>
        )
      )}

      <div className="flex items-center gap-2">
        <Button type="submit" disabled={createMutation.isPending} data-testid="create-order-submit">
          {createMutation.isPending && <Loader2 className="mr-1.5 h-4 w-4 animate-spin" />}
          {t("newOrder.submit")}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={() => router.push("/dashboard/workshop")}
          disabled={createMutation.isPending}
        >
          {t("detail.cancel")}
        </Button>
      </div>
    </form>
  );
}
