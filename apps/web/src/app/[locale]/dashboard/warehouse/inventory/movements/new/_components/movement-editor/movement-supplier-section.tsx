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
  searchOrganizationEntitiesForMovementAction,
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
  canUnlock?: boolean;
  allowedEntityTypes?: Array<"branch" | "crm_party">;
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
  canUnlock?: boolean;
  showEntitySearch?: boolean;
  allowedEntityTypes?: Array<"branch" | "crm_party">;
  lockedBadgeLabel?: string;
  onFieldsChange: (fields: SupplierFields) => void;
  onLockedChange: (locked: boolean) => void;
  onNameChange: (val: string) => void;
  onDetailsChange: (details: SupplierFields) => void;
};

export const MovementSupplierSection = React.memo(function MovementSupplierSection({
  fields,
  locked,
  canUnlock,
  allowedEntityTypes = ["crm_party"],
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
      canUnlock={canUnlock}
      showEntitySearch
      allowedEntityTypes={allowedEntityTypes}
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
  canUnlock = true,
  showEntitySearch = false,
  allowedEntityTypes = ["branch", "crm_party"],
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
      if (!allowedEntityTypes.includes(result.data.entity_type)) {
        toast.error(t("entityTypeNotAllowed"));
        return;
      }
      fillFromEntityNumber(result.data);
      toast.success(t("counterpartyFilled"));
    });
  }, [allowedEntityTypes, counterpartyInput, fillFromEntityNumber, t]);

  return (
    <section className="rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
          <User className="h-4 w-4" />
          {title}
        </div>
        <div className="flex items-center gap-1.5">
          {locked ? (
            canUnlock ? (
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
            ) : null
          ) : (
            <>
              {showEntitySearch && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="h-7 text-xs gap-1.5"
                  onClick={() => setDialogOpen(true)}
                >
                  <Search className="h-3 w-3" />
                  {t("searchEntityBtn")}
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

      {showEntitySearch && (
        <OrganizationEntitySearchDialog
          open={dialogOpen}
          onOpenChange={setDialogOpen}
          entityTypes={allowedEntityTypes}
          onSelect={(lookup) => {
            fillFromEntityNumber(lookup);
            setDialogOpen(false);
          }}
        />
      )}
    </section>
  );
});

function OrganizationEntitySearchDialog({
  open,
  onOpenChange,
  entityTypes,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  entityTypes: Array<"branch" | "crm_party">;
  onSelect: (lookup: OrganizationEntityNumberLookup) => void;
}) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [query, setQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [results, setResults] = useState<OrganizationEntityNumberLookup[]>([]);
  const [isLoading, startTransition] = useTransition();
  const entityTypesKey = entityTypes.join(",");

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
      const r = await searchOrganizationEntitiesForMovementAction({
        query: debouncedQuery || undefined,
        entityTypes,
        limit: 30,
      });
      if ("data" in r) setResults(r.data ?? []);
      else setResults([]);
    });
  }, [open, debouncedQuery, entityTypes, entityTypesKey]);

  const title =
    entityTypes.length === 1 && entityTypes[0] === "branch"
      ? t("searchBranchesTitle")
      : entityTypes.length === 1 && entityTypes[0] === "crm_party"
        ? t("searchContractorsTitle")
        : t("searchEntityTitle");

  const placeholder =
    entityTypes.length === 1 && entityTypes[0] === "branch"
      ? t("searchBranchesPlaceholder")
      : entityTypes.length === 1 && entityTypes[0] === "crm_party"
        ? t("searchContractorsPlaceholder")
        : t("searchEntityPlaceholder");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0 gap-0">
        <div className="px-4 py-3 border-b">
          <DialogTitle className="text-xs uppercase font-bold tracking-widest flex items-center gap-2">
            <Search className="h-4 w-4" />
            {title}
          </DialogTitle>
        </div>
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="h-4 w-4 text-muted-foreground absolute left-3 top-2.5" />
            <Input
              placeholder={placeholder}
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
              {debouncedQuery ? t("searchEntityEmpty") : t("searchEntityHint")}
            </div>
          ) : (
            <div className="divide-y">
              {results.map((lookup) => {
                const isBranch = lookup.entity_type === "branch";
                const name = isBranch
                  ? lookup.branch.name
                  : (lookup.party.legal_name ?? lookup.party.display_name);
                const secondary = isBranch
                  ? lookup.branch.slug
                  : [lookup.party.tax_id, lookup.party.phone].filter(Boolean).join(" · ");

                return (
                  <button
                    key={`${lookup.entity_type}-${lookup.entity_number}`}
                    type="button"
                    className="w-full px-4 py-2.5 text-left hover:bg-muted/50 transition flex items-center justify-between gap-3"
                    onClick={() => onSelect(lookup)}
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div className="grid h-9 w-9 shrink-0 place-items-center rounded-sm border bg-muted text-xs font-bold">
                        {lookup.entity_number}
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-1.5">
                          <div className="truncate text-sm font-semibold">{name}</div>
                          <Badge variant="secondary" className="h-5 text-[10px]">
                            {isBranch ? t("entityBranch") : t("entityContractor")}
                          </Badge>
                        </div>
                        {secondary && (
                          <div className="text-xs text-muted-foreground font-mono">{secondary}</div>
                        )}
                      </div>
                    </div>
                    <span className="text-xs text-primary font-semibold shrink-0">
                      {t("selectAndFill")}
                    </span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
