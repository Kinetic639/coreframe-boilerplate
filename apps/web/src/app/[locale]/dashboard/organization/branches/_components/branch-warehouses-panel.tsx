"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Pencil, Plus, Sparkles, Star, Trash2, Warehouse, X } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  branchStructureSuggestionsAction,
  createBranchWarehouseAction,
  createUnitWarehouseAction,
  listBranchWarehousesAction,
  removeBranchWarehouseAction,
  removeUnitWarehouseAction,
  setUnitDefaultWarehouseAction,
  updateBranchWarehouseAction,
  updateUnitWarehouseAction,
} from "@/app/actions/organization/branch-warehouses";
import type {
  BranchStructureSuggestions,
  BranchWarehouse,
  UnitWarehouse,
} from "@/server/services/branch-warehouses.service";

type UnitDraft = { code: string; name: string; orderPrefix: "ZL" | "ZLEC" };
type WarehouseDraft = { code: string; name: string };
const EMPTY_UNIT: UnitDraft = { code: "", name: "", orderPrefix: "ZL" };
const EMPTY_WAREHOUSE: WarehouseDraft = { code: "", name: "" };

/** "unit:<id>" / "unit:new" / "wh:<id>" / "wh-new:<unitId>" */
type Editing = string | null;

const digits = (value: string) => value.replace(/\D/g, "").slice(0, 5);

/**
 * Jednostki of a branch (AutoStacja's branches, e.g. 3112 Volkswagen) and their magazyny
 * (AS's warehouses, e.g. 115 blacharnia części), codes exactly as in AS. The prefix (ZL / ZLEC)
 * builds repair-order numbers; the default magazyn takes PZ lines whose document names none.
 * What the Matcher saw in this branch and is missing here is offered for adding.
 */
