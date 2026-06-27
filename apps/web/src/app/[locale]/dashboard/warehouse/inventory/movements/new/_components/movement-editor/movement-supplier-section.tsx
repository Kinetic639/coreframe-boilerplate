"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building, Check, Loader2, Pencil, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import { searchSuppliersAction } from "@/app/actions/warehouse/inventory";

export type SupplierFields = {
  name: string;
  nip: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
};

type Props = {
  fields: SupplierFields;
  locked: boolean;
  onFieldsChange: (fields: SupplierFields) => void;
  onLockedChange: (locked: boolean) => void;
  onSenderChange: (val: string) => void;
  onDetailsChange: (details: SupplierFields) => void;
};

type SupplierResult = { id: string; name: string; phone: string | null };

export const MovementSupplierSection = React.memo(function MovementSupplierSection({
  fields,
  locked,
  onFieldsChange,
  onLockedChange,
  onSenderChange,
  onDetailsChange,
}: Props) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [dialogOpen, setDialogOpen] = useState(false);

  const updateField = useCallback(
    (key: keyof SupplierFields, value: string) => {
      const next = { ...fields, [key]: value };
      onFieldsChange(next);
      if (key === "name") onSenderChange(value);
      onDetailsChange(next);
    },
    [fields, onFieldsChange, onSenderChange, onDetailsChange]
  );

  const handleLock = useCallback(() => {
    onLockedChange(true);
  }, [onLockedChange]);

  const handleUnlock = useCallback(() => {
    onLockedChange(false);
  }, [onLockedChange]);

  const fillFromSupplier = useCallback(
    (supplier: SupplierResult) => {
      const next: SupplierFields = {
        ...fields,
        name: supplier.name,
        phone: supplier.phone ?? fields.phone,
      };
      onFieldsChange(next);
      onSenderChange(supplier.name);
      onDetailsChange(next);
      setDialogOpen(false);
    },
    [fields, onFieldsChange, onSenderChange, onDetailsChange]
  );

  return (
    <section className="rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
          <User className="h-4 w-4" />
          {t("sender")}
        </div>
        <div className="flex items-center gap-1.5">
          {locked ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-7 text-xs gap-1.5"
              onClick={handleUnlock}
            >
              <Pencil className="h-3 w-3" />
              {t("editSupplier")}
            </Button>
          ) : (
            <>
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="h-7 text-xs gap-1.5"
                onClick={() => setDialogOpen(true)}
              >
                <Search className="h-3 w-3" />
                {t("searchSupplierBtn")}
              </Button>
              {fields.name && (
                <Button
                  type="button"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={handleLock}
                >
                  <Check className="h-3 w-3" />
                  {t("lockSupplier")}
                </Button>
              )}
            </>
          )}
        </div>
      </div>

      {locked ? (
        <div className="border rounded-sm bg-muted/30 p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
                {t("senderDetails")}
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
            >
              {t("supplierLocked")}
            </Badge>
          </div>
          <h4 className="text-sm font-bold text-foreground">{fields.name}</h4>
          <div className="text-xs text-muted-foreground font-mono space-y-0.5 mt-1.5">
            {fields.nip && (
              <p>
                NIP: <strong className="text-foreground">{fields.nip}</strong>
              </p>
            )}
            {fields.street && (
              <p>
                {fields.street}
                {fields.postalCode && `, ${fields.postalCode}`}
                {fields.city && ` ${fields.city}`}
              </p>
            )}
            {fields.phone && <p>Tel: {fields.phone}</p>}
          </div>
        </div>
      ) : (
        <div className="border rounded-sm bg-card p-3 space-y-3">
          <div className="flex items-center gap-1.5 border-b pb-2">
            <Building className="h-3.5 w-3.5 text-muted-foreground" />
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
              {t("senderDetails")}
            </span>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("companyName")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("companyNamePlaceholder")}
                value={fields.name}
                onChange={(e) => updateField("name", e.target.value)}
                className="h-8 text-sm font-semibold placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("nip")}
              </label>
              <Input
                placeholder={t("nipPlaceholder")}
                maxLength={10}
                value={fields.nip}
                onChange={(e) => updateField("nip", e.target.value.replace(/\D/g, ""))}
                className="h-8 text-sm font-mono placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("phone")}
              </label>
              <Input
                placeholder={t("phonePlaceholder")}
                value={fields.phone}
                onChange={(e) => updateField("phone", e.target.value)}
                className="h-8 text-sm font-mono placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("street")}
              </label>
              <Input
                placeholder={t("streetPlaceholder")}
                value={fields.street}
                onChange={(e) => updateField("street", e.target.value)}
                className="h-8 text-sm placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("postalCode")}
              </label>
              <Input
                placeholder={t("postalCodePlaceholder")}
                maxLength={6}
                value={fields.postalCode}
                onChange={(e) => updateField("postalCode", e.target.value)}
                className="h-8 text-sm font-mono placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("city")}
              </label>
              <Input
                placeholder={t("cityPlaceholder")}
                value={fields.city}
                onChange={(e) => updateField("city", e.target.value)}
                className="h-8 text-sm placeholder:italic placeholder:text-muted-foreground/60"
              />
            </div>
          </div>
        </div>
      )}

      <SupplierSearchDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        onSelect={fillFromSupplier}
      />
    </section>
  );
});

function SupplierSearchDialog({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (supplier: SupplierResult) => void;
}) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<SupplierResult[]>([]);
  const [isLoading, startTransition] = useTransition();

  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(query), 300);
    return () => clearTimeout(timer);
  }, [query]);

  useEffect(() => {
    if (!open) {
      setQuery("");
      setDebouncedQuery("");
      setResults([]);
      return;
    }
    startTransition(async () => {
      const r = (await searchSuppliersAction({
        query: debouncedQuery || undefined,
        limit: 30,
      })) as any;
      if (r.success) setResults(r.data ?? []);
      else setResults([]);
    });
  }, [open, debouncedQuery]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <div className="px-4 py-3 border-b">
          <DialogTitle className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
            <Search className="h-4 w-4" />
            {t("searchSupplierTitle")}
          </DialogTitle>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder={t("searchSupplierPlaceholder")}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              className="h-9 pl-10 text-sm"
              autoFocus
            />
          </div>
        </div>
        <div className="max-h-[300px] overflow-y-auto">
          {isLoading ? (
            <div className="py-8 flex items-center justify-center">
              <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
            </div>
          ) : results.length === 0 ? (
            <div className="py-8 text-center text-xs text-muted-foreground">
              {debouncedQuery ? t("searchSupplierEmpty") : t("searchSupplierHint")}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((supplier) => (
                <button
                  key={supplier.id}
                  type="button"
                  className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition flex items-center justify-between gap-3"
                  onClick={() => onSelect(supplier)}
                >
                  <div className="min-w-0">
                    <div className="text-sm font-semibold truncate">{supplier.name}</div>
                    {supplier.phone && (
                      <div className="text-xs text-muted-foreground font-mono">
                        {supplier.phone}
                      </div>
                    )}
                  </div>
                  <span className="text-xs text-primary font-semibold shrink-0">
                    {t("selectAndFill")}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
