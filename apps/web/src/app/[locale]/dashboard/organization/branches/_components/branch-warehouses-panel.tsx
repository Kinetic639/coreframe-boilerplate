"use client";

import { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Check, Loader2, Pencil, Plus, Trash2, Warehouse, X } from "lucide-react";
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
import {
  createBranchWarehouseAction,
  listBranchWarehousesAction,
  removeBranchWarehouseAction,
  updateBranchWarehouseAction,
} from "@/app/actions/organization/branch-warehouses";
import type { BranchWarehouse } from "@/server/services/branch-warehouses.service";

type Draft = { code: string; name: string; orderPrefix: "ZL" | "ZLEC" };
const EMPTY: Draft = { code: "", name: "", orderPrefix: "ZL" };

/**
 * DMS warehouses of a branch (e.g. 3112 Volkswagen, 3332 Škoda). Repair orders keep their
 * warehouse as a separate field, and the number prefix (ZL / ZLEC) set here lets Ambra build
 * a full order number from number + warehouse.
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
  const [editingId, setEditingId] = useState<string | "new" | null>(null);
  const [draft, setDraft] = useState<Draft>(EMPTY);
  const [pending, startTransition] = useTransition();

  const load = useCallback(async () => {
    const res = await listBranchWarehousesAction(branchId);
    setItems(res.success ? res.data : []);
  }, [branchId]);

  useEffect(() => {
    void load();
  }, [load]);

  const errorText = (code: string) =>
    t.has(`errors.${code}`) ? t(`errors.${code}`) : t("errors.generic");

  const save = () =>
    startTransition(async () => {
      const input = { code: draft.code, name: draft.name, orderPrefix: draft.orderPrefix };
      const res =
        editingId === "new"
          ? await createBranchWarehouseAction(branchId, input)
          : await updateBranchWarehouseAction(editingId as string, input);
      if (!res.success) {
        toast.error(errorText((res as { success: false; error: string }).error));
        return;
      }
      setEditingId(null);
      await load();
    });

  const remove = (w: BranchWarehouse) =>
    startTransition(async () => {
      if (!window.confirm(t("confirmRemove", { code: w.code }))) return;
      const res = await removeBranchWarehouseAction(w.id);
      if (!res.success) toast.error(errorText((res as { success: false; error: string }).error));
      await load();
    });

  const editor = (
    <div className="flex flex-wrap items-center gap-2">
      <Input
        value={draft.code}
        onChange={(e) =>
          setDraft({ ...draft, code: e.target.value.replace(/\D/g, "").slice(0, 5) })
        }
        placeholder={t("codePlaceholder")}
        inputMode="numeric"
        className="h-8 w-20 font-mono"
        aria-label={t("code")}
      />
      <Input
        value={draft.name}
        onChange={(e) => setDraft({ ...draft, name: e.target.value })}
        placeholder={t("namePlaceholder")}
        className="h-8 min-w-0 flex-1"
        aria-label={t("name")}
      />
      <Select
        value={draft.orderPrefix}
        onValueChange={(v) => setDraft({ ...draft, orderPrefix: v as Draft["orderPrefix"] })}
      >
        <SelectTrigger className="h-8 w-24" aria-label={t("prefix")}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="ZL">ZL</SelectItem>
          <SelectItem value="ZLEC">ZLEC</SelectItem>
        </SelectContent>
      </Select>
      <Button size="icon" className="h-8 w-8" onClick={save} disabled={pending || !draft.code}>
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
      </Button>
      <Button
        size="icon"
        variant="ghost"
        className="h-8 w-8"
        onClick={() => setEditingId(null)}
        disabled={pending}
        aria-label={t("cancel")}
      >
        <X className="h-4 w-4" />
      </Button>
    </div>
  );

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <div>
          <p className="flex items-center gap-1.5 text-sm font-semibold">
            <Warehouse className="h-4 w-4 text-muted-foreground" />
            {t("title")}
          </p>
          <p className="text-xs text-muted-foreground">{t("subtitle")}</p>
        </div>
        {canManage && editingId === null && (
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setDraft(EMPTY);
              setEditingId("new");
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
          {items.length === 0 && editingId !== "new" && (
            <li className="px-3 py-2 text-sm text-muted-foreground">{t("empty")}</li>
          )}
          {items.map((w) => (
            <li key={w.id} className="px-3 py-2">
              {editingId === w.id ? (
                editor
              ) : (
                <div className="flex items-center gap-3 text-sm">
                  <span className="w-14 font-mono font-medium">{w.code}</span>
                  <span className="min-w-0 flex-1 truncate">
                    {w.name ?? <span className="text-muted-foreground">—</span>}
                  </span>
                  <span className="rounded border px-1.5 py-0.5 font-mono text-[11px] text-muted-foreground">
                    {w.orderPrefix}
                  </span>
                  {canManage && editingId === null && (
                    <span className="flex gap-1">
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        aria-label={t("edit")}
                        onClick={() => {
                          setDraft({
                            code: w.code,
                            name: w.name ?? "",
                            orderPrefix: w.orderPrefix,
                          });
                          setEditingId(w.id);
                        }}
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7 text-destructive hover:text-destructive"
                        aria-label={t("remove")}
                        onClick={() => remove(w)}
                        disabled={pending}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </span>
                  )}
                </div>
              )}
            </li>
          ))}
          {editingId === "new" && <li className="px-3 py-2">{editor}</li>}
        </ul>
      )}
    </div>
  );
}
