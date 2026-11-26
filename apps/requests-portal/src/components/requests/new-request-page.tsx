"use client";

import { X } from "lucide-react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { useRouter } from "@/i18n/navigation";
import type { NewRequestOptions } from "@/server/requests/new-request-options";
import { NewRequestForm } from "./new-request-form";

export function NewRequestPage({ options }: { options: NewRequestOptions }) {
  const t = useTranslations("requests.new");
  const router = useRouter();
  const leave = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col bg-background md:my-6 md:rounded-lg md:border">
      <div className="sticky top-0 z-10 flex items-center gap-2 border-b bg-background px-2 py-2">
        <Button variant="ghost" size="icon" aria-label={t("cancel")} onClick={leave}>
          <X className="h-5 w-5" />
        </Button>
        <h1 className="text-base font-semibold">{t("heading")}</h1>
      </div>
      {options.defaultBranchId ? (
        <NewRequestForm
          options={{ ...options, defaultBranchId: options.defaultBranchId }}
          onCancel={leave}
          layout="page"
        />
      ) : (
        <p className="px-4 py-12 text-center text-sm text-muted-foreground">{t("noCreate")}</p>
      )}
    </main>
  );
}
