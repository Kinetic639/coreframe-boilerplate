"use client";

import React, { useCallback, useEffect, useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { Building, Check, Loader2, Pencil, Search, User } from "lucide-react";
import { toast } from "react-toastify";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogTitle } from "@/components/ui/dialog";
import {
  lookupOrganizationEntityNumberForMovementAction,
  searchSuppliersAction,
} from "@/app/actions/warehouse/inventory";
import type { MovementPartyDetails } from "@/lib/warehouse/inventory-types";
import type { OrganizationEntityNumberLookup } from "@/server/services/organization.service";

export type SupplierFields = {
  name: string;
  nip: string;
  phone: string;
  street: string;
  postalCode: string;
  city: string;
  entityNumber?: number;
  crmPartyId?: string;
  counterpartyNumber?: number;
  branchId?: string;
  branchNumber?: number;
  branchSnapshot?: MovementPartyDetails["branchSnapshot"];
  counterpartySnapshot?: MovementPartyDetails["counterpartySnapshot"];
};

type Props = {
  fields: SupplierFields;
  locked: boolean;
  onFieldsChange: (fields: SupplierFields) => void;
  onLockedChange: (locked: boolean) => void;
  onSenderChange: (val: string) => void;
  onDetailsChange: (details: SupplierFields) => void;
};

type PartySectionProps = {
  title: string;
  detailsTitle: string;
  fields: SupplierFields;
  locked: boolean;
  showSupplierSearch?: boolean;
  lockedBadgeLabel?: string;
  onFieldsChange: (fields: SupplierFields) => void;
  onLockedChange: (locked: boolean) => void;
  onNameChange: (val: string) => void;
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

  return (
    <MovementPartySection
      title={t("sender")}
      detailsTitle={t("senderDetails")}
      fields={fields}
      locked={locked}
      showSupplierSearch
      lockedBadgeLabel={t("supplierLocked")}
      onFieldsChange={onFieldsChange}
      onLockedChange={onLockedChange}
      onNameChange={onSenderChange}
      onDetailsChange={onDetailsChange}
    />
  );
});

export const MovementPartySection = React.memo(function MovementPartySection({
  title,
  detailsTitle,
  fields,
  locked,
  showSupplierSearch = false,
  lockedBadgeLabel,
  onFieldsChange,
  onLockedChange,
  onNameChange,
  onDetailsChange,
}: PartySectionProps) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [dialogOpen, setDialogOpen] = useState(false);
  const [counterpartyInput, setCounterpartyInput] = useState(
    fields.entityNumber || fields.counterpartyNumber || fields.branchNumber
      ? String(fields.entityNumber ?? fields.counterpartyNumber ?? fields.branchNumber)
      : ""
  );
  const [lookupPending, startLookupTransition] = useTransition();

  const updateField = useCallback(
    (key: keyof SupplierFields, value: string) => {
      const next = { ...fields, [key]: value };
      onFieldsChange(next);
      if (key === "name") onNameChange(value);
      onDetailsChange(next);
    },
    [fields, onFieldsChange, onNameChange, onDetailsChange]
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
      onNameChange(supplier.name);
      onDetailsChange(next);
      setDialogOpen(false);
    },
    [fields, onFieldsChange, onNameChange, onDetailsChange]
  );

  const fillFromEntityNumber = useCallback(
    (lookup: OrganizationEntityNumberLookup) => {
      if (lookup.entity_type === "branch") {
        const next: SupplierFields = {
          ...fields,
          name: lookup.branch.name,
          entityNumber: lookup.entity_number,
          branchId: lookup.branch.id,
          branchNumber: lookup.branch.branch_number,
          branchSnapshot: lookup.branch,
          crmPartyId: undefined,
          counterpartyNumber: undefined,
          counterpartySnapshot: undefined,
        };
        setCounterpartyInput(String(lookup.entity_number));
        onFieldsChange(next);
        onNameChange(next.name);
        onDetailsChange(next);
        return;
      }

      const counterparty = lookup.party;
      const address = counterparty.address;
      const street = [address?.street, address?.building_number, address?.unit_number]
        .filter(Boolean)
        .join(" ");
      const next: SupplierFields = {
        ...fields,
        name: counterparty.legal_name ?? counterparty.display_name,
        nip: counterparty.tax_id ?? fields.nip,
        phone: counterparty.phone ?? fields.phone,
        street: street || fields.street,
        postalCode: address?.postal_code ?? fields.postalCode,
        city: address?.city ?? fields.city,
        entityNumber: lookup.entity_number,
        crmPartyId: counterparty.id,
        counterpartyNumber: counterparty.counterparty_number,
        counterpartySnapshot: counterparty,
        branchId: undefined,
        branchNumber: undefined,
        branchSnapshot: undefined,
      };
      setCounterpartyInput(String(lookup.entity_number));
      onFieldsChange(next);
      onNameChange(next.name);
      onDetailsChange(next);
    },
    [fields, onFieldsChange, onNameChange, onDetailsChange]
  );

  const lookupCounterparty = useCallback(() => {
    const counterpartyNumber = Number(counterpartyInput);
    if (!Number.isInteger(counterpartyNumber) || counterpartyNumber <= 0) {
      toast.error(t("counterpartyNumberInvalid"));
      return;
    }
    startLookupTransition(async () => {
      const result = await lookupOrganizationEntityNumberForMovementAction({
        number: counterpartyNumber,
      });
      if ("error" in result) {
        toast.error(result.error);
        return;
      }
      fillFromEntityNumber(result.data);
      toast.success(t("counterpartyFilled"));
    });
  }, [counterpartyInput, fillFromEntityNumber, t]);

  return (
    <section className="rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
          <User className="h-4 w-4" />
          {title}
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
              {showSupplierSearch && (
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
              )}
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
                {detailsTitle}
              </span>
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
            >
              {lockedBadgeLabel ?? t("supplierLocked")}
            </Badge>
          </div>
          <h4 className="text-sm font-bold text-foreground">{fields.name}</h4>
          <div className="text-xs text-muted-foreground font-mono space-y-0.5 mt-1.5">
            {(fields.entityNumber || fields.counterpartyNumber || fields.branchNumber) && (
              <p>
                {t("counterpartyNumber")}:{" "}
                <strong className="text-foreground">
                  {fields.entityNumber ?? fields.counterpartyNumber ?? fields.branchNumber}
                </strong>
              </p>
            )}
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
              {detailsTitle}
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
                {t("counterpartyNumber")}
              </label>
              <div className="flex gap-2">
                <Input
                  inputMode="numeric"
                  placeholder={t("counterpartyNumberPlaceholder")}
                  value={counterpartyInput}
                  onChange={(e) => setCounterpartyInput(e.target.value.replace(/\D/g, ""))}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") {
                      e.preventDefault();
                      lookupCounterparty();
                    }
                  }}
                  className="h-8 text-sm font-mono placeholder:font-normal placeholder:italic placeholder:text-muted-foreground/60"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-8 shrink-0"
                  onClick={lookupCounterparty}
                  disabled={lookupPending || !counterpartyInput}
                >
                  {lookupPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : t("fill")}
                </Button>
              </div>
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

      {showSupplierSearch && (
        <SupplierSearchDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          onSelect={fillFromSupplier}
        />
      )}
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
