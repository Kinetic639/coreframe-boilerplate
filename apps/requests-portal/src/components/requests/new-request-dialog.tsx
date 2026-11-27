"use client";

import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useTranslations } from "next-intl";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import type { NewRequestOptions } from "@/server/requests/new-request-options";
import { NewRequestForm } from "./new-request-form";

const optionsQuery = (scope: string) => ({
  queryKey: ["requests", scope, "form-options"] as const,
  queryFn: async (): Promise<NewRequestOptions> => {
    const res = await fetch("/api/requests/form-options", {
      cache: "no-store",
      credentials: "same-origin",
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res.json();
  },
  staleTime: 5 * 60 * 1000,
});

/** Loads the form's types and warehouses ahead (hover on the button). */
export function usePrefetchNewRequest(scope: string) {
  const qc = useQueryClient();
  return () => void qc.prefetchQuery(optionsQuery(scope));
}

/**
 * New request: the ERP's new ticket dialog (two columns; a full screen on a phone). Sending
 * opens the new request beside the list. /new is the same form on its own page.
 */
export function NewRequestDialog({
  scope,
  open,
  onOpenChange,
}: {
  scope: string;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const t = useTranslations("requests.new");
  const { data, isError } = useQuery({ ...optionsQuery(scope), enabled: open });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        className="flex h-[100dvh] max-h-[100dvh] w-full max-w-none flex-col gap-0 overflow-hidden rounded-none border-0 p-0 sm:h-auto sm:max-h-[90dvh] sm:max-w-[920px] sm:rounded-lg sm:border"
        onOpenAutoFocus={(e) => {
          // Start at the first field rather than on the close button.
          e.preventDefault();
          (e.currentTarget as HTMLElement | null)
            ?.querySelector<HTMLElement>("input:not([type=hidden]), button[role=combobox]")
            ?.focus();
        }}
      >
        <div className="shrink-0 border-b px-4 py-3 pr-12 text-left sm:px-6">
          <DialogTitle>{t("heading")}</DialogTitle>
          <DialogDescription className="sr-only">{t("subtitle")}</DialogDescription>
        </div>
        {data?.defaultBranchId ? (
          <NewRequestForm
            options={{ ...data, defaultBranchId: data.defaultBranchId }}
            onCancel={() => onOpenChange(false)}
            layout="dialog"
          />
        ) : data || isError ? (
          <p className="px-6 py-12 text-center text-sm text-muted-foreground">
            {isError ? t("errors.loadFailed") : t("noCreate")}
          </p>
        ) : (
          <div className="flex items-center justify-center px-6 py-16 text-muted-foreground">
            <Loader2 className="h-5 w-5 animate-spin" />
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