export function BranchWarehousesPanel({
  branchId,
  canManage,
}: {
  branchId: string;
  canManage: boolean;
}) {
  const t = useTranslations("modules.organizationManagement.branches.warehouses");
  const [items, setItems] = useState<BranchWarehouse[] | null>(null);
  const [suggestions, setSuggestions] = useState<BranchStructureSuggestions | null>(null);
  const [editing, setEditing] = useState<Editing>(null);
  const [unitDraft, setUnitDraft] = useState<UnitDraft>(EMPTY_UNIT);
  const [warehouseDraft, setWarehouseDraft] = useState<WarehouseDraft>(EMPTY_WAREHOUSE);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const [res, sug] = await Promise.all([
      listBranchWarehousesAction(branchId),
      canManage ? branchStructureSuggestionsAction(branchId) : Promise.resolve(null),
    ]);
    setItems(res.success ? (res as { data: BranchWarehouse[] }).data : []);
    setSuggestions(sug && sug.success ? (sug as { data: BranchStructureSuggestions }).data : null);
  }, [branchId, canManage]);

  useEffect(() => {
    void load();
  }, [load]);

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");

  const run = (action: () => Promise<{ success: boolean }>, after?: () => void) =>
    startTransition(async () => {
      const res = await action();
      if (!res.success) {
        toast.error(errorText((res as { success: false; error: string }).error));
        return;
      }
      after?.();
      await load();
    });

  const saveUnit = () =>
    run(
      () =>
        editing === "unit:new"
          ? createBranchWarehouseAction(branchId, unitDraft)
          : updateBranchWarehouseAction(String(editing).slice(5), unitDraft),
      () => setEditing(null)
    );

  const saveWarehouse = (unitId: string) =>
    run(
      () =>
        String(editing).startsWith("wh-new:")
          ? createUnitWarehouseAction(branchId, unitId, { ...warehouseDraft, isActive: true })
          : updateUnitWarehouseAction(String(editing).slice(3), {
              ...warehouseDraft,
              isActive: true,
            }),
      () => setEditing(null)
    );

  const removeUnit = (u: BranchWarehouse) => {
    if (!window.confirm(t("confirmRemove", { code: u.code }))) return;
    run(() => removeBranchWarehouseAction(u.id));
  };

  const removeWarehouse = (w: UnitWarehouse) => {
    if (!window.confirm(t("confirmRemoveWarehouse", { code: w.code }))) return;
    run(() => removeUnitWarehouseAction(w.id));
  };

  const toggleDefault = (u: BranchWarehouse, w: UnitWarehouse) =>
    run(() => setUnitDefaultWarehouseAction(u.id, u.defaultWarehouseId === w.id ? null : w.id));

  const iconButton = (
    label: string,
    onClick: () => void,
    icon: React.ReactNode,
    danger = false
  ) => (
    <Button
      size="icon"
      variant="ghost"
      className={cn("h-7 w-7", danger && "text-destructive hover:text-destructive")}
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={pending}
    >
      {icon}
    </Button>
  );

  const saveCancel = (onSave: () => void, canSave: boolean) => (
    <>
      <Button size="icon" className="h-8 w-8" onClick={onSave} disabled={pending || !canSave}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => setEditing(null)}
        disabled={pending}
        aria-label={t("cancel")}
      >
        <X className="h-4 w-4" />
      </Button>
    </>
  );

  const unitEditor = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={unitDraft.code}
        onChange={(e) => setUnitDraft({ ...unitDraft, code: digits(e.target.value) })}
        placeholder={t("codePlaceholder")}
        inputMode="numeric"
        className="h-8 w-20 font-mono"
        aria-label={t("code")}
      />
      <Input
        value={unitDraft.name}
        onChange={(e) => setUnitDraft({ ...unitDraft, name: e.target.value })}
        placeholder={t("namePlaceholder")}
        className="h-8 min-w-0 flex-1"
        aria-label={t("name")}
      />
      <Select
        value={unitDraft.orderPrefix}
        onValueChange={(v) =>
          setUnitDraft({ ...unitDraft, orderPrefix: v as UnitDraft["orderPrefix"] })
        }
      >
        <SelectTrigger className="h-8 w-24" aria-label={t("prefix")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ZL">ZL</SelectItem>
          <SelectItem value="ZLEC">ZLEC</SelectItem>
        </SelectContent>
      </Select>
      {saveCancel(saveUnit, !!unitDraft.code)}
    </div>
  );

  const warehouseEditor = (unitId: string) => (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={warehouseDraft.code}
        onChange={(e) => setWarehouseDraft({ ...warehouseDraft, code: digits(e.target.value) })}
        placeholder={t("warehouseCodePlaceholder")}
        inputMode="numeric"
        className="h-8 w-20 font-mono"
        aria-label={t("warehouseCode")}
        autoFocus
      />
      <Input
        value={warehouseDraft.name}
        onChange={(e) => setWarehouseDraft({ ...warehouseDraft, name: e.target.value })}
        placeholder={t("warehouseNamePlaceholder")}
        className="h-8 min-w-0 flex-1"
        aria-label={t("warehouseName")}
      />
      {saveCancel(() => saveWarehouse(unitId), !!warehouseDraft.code)}
    </div>
  );

  const unitsByCode = new Map((items ?? []).map((u) => [u.code, u]));
  const hasSuggestions =
    canManage && suggestions && (suggestions.units.length > 0 || suggestions.warehouses.length > 0);

  return (
    <div className="space-y-2" data-testid="branch-structure-panel">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            {t("title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && editing === null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setUnitDraft(EMPTY_UNIT);
              setEditing("unit:new");
            }}
          >
            <Plus className="mr-1 h-3.5 w-3.5" />
            {t("add")}
          </Button>
        )}
      </div>

      {items === null ? (
        <div className="h-8 animate-pulse rounded bg-muted" />
      ) : (
        <ul className="divide-y rounded-md border">
          {items.length === 0 && editing !== "unit:new" && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("empty")}</li>
          )}
          {items.map((u) => (
            <li key={u.id} className="space-y-2 px-3 py-2" data-testid="branch-unit">
              {editing === `unit:${u.id}` ? (
                unitEditor
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-14 font-mono font-medium">{u.code}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {u.name ?? <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {u.orderPrefix}
                  </span>
                  {canManage && editing === null && (
                    <span className="flex gap-1">
                      {iconButton(
                        t("edit"),
                        () => {
                          setUnitDraft({
                            code: u.code,
                            name: u.name ?? "",
                            orderPrefix: u.orderPrefix,
                          });
                          setEditing(`unit:${u.id}`);
                        },
                        <Pencil className="h-3.5 w-3.5" />
                      )}
                      {iconButton(
                        t("remove"),
                        () => removeUnit(u),
                        <Trash2 className="h-3.5 w-3.5" />,
                        true
                      )}
                    </span>
                  )}
                </div>
              )}

              {/* Magazyny of the jednostka */}
              <div className="ml-14 space-y-1">
                {u.warehouses.length === 0 && editing !== `wh-new:${u.id}` && (
                  <p className="text-xs text-muted-foreground">{t("noWarehouses")}</p>
                )}
                {u.warehouses.map((w) =>
                  editing === `wh:${w.id}` ? (
                    <div key={w.id}>{warehouseEditor(u.id)}</div>
                  ) : (
                    <div
                      key={w.id}
                      className="flex items-center gap-2 text-xs"
                      data-testid="unit-warehouse"
                    >
                      <span className="w-12 font-mono font-medium">{w.code}</span>
                      <span className="min-w-0 flex-1 truncate text-muted-foreground">
                        {w.name ?? "—"}
                      </span>
                      {u.defaultWarehouseId === w.id && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {t("default")}
                        </span>
                      )}
                      {canManage && editing === null && (
                        <span className="flex gap-0.5">
                          {iconButton(
                            u.defaultWarehouseId === w.id ? t("unsetDefault") : t("setDefault"),
                            () => toggleDefault(u, w),
                            <Star
                              className={cn(
                                "h-3.5 w-3.5",
                                u.defaultWarehouseId === w.id && "fill-primary text-primary"
                              )}
                            />
                          )}
                          {iconButton(
                            t("edit"),
                            () => {
                              setWarehouseDraft({ code: w.code, name: w.name ?? "" });
                              setEditing(`wh:${w.id}`);
                            },
                            <Pencil className="h-3.5 w-3.5" />
                          )}
                          {iconButton(
                            t("remove"),
                            () => removeWarehouse(w),
                            <Trash2 className="h-3.5 w-3.5" />,
                            true
                          )}
                        </span>
                      )}
                    </div>
                  )
                )}
                {editing === `wh-new:${u.id}` && warehouseEditor(u.id)}
                {canManage && editing === null && (
                  <Button
                    size="sm"
                    variant="ghost"
                    className="h-7 px-2 text-xs"
                    onClick={() => {
                      setWarehouseDraft(EMPTY_WAREHOUSE);
                      setEditing(`wh-new:${u.id}`);
                    }}
                  >
                    <Plus className="mr-1 h-3 w-3" />
                    {t("addWarehouse")}
                  </Button>
                )}
              </div>
            </li>
          ))}
          {editing === "unit:new" && <li className="px-3 py-2">{unitEditor}</li>}
        </ul>
      )}

      {hasSuggestions && (
        <div
          className="space-y-1.5 rounded-md border border-dashed p-3"
          data-testid="structure-suggestions"
        >
          <p className="flex items-center gap-1.5 text-xs font-medium">
            <Sparkles className="h-3.5 w-3.5 text-primary" />
            {t("suggestions.title")}
          </p>
          {suggestions!.units.map((s) => (
            <div key={`u-${s.code}`} className="flex items-center gap-2 text-xs">
              <span className="text-muted-foreground">{t("suggestions.unit")}</span>
              <span className="font-mono font-medium">{s.code}</span>
              <span className="min-w-0 flex-1 truncate">{s.name ?? "—"}</span>
              <span className="text-muted-foreground">
                {t("suggestions.seen", { count: s.seen })}
              </span>
              <Button
                size="sm"
                variant="outline"
                className="h-6 px-2 text-[11px]"
                disabled={pending}
                onClick={() =>
                  run(() =>
                    createBranchWarehouseAction(branchId, {
                      code: s.code,
                      name: s.name ?? "",
                      orderPrefix: "ZL",
                    })
                  )
                }
              >
                {t("suggestions.add")}
              </Button>
            </div>
          ))}
          {suggestions!.warehouses.map((s) => {
            const unit = s.unitCode ? unitsByCode.get(s.unitCode) : undefined;
            return (
              <div key={`w-${s.code}`} className="flex items-center gap-2 text-xs">
                <span className="text-muted-foreground">{t("suggestions.warehouse")}</span>
                <span className="font-mono font-medium">{s.code}</span>
                <span className="min-w-0 flex-1 truncate">
                  {s.name ?? "—"}
                  {s.unitCode && (
                    <span className="text-muted-foreground">
                      {" "}
                      · {t("suggestions.withUnit", { code: s.unitCode })}
                    </span>
                  )}
                </span>
                <span className="text-muted-foreground">
                  {t("suggestions.seen", { count: s.seen })}
                </span>
                <Button
                  size="sm"
                  variant="outline"
                  className="h-6 px-2 text-[11px]"
                  disabled={pending || !unit}
                  title={unit ? undefined : t("suggestions.needsUnit", { code: s.unitCode ?? "?" })}
                  onClick={() =>
                    unit &&
                    run(() =>
                      createUnitWarehouseAction(branchId, unit.id, {
                        code: s.code,
                        name: s.name ?? "",
                        isActive: true,
                      })
                    )
                  }
                >
                  {t("suggestions.add")}
                </Button>
              </div>
            );
          })}
          <p className="text-[11px] text-muted-foreground">{t("suggestions.hint")}</p>
        </div>
      )}
    </div>
  );
}
