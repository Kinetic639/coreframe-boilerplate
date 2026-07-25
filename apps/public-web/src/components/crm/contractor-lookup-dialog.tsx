"use client";

import { useEffect, useState, useTransition } from "react";
import { Building2, Mail, Phone, Search, SlidersHorizontal } from "lucide-react";
import { useTranslations } from "next-intl";

import {
  searchCrmContractorsForLookupAction,
  type CrmContractorLookupOption,
} from "@/app/actions/crm";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { CrmPartyRole } from "@/lib/validations/crm";
import { cn } from "@/utils";

export type ContractorLookupSelection = CrmContractorLookupOption;

type ContractorLookupDialogProps = {
  role?: CrmPartyRole;
  triggerLabel: string;
  selected?: ContractorLookupSelection | null;
  excludeIds?: string[];
  onSelect: (contractor: ContractorLookupSelection) => void;
  disabled?: boolean;
  className?: string;
};

export function ContractorLookupDialog({
  role,
  triggerLabel,
  selected,
  excludeIds = [],
  onSelect,
  disabled,
  className,
}: ContractorLookupDialogProps) {
  const t = useTranslations("modules.crm.contractorLookup");
  const tRoles = useTranslations("modules.crm.roles");
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [number, setNumber] = useState("");
  const [name, setName] = useState("");
  const [taxId, setTaxId] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [results, setResults] = useState<ContractorLookupSelection[]>([]);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (!open) return;
    const timer = window.setTimeout(() => {
      const parsedNumber = Number(number);
      startTransition(async () => {
        const result = await searchCrmContractorsForLookupAction({
          role,
          query: query || undefined,
          number: Number.isInteger(parsedNumber) && parsedNumber > 0 ? parsedNumber : undefined,
          name: name || undefined,
          taxId: taxId || undefined,
          email: email || undefined,
          phone: phone || undefined,
          limit: 30,
        });
        if ("error" in result) {
          setResults([]);
          setMessage(result.error);
          return;
        }
        setResults(result.data.filter((item) => !excludeIds.includes(item.id)));
        setMessage(null);
      });
    }, 250);
    return () => window.clearTimeout(timer);
  }, [email, excludeIds, name, number, open, phone, query, role]);

  const selectContractor = (contractor: ContractorLookupSelection) => {
    onSelect(contractor);
    setOpen(false);
  };

  const renderLogo = (contractor: ContractorLookupSelection) => (
    <div className="grid h-12 w-12 shrink-0 place-items-center overflow-hidden rounded-md border border-border bg-muted">
      {contractor.logo_signed_url ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={contractor.logo_signed_url}
          alt=""
          className="h-full w-full object-cover"
          loading="lazy"
        />
      ) : (
        <Building2 className="h-5 w-5 text-muted-foreground" />
      )}
    </div>
  );

  return (
    <>
      <Button
        type="button"
        variant={selected ? "outline" : "default"}
        onClick={() => setOpen(true)}
        disabled={disabled}
        className={cn("justify-start gap-2", className)}
      >
        <Search className="h-4 w-4" />
        {selected ? `${selected.counterparty_number} - ${selected.display_name}` : triggerLabel}
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="flex max-h-[88vh] max-w-5xl flex-col gap-0 overflow-hidden p-0">
          <DialogHeader className="border-b px-5 py-4">
            <DialogTitle className="flex items-center gap-2 text-base">
              <SlidersHorizontal className="h-4 w-4" />
              {t("title")}
            </DialogTitle>
            <DialogDescription>{t("description")}</DialogDescription>
          </DialogHeader>

          <div className="grid gap-3 border-b px-5 py-4 lg:grid-cols-[1.3fr_160px_1fr]">
            <Input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder={t("query")}
              autoFocus
            />
            <Input
              value={number}
              inputMode="numeric"
              onChange={(event) => setNumber(event.target.value.replace(/[^\d]/g, ""))}
              placeholder={t("number")}
            />
            <Input
              value={name}
              onChange={(event) => setName(event.target.value)}
              placeholder={t("name")}
            />
            <Input
              value={taxId}
              onChange={(event) => setTaxId(event.target.value)}
              placeholder={t("taxId")}
            />
            <Input
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder={t("email")}
            />
            <Input
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder={t("phone")}
            />
          </div>

          <div className="min-h-72 overflow-y-auto px-5 py-4">
            {isPending ? (
              <div className="grid min-h-56 place-items-center text-sm text-muted-foreground">
                {t("loading")}
              </div>
            ) : message ? (
              <div className="rounded-md border border-destructive/40 p-4 text-sm text-destructive">
                {message}
              </div>
            ) : results.length === 0 ? (
              <div className="grid min-h-56 place-items-center rounded-md border border-dashed border-border text-sm text-muted-foreground">
                {t("empty")}
              </div>
            ) : (
              <div className="grid gap-3 md:grid-cols-2">
                {results.map((contractor) => (
                  <button
                    key={contractor.id}
                    type="button"
                    className="flex min-w-0 gap-3 rounded-md border border-border p-3 text-left transition hover:border-primary hover:bg-muted/50"
                    onClick={() => selectContractor(contractor)}
                  >
                    {renderLogo(contractor)}
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="font-mono text-xs text-muted-foreground">
                          #{contractor.counterparty_number}
                        </span>
                        {contractor.roles?.map((item) => (
                          <Badge key={item} variant="secondary" className="h-5">
                            {tRoles(item)}
                          </Badge>
                        ))}
                      </div>
                      <div className="mt-1 truncate text-sm font-semibold">
                        {contractor.display_name}
                      </div>
                      {contractor.legal_name ? (
                        <div className="truncate text-xs text-muted-foreground">
                          {contractor.legal_name}
                        </div>
                      ) : null}
                      <div className="mt-2 flex flex-wrap gap-x-3 gap-y-1 text-xs text-muted-foreground">
                        {contractor.tax_id ? (
                          <span>
                            {t("taxIdShort")}: {contractor.tax_id}
                          </span>
                        ) : null}
                        {contractor.email ? (
                          <span className="inline-flex items-center gap-1">
                            <Mail className="h-3 w-3" />
                            {contractor.email}
                          </span>
                        ) : null}
                        {contractor.phone ? (
                          <span className="inline-flex items-center gap-1">
                            <Phone className="h-3 w-3" />
                            {contractor.phone}
                          </span>
                        ) : null}
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
