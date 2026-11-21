"use client";

import { planningRead } from "@/lib/planning/read";
import { useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useTranslations } from "next-intl";
import { Link2Off, Loader2, Plus, QrCode } from "lucide-react";
import { toast } from "react-toastify";
import { Button } from "@/components/ui/button";
import { assignQrToPlanningTaskAction } from "@/app/actions/planning";
import { revokeQrAction } from "@/app/actions/qr/revoke";
import { appRead } from "@/lib/read";

interface QrOption {
  id: string;
  label: string | null;
  status: string;
  assignment: { target_type: string; target_id: string } | null;
}

/** The task's QR code: show it, link a free one, or unlink it. */
export function TaskQrSection({ taskId, canUpdate }: { taskId: string; canUpdate: boolean }) {
  const t = useTranslations("modules.planning");
  const queryClient = useQueryClient();
  const queryKey = ["planning-task-editor", "qr", taskId];
  const assignment = useQuery({
    queryKey,
    queryFn: async () => {
      const result = await planningRead("taskQrAssignment", taskId);
      if ("error" in result) throw new Error(result.error);
      return result.data;
    },
    staleTime: 60 * 1000,
  });
  const [choosing, setChoosing] = useState(false);
  const [options, setOptions] = useState<QrOption[]>([]);
  const [busy, setBusy] = useState(false);

  const openChooser = async () => {
    const result = await appRead("qrCodes");
    if (result.success) {
      setOptions(
        result.data.map((code) => ({
          id: code.id,
          label: code.label ?? null,
          status: String(code.status),
          assignment: code.assignment ?? null,
        }))
      );
    }
    setChoosing(true);
  };

  const assign = async (qrCodeId: string) => {
    setBusy(true);
    const result = await assignQrToPlanningTaskAction({ qrCodeId, taskId });
    setBusy(false);
    if (!result.success) {
      toast.error(t("tasks.qrCodeAssignFailed"));
      return;
    }
    setChoosing(false);
    toast.success(t("tasks.qrCodeAssigned"));
    void queryClient.invalidateQueries({ queryKey });
  };

  const unlink = async () => {
    if (!assignment.data) return;
    setBusy(true);
    const result = await revokeQrAction({ qrCodeId: assignment.data.qrCodeId });
    setBusy(false);
    if (!result.success) {
      toast.error(t("tasks.qrCodeUnlinkFailed"));
      return;
    }
    toast.success(t("tasks.qrCodeUnlinked"));
    queryClient.setQueryData(queryKey, null);
  };

  const free = options.filter((code) => code.status === "active" && !code.assignment);

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-xs font-medium uppercase tracking-wide text-muted-foreground">
        <QrCode className="h-3.5 w-3.5" />
        {t("tasks.qrCode")}
      </h3>
      {assignment.isPending ? (
        <Loader2 className="h-4 w-4 animate-spin text-muted-foreground" />
      ) : assignment.data ? (
        <div className="space-y-2">
          <div className="rounded-md bg-muted/50 px-2.5 py-1.5 text-xs">
            <p className="truncate font-medium">{assignment.data.label ?? t("tasks.unlabelled")}</p>
            <p className="truncate font-mono text-muted-foreground">{assignment.data.token}</p>
          </div>
          {canUpdate ? (
            <Button
              variant="outline"
              size="sm"
              className="h-7 w-full text-xs text-destructive hover:text-destructive"
              onClick={() => void unlink()}
              disabled={busy}
            >
              <Link2Off className="mr-1.5 h-3 w-3" />
              {t("tasks.unlink")}
            </Button>
          ) : null}
        </div>
      ) : canUpdate ? (
        choosing ? (
          <div className="space-y-1 rounded-md border p-2">
            <div className="flex max-h-40 flex-col gap-1 overflow-y-auto">
              {free.map((code) => (
                <button
                  key={code.id}
                  type="button"
                  disabled={busy}
                  className="flex items-center gap-2 rounded px-2 py-1.5 text-left text-sm hover:bg-muted"
                  onClick={() => void assign(code.id)}
                >
                  <QrCode className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                  <span className="truncate">{code.label ?? code.id.slice(0, 8)}</span>
                </button>
              ))}
              {!free.length ? (
                <p className="px-2 py-1 text-xs text-muted-foreground">
                  {t("tasks.noAvailableQrCodes")}
                </p>
              ) : null}
            </div>
            <Button variant="ghost" size="sm" className="w-full" onClick={() => setChoosing(false)}>
              {t("tasks.cancel")}
            </Button>
          </div>
        ) : (
          <Button
            variant="outline"
            size="sm"
            className="h-7 w-full text-xs"
            onClick={() => void openChooser()}
          >
            <Plus className="mr-1.5 h-3 w-3" />
            {t("tasks.assignQrCode")}
          </Button>
        )
      ) : (
        <p className="text-xs text-muted-foreground">{t("tasks.noQrCodeAssigned")}</p>
      )}
    </section>
  );
}
