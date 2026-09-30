"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { ArrowLeftRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";

type Props = {
  containerCode: string;
  targetBranchId: string;
  targetBranchName: string;
};

/**
 * Phase 10D: a scanned container lives in another branch the caller can
 * read. Same confirm-then-switch contract as the location QR flow (Zone 1
 * Phase 6): nothing of the container is shown until the switch, and the
 * switch goes through the authoritative `changeBranch()` action, which
 * re-validates access itself.
 *
 * After a successful switch this reloads the page (full document) instead of
 * `router.replace` + `router.refresh`, so it is not exposed to the
 * in-transition navigation hang tracked as BLOCKER-Z1-019. `setActiveBranch`
 * still runs first so the per-tab session branch matches the new server
 * branch when the reloaded page hydrates.
 */
export function ContainerCrossBranchPrompt({
  containerCode,
  targetBranchId,
  targetBranchName,
}: Props) {
  const t = useTranslations("modules.warehouse.containers.crossBranch");
  const [switching, setSwitching] = useState(false);

  async function handleConfirm() {
    setSwitching(true);
    try {
      const result = await changeBranch(targetBranchId);
      if (!result.success) {
        toast.error(t("error"));
        setSwitching(false);
        return;
      }
      useAppStoreV2.getState().setActiveBranch(targetBranchId);
      window.location.reload();
    } catch {
      toast.error(t("error"));
      setSwitching(false);
    }
  }

  return (
    <div className="flex justify-center p-6">
      <div
        role="alertdialog"
        aria-labelledby="container-cross-branch-title"
        className="bg-card border-border flex w-full max-w-md flex-col gap-4 rounded-lg border p-6"
        data-testid="container-cross-branch-prompt"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="text-muted-foreground h-5 w-5" />
          <h1 id="container-cross-branch-title" className="text-lg font-semibold">
            {t("title")}
          </h1>
        </div>
        <p className="font-mono text-sm font-medium">{containerCode}</p>
        <p className="text-muted-foreground text-sm">
          {t("description", { branch: targetBranchName })}
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            type="button"
            onClick={handleConfirm}
            disabled={switching}
            data-testid="container-cross-branch-confirm"
          >
            {switching ? t("switching") : t("confirm")}
          </Button>
          <Button asChild type="button" variant="ghost" disabled={switching}>
            <Link href="/dashboard/start">{t("cancel")}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
