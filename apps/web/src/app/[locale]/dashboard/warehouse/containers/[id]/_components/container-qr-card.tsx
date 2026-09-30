"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { Printer, QrCode } from "lucide-react";
import { useRouter } from "@/i18n/navigation";
import { Button } from "@/components/ui/button";
import { createAndAssignQrToContainerAction } from "@/app/actions/qr/assign-container";

type Props = {
  containerId: string;
  containerCode: string;
  /** The container's active QR assignment, server-loaded; null when none. */
  qrCodeId: string | null;
  canAssign: boolean;
  canPrint: boolean;
};

/**
 * Phase 10D: the container's QR identity. "Wygeneruj kod QR" creates a new
 * code and assigns it to this container in one step (server action gated on
 * qr.assign + warehouse.inventory.operate); "Drukuj etykietę" reuses the
 * generic QR label PDF route (gated on qr.export + the registry's read
 * permission), whose label text comes from the `inventory.container`
 * registry entry.
 */
export function ContainerQrCard({
  containerId,
  containerCode,
  qrCodeId,
  canAssign,
  canPrint,
}: Props) {
  const t = useTranslations("modules.warehouse.containers.qr");
  const router = useRouter();
  const [generating, setGenerating] = useState(false);
  const [printing, setPrinting] = useState(false);

  async function handleGenerate() {
    setGenerating(true);
    try {
      const result = await createAndAssignQrToContainerAction({
        containerId,
        label: containerCode,
      });
      if (!result.success) {
        toast.error(t("error"));
        return;
      }
      toast.success(t("generated"));
      router.refresh();
    } catch {
      toast.error(t("error"));
    } finally {
      setGenerating(false);
    }
  }

  async function handlePrint() {
    if (!qrCodeId) return;
    setPrinting(true);
    try {
      const response = await fetch("/api/qr/labels", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ qrCodeIds: [qrCodeId], labelSize: "70x40" }),
      });
      if (!response.ok) {
        toast.error(t("printError"));
        return;
      }
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
      setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch {
      toast.error(t("printError"));
    } finally {
      setPrinting(false);
    }
  }

  return (
    <div
      className="bg-card border-border flex flex-col gap-3 rounded-lg border p-4"
      data-testid="container-qr-card"
    >
      <div className="flex items-center gap-2">
        <QrCode className="text-muted-foreground h-4 w-4" />
        <h2 className="text-sm font-semibold">{t("title")}</h2>
      </div>

      {qrCodeId ? (
        <>
          <p className="text-sm" data-testid="container-qr-assigned">
            {t("assigned")}
          </p>
          {canPrint && (
            <Button
              type="button"
              variant="outline"
              onClick={handlePrint}
              disabled={printing}
              className="w-full sm:w-fit"
              data-testid="container-qr-print"
            >
              <Printer className="mr-2 h-4 w-4" />
              {printing ? t("printing") : t("print")}
            </Button>
          )}
        </>
      ) : (
        <>
          <p className="text-muted-foreground text-sm" data-testid="container-qr-none">
            {t("none")}
          </p>
          {canAssign ? (
            <Button
              type="button"
              onClick={handleGenerate}
              disabled={generating}
              className="w-full sm:w-fit"
              data-testid="container-qr-generate"
            >
              <QrCode className="mr-2 h-4 w-4" />
              {generating ? t("generating") : t("generate")}
            </Button>
          ) : (
            <p className="text-muted-foreground text-xs">{t("noPermission")}</p>
          )}
        </>
      )}
    </div>
  );
}
