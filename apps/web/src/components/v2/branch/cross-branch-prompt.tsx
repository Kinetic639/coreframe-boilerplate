"use client";

import { useState } from "react";
import { toast } from "react-toastify";
import { ArrowLeftRight } from "lucide-react";
import { Link } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { changeBranch } from "@/app/actions/shared/changeBranch";
import { useAppStoreV2 } from "@/lib/stores/v2/app-store";

type Props = {
  /** Number of the object (shown in mono) */
  code: string;
  targetBranchId: string;
  labels: {
    title: string;
    description: string;
    confirm: string;
    cancel: string;
    switching: string;
    error: string;
  };
};

/**
 * An object opened from a link (notification, mention, search) lives in
 * another branch the reader can use. Nothing of it is shown until the reader
 * switches; the switch goes through `changeBranch()`, which re-validates
 * access, then the page reloads in the new branch (same contract as the
 * container prompt).
 */
export function CrossBranchPrompt({ code, targetBranchId, labels }: Props) {
  const [switching, setSwitching] = useState(false);

  async function handleConfirm() {
    setSwitching(true);
    try {
      const result = await changeBranch(targetBranchId);
      if (!result.success) {
        toast.error(labels.error);
        setSwitching(false);
        return;
      }
      useAppStoreV2.getState().setActiveBranch(targetBranchId);
      window.location.reload();
    } catch {
      toast.error(labels.error);
      setSwitching(false);
    }
  }

  return (
    <div className="flex justify-center p-6">
      <div
        role="alertdialog"
        aria-labelledby="cross-branch-title"
        className="bg-card border-border flex w-full max-w-md flex-col gap-4 rounded-lg border p-6"
        data-testid="cross-branch-prompt"
      >
        <div className="flex items-center gap-2">
          <ArrowLeftRight className="text-muted-foreground h-5 w-5" />
          <h1 id="cross-branch-title" className="text-lg font-semibold">
            {labels.title}
          </h1>
        </div>
        <p className="font-mono text-sm font-medium">{code}</p>
        <p className="text-muted-foreground text-sm">{labels.description}</p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={handleConfirm} disabled={switching}>
            {switching ? labels.switching : labels.confirm}
          </Button>
          <Button asChild type="button" variant="ghost" disabled={switching}>
            <Link href="/dashboard/start">{labels.cancel}</Link>
          </Button>
        </div>
      </div>
    </div>
  );
}
