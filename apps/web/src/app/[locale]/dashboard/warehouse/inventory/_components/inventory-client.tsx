"use client";

import { useMemo, useState, useTransition } from "react";
import { ArrowDownToLine, ArrowRightLeft, ArrowUpFromLine, SlidersHorizontal } from "lucide-react";
import { DataView } from "@/components/data-view/data-view";
import type { DataViewColumnDef, DataViewListParams, PaginatedResult } from "@/lib/data-view/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type {
  InventoryBalanceDetail,
  InventoryBalanceListRow,
  InventoryVariantOption,
} from "@/lib/warehouse/inventory-types";
import {
  adjustStockAction,
  getInventoryBalanceAction,
  issueStockAction,
  listInventoryBalancesAction,
  receiveStockAction,
  transferStockAction,
} from "@/app/actions/warehouse/inventory";

type LocationOption = {
  id: string;
  name: string;
  code: string | null;
};

type InventoryClientProps = {
  initialData: PaginatedResult<InventoryBalanceListRow>;
  variants: InventoryVariantOption[];
  locations: LocationOption[];
  canOperate: boolean;
  canAdjust: boolean;
};

async function listFetcher(params: DataViewListParams) {
  const result = await listInventoryBalancesAction(params);
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

async function detailFetcher(id: string) {
  const result = await getInventoryBalanceAction({ id });
  if (!result.success || !("data" in result))
    throw new Error("error" in result ? result.error : "Unauthorized");
  return result.data;
}

function VariantFields({ variants }: { variants: InventoryVariantOption[] }) {
  return (
    <>
      <select
        name="variant_id"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        required
      >
        <option value="">Variant</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.id} data-unit-id={variant.unit_id}>
            {variant.label}
          </option>
        ))}
      </select>
      <select
        name="unit_id"
        className="h-10 rounded-md border border-input bg-background px-3 text-sm"
        required
      >
        <option value="">Unit</option>
        {variants.map((variant) => (
          <option key={variant.id} value={variant.unit_id}>
            {variant.sku} / {variant.unit_code}
          </option>
        ))}
      </select>
    </>
  );
}

function LocationSelect({
  name,
  locations,
  placeholder,
}: {
  name: string;
  locations: LocationOption[];
  placeholder: string;
}) {
  return (
    <select
      name={name}
      className="h-10 rounded-md border border-input bg-background px-3 text-sm"
      required
    >
      <option value="">{placeholder}</option>
      {locations.map((location) => (
        <option key={location.id} value={location.id}>
          {location.code ? `${location.code} - ${location.name}` : location.name}
        </option>
      ))}
    </select>
  );
}

