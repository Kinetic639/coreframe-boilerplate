"use client";

import React, { useState, useMemo } from "react";
import { useTranslations } from "next-intl";
import { Building, ChevronDown, Search, User } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

type Props = {
  counterpartyName: string;
  onCounterpartyChange: (val: string) => void;
};

export const MovementSupplierSection = React.memo(function MovementSupplierSection({
  counterpartyName,
  onCounterpartyChange,
}: Props) {
  const t = useTranslations("warehouseInventory.movementEditor");
  const [mode, setMode] = useState<"select" | "manual">("select");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  // Manual entry fields
  const [manualName, setManualName] = useState("");
  const [manualNip, setManualNip] = useState("");
  const [manualStreet, setManualStreet] = useState("");
  const [manualPostalCode, setManualPostalCode] = useState("");
  const [manualCity, setManualCity] = useState("");
  const [manualPhone, setManualPhone] = useState("");

  const [savedDetails, setSavedDetails] = useState<{
    name: string;
    nip: string;
    street: string;
    postalCode: string;
    city: string;
    phone: string;
  } | null>(null);

  const handleSaveManual = () => {
    if (!manualName || !manualNip || !manualStreet || !manualPostalCode || !manualCity) return;
    const details = {
      name: manualName.trim(),
      nip: manualNip.trim(),
      street: manualStreet.trim(),
      postalCode: manualPostalCode.trim(),
      city: manualCity.trim(),
      phone: manualPhone.trim(),
    };
    setSavedDetails(details);
    onCounterpartyChange(details.name);
    setMode("select");
    setManualName("");
    setManualNip("");
    setManualStreet("");
    setManualPostalCode("");
    setManualCity("");
    setManualPhone("");
  };

  return (
    <section className="rounded-sm border bg-card p-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2 text-xs uppercase font-bold tracking-wider text-muted-foreground">
          <User className="h-4 w-4" />
          {t("counterpartySupplier")}
        </div>
        <div className="flex items-center gap-0.5 rounded-sm border bg-muted p-0.5 select-none">
          <button
            type="button"
            onClick={() => setMode("select")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition",
              mode === "select"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("selectFromList")}
          </button>
          <button
            type="button"
            onClick={() => setMode("manual")}
            className={cn(
              "px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider rounded-sm transition",
              mode === "manual"
                ? "bg-primary text-primary-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            {t("enterManually")}
          </button>
        </div>
      </div>

      {mode === "manual" ? (
        <div className="border rounded-sm bg-card p-3 space-y-3">
          <div className="flex items-center justify-between border-b pb-2">
            <span className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground flex items-center gap-1.5">
              <Building className="h-3.5 w-3.5" />
              {t("newCounterpartyDetails")}
            </span>
            <Badge variant="outline" className="text-[10px] uppercase">
              {t("manualEntry")}
            </Badge>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("companyName")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("companyNamePlaceholder")}
                value={manualName}
                onChange={(e) => {
                  setManualName(e.target.value);
                  onCounterpartyChange(e.target.value);
                }}
                className="h-8 text-sm font-semibold"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("nip")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("nipPlaceholder")}
                maxLength={10}
                value={manualNip}
                onChange={(e) => setManualNip(e.target.value.replace(/\D/g, ""))}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("phone")}
              </label>
              <Input
                placeholder={t("phonePlaceholder")}
                value={manualPhone}
                onChange={(e) => setManualPhone(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("street")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("streetPlaceholder")}
                value={manualStreet}
                onChange={(e) => setManualStreet(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("postalCode")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("postalCodePlaceholder")}
                maxLength={6}
                value={manualPostalCode}
                onChange={(e) => setManualPostalCode(e.target.value)}
                className="h-8 text-sm font-mono"
              />
            </div>
            <div>
              <label className="block text-xs uppercase font-semibold text-muted-foreground mb-0.5">
                {t("city")} <span className="text-destructive">*</span>
              </label>
              <Input
                placeholder={t("cityPlaceholder")}
                value={manualCity}
                onChange={(e) => setManualCity(e.target.value)}
                className="h-8 text-sm"
              />
            </div>
          </div>
          <div className="pt-2.5 border-t flex items-center justify-between">
            <span className="text-[10px] text-muted-foreground">{t("requiredFields")}</span>
            <Button
              size="sm"
              className="h-8 text-xs uppercase font-bold"
              disabled={
                !manualName || !manualNip || !manualStreet || !manualPostalCode || !manualCity
              }
              onClick={handleSaveManual}
            >
              {t("confirmAndSelect")}
            </Button>
          </div>
        </div>
      ) : (
        <div className="relative">
          <button
            type="button"
            onClick={() => setDropdownOpen(!dropdownOpen)}
            className="w-full h-9 px-3 text-sm text-left rounded-sm border border-input bg-background flex items-center justify-between hover:bg-muted/50 transition"
          >
            <div className="flex items-center gap-2 truncate">
              <User className="h-3.5 w-3.5 text-muted-foreground" />
              <span
                className={cn(
                  "truncate",
                  counterpartyName ? "font-semibold text-foreground" : "text-muted-foreground"
                )}
              >
                {counterpartyName || t("selectSupplier")}
              </span>
            </div>
            <ChevronDown className="h-4 w-4 text-muted-foreground shrink-0" />
          </button>

          {dropdownOpen && (
            <>
              <div className="fixed inset-0 z-40" onClick={() => setDropdownOpen(false)} />
              <div className="absolute left-0 right-0 mt-1 rounded-sm border bg-popover shadow-lg z-50 p-2 space-y-2 max-h-52 overflow-y-auto">
                <div className="relative">
                  <Search className="h-3 w-3 text-muted-foreground absolute left-2.5 top-2.5" />
                  <Input
                    placeholder={t("searchByName")}
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-8 pl-8 text-xs"
                  />
                </div>
                <div className="text-xs text-muted-foreground py-3 text-center italic">
                  {t("typeSupplierHint")}
                </div>
              </div>
            </>
          )}
        </div>
      )}

      {/* Selected supplier card */}
      {counterpartyName && mode === "select" && (
        <div className="mt-2 p-3 rounded-sm border bg-muted/30">
          <div className="flex items-start justify-between gap-3">
            <div className="space-y-1">
              <h4 className="text-sm font-bold text-foreground">{counterpartyName}</h4>
              {savedDetails && (
                <div className="text-xs text-muted-foreground font-mono space-y-0.5">
                  <p>
                    NIP: <strong className="text-foreground">{savedDetails.nip}</strong>
                  </p>
                  <p>
                    {savedDetails.street}, {savedDetails.postalCode} {savedDetails.city}
                  </p>
                  {savedDetails.phone && <p>Tel: {savedDetails.phone}</p>}
                </div>
              )}
              {!savedDetails && (
                <p className="text-xs text-muted-foreground">{t("selectedCounterparty")}</p>
              )}
            </div>
            <Badge
              variant="outline"
              className="text-[10px] uppercase font-bold shrink-0 bg-emerald-500/10 text-emerald-600 border-emerald-500/30"
            >
              {t("counterpartyBadge")}
            </Badge>
          </div>
        </div>
      )}
    </section>
  );
});
