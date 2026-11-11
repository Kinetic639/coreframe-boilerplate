"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Loader2 } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { setBranchExternalCodesAction } from "@/app/actions/warehouse/internal-orders";

/**
 * The codes each branch goes by in SVWMS / AutoStacja (the note code such as
 * WYSOG, the unit number such as 3642). A ZW ordered by another branch is
 * shipped to the branch with its code.
 */
export function BranchCodesSettings({
  branches,
  canManage,
}: {
  branches: Array<{ id: string; name: string; externalCodes: string[] }>;
  canManage: boolean;
}) {
  const t = useTranslations("modules.warehouse.internalOrders.branchCodes");
  const tErr = useTranslations("modules.warehouse.internalOrders.errors");
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [values, setValues] = useState<Record<string, string>>(() =>
    Object.fromEntries(branches.map((b) => [b.id, b.externalCodes.join(", ")]))
  );

  const save = (branchId: string) =>
    startTransition(async () => {
      const codes = (values[branchId] ?? "")
        .split(/[,;\s]+/)
        .map((c) => c.trim())
        .filter(Boolean);
      const result = await setBranchExternalCodesAction({ branchId, codes });
      if (!result.success) {
        const code = (result as { error: string }).error;
        toast.error(tErr.has(code) ? tErr(code) : tErr("unexpected"));
        return;
      }
      toast.success(t("saved"));
      router.refresh();
    });

  return (
    <section className="rounded-lg border p-4" data-testid="branch-codes-settings">
      <h2 className="text-base font-semibold">{t("title")}</h2>
      <p className="text-muted-foreground mb-3 text-sm">{t("description")}</p>
      <div className="divide-y">
        {branches.map((b) => (
          <div key={b.id} className="grid gap-2 py-2 sm:grid-cols-[14rem_1fr_auto] sm:items-center">
            <span className="text-sm font-medium">{b.name}</span>
            <Input
              value={values[b.id] ?? ""}
              onChange={(e) => setValues((current) => ({ ...current, [b.id]: e.target.value }))}
              placeholder={t("placeholder")}
              disabled={!canManage}
              className="h-9 font-mono"
              aria-label={t("codesFor", { branch: b.name })}
            />
            {canManage && (
              <Button
                type="button"
                size="sm"
                variant="outline"
                disabled={isPending}
                onClick={() => save(b.id)}
              >
                {isPending && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
                {t("save")}
              </Button>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