export function InventoryClient({
  initialData,
  variants,
  locations,
  canOperate,
  canAdjust,
}: InventoryClientProps) {
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const columns = useMemo<DataViewColumnDef<InventoryBalanceListRow>[]>(
    () => [
      {
        key: "sku",
        header: "SKU",
        accessor: (row) => <span className="font-medium">{row.sku}</span>,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "product_name",
        header: "Product",
        accessor: (row) => row.product_name,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "location_name",
        header: "Location",
        accessor: (row) =>
          row.location_code ? `${row.location_code} - ${row.location_name}` : row.location_name,
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "on_hand_quantity",
        header: "On hand",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.on_hand_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "available_quantity",
        header: "Available",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.available_quantity} {row.unit_code}
          </span>
        ),
        sortable: true,
        defaultVisible: true,
      },
      {
        key: "average_unit_cost",
        header: "Avg cost",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.average_unit_cost.toFixed(2)} {row.currency}
          </span>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "total_value",
        header: "Value",
        accessor: (row) => (
          <span className="tabular-nums">
            {row.total_value.toFixed(2)} {row.currency}
          </span>
        ),
        sortable: false,
        defaultVisible: true,
      },
      {
        key: "last_movement_number",
        header: "Last movement",
        accessor: (row) => row.last_movement_number ?? "",
        defaultVisible: true,
      },
    ],
    []
  );

  const submitAction = (action: (payload: any) => Promise<any>) => {
    return (formData: FormData) => {
      setMessage(null);
      startTransition(async () => {
        const payload = Object.fromEntries(formData.entries());
        const result = await action({
          ...payload,
          quantity: Number(payload.quantity),
        });
        setMessage(result.success ? "Stock movement posted" : (result.error ?? "Unexpected error"));
      });
    };
  };

  return (
    <div className="flex h-full flex-col gap-4">
      <div className="grid gap-3 border-b pb-4 xl:grid-cols-4">
        {canOperate ? (
          <>
            <form action={submitAction(receiveStockAction)} className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowDownToLine className="h-4 w-4" />
                Receive
              </div>
              <VariantFields variants={variants} />
              <LocationSelect
                name="destination_location_id"
                locations={locations}
                placeholder="Destination"
              />
              <Input
                name="quantity"
                type="number"
                min="0.000001"
                step="0.000001"
                placeholder="Qty"
              />
              <Button type="submit" disabled={isPending}>
                Post receipt
              </Button>
            </form>

            <form action={submitAction(issueStockAction)} className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowUpFromLine className="h-4 w-4" />
                Issue
              </div>
              <VariantFields variants={variants} />
              <LocationSelect
                name="source_location_id"
                locations={locations}
                placeholder="Source"
              />
              <Input
                name="quantity"
                type="number"
                min="0.000001"
                step="0.000001"
                placeholder="Qty"
              />
              <Button type="submit" disabled={isPending}>
                Post issue
              </Button>
            </form>

            <form action={submitAction(transferStockAction)} className="grid gap-2">
              <div className="flex items-center gap-2 text-sm font-medium">
                <ArrowRightLeft className="h-4 w-4" />
                Transfer
              </div>
              <VariantFields variants={variants} />
              <LocationSelect
                name="source_location_id"
                locations={locations}
                placeholder="Source"
              />
              <LocationSelect
                name="destination_location_id"
                locations={locations}
                placeholder="Destination"
              />
              <Input
                name="quantity"
                type="number"
                min="0.000001"
                step="0.000001"
                placeholder="Qty"
              />
              <Button type="submit" disabled={isPending}>
                Post transfer
              </Button>
            </form>
          </>
        ) : null}

        {canAdjust ? (
          <form action={submitAction(adjustStockAction)} className="grid gap-2">
            <div className="flex items-center gap-2 text-sm font-medium">
              <SlidersHorizontal className="h-4 w-4" />
              Adjust
            </div>
            <VariantFields variants={variants} />
            <LocationSelect name="location_id" locations={locations} placeholder="Location" />
            <select
              name="adjustment_direction"
              className="h-10 rounded-md border border-input bg-background px-3 text-sm"
              required
            >
              <option value="increase">increase</option>
              <option value="decrease">decrease</option>
            </select>
            <Input name="quantity" type="number" min="0.000001" step="0.000001" placeholder="Qty" />
            <Button type="submit" disabled={isPending}>
              Post adjustment
            </Button>
          </form>
        ) : null}
      </div>

      {message ? <p className="text-sm text-muted-foreground">{message}</p> : null}

      <DataView<InventoryBalanceListRow, InventoryBalanceDetail>
        entity="inventory-balances"
        columns={columns}
        initialData={initialData}
        queryKey={["inventory-balances"]}
        listFetcher={listFetcher}
        detailFetcher={detailFetcher}
        getRowId={(row) => row.id}
        renderDetail={(detail) => (
          <div className="space-y-4">
            <div>
              <h2 className="text-lg font-semibold">{detail.product_name}</h2>
              <p className="text-sm text-muted-foreground">{detail.sku}</p>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div>
                <p className="text-xs uppercase text-muted-foreground">Location</p>
                <p>{detail.location_name}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Last movement</p>
                <p>{detail.last_movement_number ?? ""}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Reserved</p>
                <p>{detail.reserved_quantity}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Allocated</p>
                <p>{detail.allocated_quantity}</p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Average cost</p>
                <p>
                  {detail.average_unit_cost.toFixed(2)} {detail.currency}
                </p>
              </div>
              <div>
                <p className="text-xs uppercase text-muted-foreground">Total value</p>
                <p>
                  {detail.total_value.toFixed(2)} {detail.currency}
                </p>
              </div>
            </div>
          </div>
        )}
        className="min-h-0 flex-1"
      />
    </div>
  );
}
