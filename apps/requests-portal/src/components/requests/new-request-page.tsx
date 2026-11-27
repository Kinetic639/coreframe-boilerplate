"use client";

import { ArrowLeft } from "lucide-react";
import { useTranslations } from "next-intl";
import { Link, useRouter } from "@/i18n/navigation";
import type { NewRequestOptions } from "@/server/requests/new-request-options";
import { NewRequestForm } from "./new-request-form";

export function NewRequestPage({ options }: { options: NewRequestOptions }) {
  const t = useTranslations("requests.new");
  const router = useRouter();
  const leave = () => (window.history.length > 1 ? router.back() : router.push("/"));
  return (
    <main className="flex w-full max-w-5xl flex-1 flex-col bg-background p-4 sm:p-6">
      {/* As the ERP's new ticket page: back to the list, the title, the two columns. */}
      <div className="flex flex-col gap-1 pb-4">
        <Link
          href="/"
          className="-ml-1 inline-flex w-fit items-center gap-1 rounded-md px-1 py-0.5 text-sm text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" />
          {t("backToList")}
        </Link>
        <h1 className="text-xl font-semibold tracking-tight">{t("heading")}</h1>
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
