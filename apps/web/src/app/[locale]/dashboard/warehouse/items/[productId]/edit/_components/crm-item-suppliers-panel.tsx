"use client";

import { useEffect, useMemo, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Plus, Search, Star, Trash2 } from "lucide-react";

import {
  createWarehouseItemSupplierAction,
  deleteWarehouseItemSupplierAction,
  listWarehouseItemSuppliersAction,
  searchCrmWarehouseSupplierPartiesAction,
} from "@/app/actions/warehouse/item-suppliers";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CrmSupplierOption } from "@/server/services/crm-parties.service";
import type { WarehouseItemSupplierRow } from "@/server/services/warehouse-item-suppliers.service";

type CrmItemSuppliersPanelProps = {
  itemId: string;
};

export function CrmItemSuppliersPanel({ itemId }: CrmItemSuppliersPanelProps) {
  const t = useTranslations("warehouseInventory.edit.crmSuppliers");
  const [rows, setRows] = useState<WarehouseItemSupplierRow[]>([]);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<CrmSupplierOption[]>([]);
  const [selectedPartyId, setSelectedPartyId] = useState("");
  const [supplierSku, setSupplierSku] = useState("");
  const [isPrimary, setIsPrimary] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const selectedSupplier = useMemo(
    () => results.find((supplier) => supplier.id === selectedPartyId),
    [results, selectedPartyId]
  );

  const loadRows = () => {
    startTransition(async () => {
      const result = await listWarehouseItemSuppliersAction(itemId);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }
      setRows(result.data);
    });
  };

  useEffect(() => {
    loadRows();
    // loadRows intentionally captures the current item id and transition state.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemId]);

  const search = () => {
    startTransition(async () => {
      const result = await searchCrmWarehouseSupplierPartiesAction({
        query,
        limit: 12,
      });

      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setResults(result.data);
      setSelectedPartyId(result.data[0]?.id ?? "");
      setMessage(null);
    });
  };

  const addSupplier = () => {
    if (!selectedPartyId) {
      return;
    }

    startTransition(async () => {
      const result = await createWarehouseItemSupplierAction({
        item_id: itemId,
        party_id: selectedPartyId,
        is_primary: isPrimary,
        supplier_sku: supplierSku || undefined,
      });

      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setRows(result.data);
      setSupplierSku("");
      setIsPrimary(false);
      setMessage(null);
    });
  };

  const removeSupplier = (supplierRowId: string) => {
    startTransition(async () => {
      const result = await deleteWarehouseItemSupplierAction(supplierRowId);
      if ("error" in result) {
        setMessage(result.error);
        return;
      }

      setRows((current) => current.filter((row) => row.id !== supplierRowId));
      setMessage(null);
    });
  };

  const formatSupplierLabel = (row: WarehouseItemSupplierRow) => {
    const name = row.supplier_name ?? row.party_id;
    if (!row.counterparty_number) {
      return name;
    }
    return `${row.counterparty_number} - ${name}`;
  };

  if (!itemId) {
    return null;
  }

  return (
    <section className="rounded-lg border border-border/70 p-4">
      <div className="flex flex-col gap-1 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold text-foreground">{t("title")}</h3>
          <p className="text-xs text-muted-foreground">{t("description")}</p>
        </div>
        {rows.some((row) => row.is_primary) ? (
          <Badge variant="secondary" className="w-fit gap-1">
            <Star className="h-3 w-3 fill-current" />
            {t("primary")}
          </Badge>
        ) : null}
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto]">
        <Input
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.preventDefault();
              search();
            }
          }}
          placeholder={t("searchPlaceholder")}
        />
        <Button type="button" variant="outline" onClick={search} disabled={isPending}>
          <Search className="mr-2 h-4 w-4" />
          {t("search")}
        </Button>
      </div>

      <div className="mt-3 grid gap-3 lg:grid-cols-[minmax(0,1fr)_180px_120px_auto]">
        <select
          className="h-10 rounded-md border border-input bg-background px-3 text-sm text-foreground"
          value={selectedPartyId}
          onChange={(event) => setSelectedPartyId(event.target.value)}
        >
          <option value="">{t("selectSupplier")}</option>
          {results.map((supplier) => (
            <option key={supplier.id} value={supplier.id}>
              {supplier.counterparty_number} - {supplier.display_name}
            </option>
          ))}
        </select>
        <Input
          value={supplierSku}
          onChange={(event) => setSupplierSku(event.target.value)}
          placeholder={t("supplierSku")}
        />
        <label className="flex h-10 items-center gap-2 rounded-md border border-input px-3 text-sm">
          <input
            type="checkbox"
            checked={isPrimary}
            onChange={(event) => setIsPrimary(event.target.checked)}
          />
          {t("primary")}
        </label>
        <Button type="button" onClick={addSupplier} disabled={isPending || !selectedPartyId}>
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      </div>

      {selectedSupplier ? (
        <p className="mt-2 text-xs text-muted-foreground">
          {selectedSupplier.email || selectedSupplier.phone || t("noContactData")}
        </p>
      ) : null}

      <div className="mt-4 space-y-2">
        {rows.length === 0 ? (
          <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
            {t("empty")}
          </p>
        ) : (
          rows.map((row) => (
            <div
              key={row.id}
              className="flex flex-col gap-3 rounded-md border border-border p-3 sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="truncate text-sm font-medium text-foreground">
                    {formatSupplierLabel(row)}
                  </p>
                  {row.is_primary ? (
                    <Badge variant="default" className="gap-1">
                      <Star className="h-3 w-3 fill-current" />
                      {t("primary")}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-xs text-muted-foreground">
                  {row.supplier_sku || t("noSku")}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => removeSupplier(row.id)}
                disabled={isPending}
              >
                <Trash2 className="mr-2 h-4 w-4" />
                {t("remove")}
              </Button>
            </div>
          ))
        )}
      </div>

      {message ? <p className="mt-3 text-sm text-destructive">{message}</p> : null}
    </section>
  );
}
