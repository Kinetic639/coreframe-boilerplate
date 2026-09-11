"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter, usePathname, useSearchParams } from "next/navigation";
import { useTranslations } from "next-intl";
import { Search, Loader2, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { useDebounce } from "@/hooks/use-debounce";

/**
 * Phase 6 search box: a single input matching zl_number / VIN / order_number
 * (per RepairOrdersService.listForWorkshop's combined OR-ILIKE), driving the
 * `?q=` URL search param so the list page (server component) re-renders
 * with matching results. URL-search-param + server-rendering, per the
 * repository architecture choice sanctioned for this phase -- no new
 * client-side fetching paradigm introduced.
 */
export function RepairOrdersSearch({ initialQuery }: { initialQuery: string }) {
  const t = useTranslations("modules.workshop.repairOrders");
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [value, setValue] = useState(initialQuery);
  const [isPending, startTransition] = useTransition();
  const debouncedValue = useDebounce(value, 350);

  useEffect(() => {
    const current = searchParams.get("q") ?? "";
    if (debouncedValue === current) return;

    const params = new URLSearchParams(searchParams.toString());
    if (debouncedValue) {
      params.set("q", debouncedValue);
    } else {
      params.delete("q");
    }
    const query = params.toString();
    startTransition(() => {
      router.replace(query ? `${pathname}?${query}` : pathname);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debouncedValue]);

  return (
    <div className="relative w-full max-w-sm">
      <Search className="text-muted-foreground pointer-events-none absolute top-1/2 left-3 h-4 w-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={t("search.placeholder")}
        className="pl-9 pr-9"
        aria-label={t("search.placeholder")}
        data-testid="repair-orders-search-input"
      />
      {isPending ? (
        <Loader2 className="text-muted-foreground absolute top-1/2 right-3 h-4 w-4 -translate-y-1/2 animate-spin" />
      ) : (
        value && (
          <Button
            variant="ghost"
            size="icon"
            className="absolute top-1/2 right-1 h-7 w-7 -translate-y-1/2"
            onClick={() => setValue("")}
            aria-label={t("search.clear")}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        )
      )}
    </div>
  );
}
