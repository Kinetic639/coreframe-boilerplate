"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Camera, ArrowLeft, Loader2, AlertCircle, Sparkles } from "lucide-react";
import { toast } from "react-toastify";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";
import {
  assignQrToLocationAction,
  createAndAssignQrToLocationAction,
} from "@/app/actions/qr/assign-location";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type AssignQrLocationDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  locationId: string;
  locationName: string;
  onAssigned: (assignment: {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  }) => void;
};

// ---------------------------------------------------------------------------
// Token extraction helper
// ---------------------------------------------------------------------------

function extractToken(scannedText: string): string | null {
  try {
    const url = new URL(scannedText);
    const parts = url.pathname.split("/qr/");
    const raw = parts[1];
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    // Not a URL — treat raw text as the token itself
    const t = scannedText.trim();
    return t.length > 0 ? t : null;
  }
}

// ---------------------------------------------------------------------------
// Camera scanner component (for re-using an existing printed label)
// ---------------------------------------------------------------------------

interface QrCameraScannerProps {
  locationId: string;
  onSuccess: (assignment: {
    assignmentId: string;
    qrCodeId: string;
    token: string;
    label: string | null;
    status: string;
  }) => void;
  onBack: () => void;
  t: ReturnType<typeof useTranslations<"ambraLocations.qr">>;
}

function QrCameraScanner({ locationId, onSuccess, onBack, t }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [assigning, setAssigning] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((tr) => tr.stop());
      streamRef.current = null;
    }
  }, []);

  const handleScanned = useCallback(
    async (scannedText: string) => {
      if (processingRef.current) return;
      processingRef.current = true;
      stopCamera();

      const token = extractToken(scannedText);
      if (!token) {
        setScanStatus(t("scanHint"));
        processingRef.current = false;
        return;
      }

      setScanStatus(t("scanning"));
      const lookup = await getQrCodeByTokenAction(token);

      if (!lookup.success || !lookup.data) {
        setScanStatus(t("noUnassignedCodes"));
        processingRef.current = false;
        return;
      }

      const { id, label, status, assignment } = lookup.data;

      if (status !== "active") {
        setScanStatus(t("codeRevoked"));
        processingRef.current = false;
        return;
      }

      if (assignment) {
        setScanStatus(t("alreadyAssigned"));
        processingRef.current = false;
        return;
      }

      // Unassigned and active — assign it
      setScanStatus(t("scanning"));
      setAssigning(true);
      const result = await assignQrToLocationAction({ qrCodeId: id, locationId });
      setAssigning(false);

      if (!result.success) {
        setScanStatus((result as { success: false; error: string }).error);
        processingRef.current = false;
        return;
      }

      toast.success(t("assignSuccess"));
      onSuccess({
        assignmentId: (result as { success: true; data: { id: string } }).data.id,
        qrCodeId: id,
        token,
        label,
        status: "active",
      });
    },
    [locationId, onSuccess, stopCamera, t]
  );

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((tr) => tr.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        startScanLoop();
      } catch {
        if (!cancelled) setCameraError("Camera access denied or unavailable.");
      }
    }

    async function startScanLoop() {
      const { readBarcodes } = await import("zxing-wasm/reader");

      function tick() {
        if (cancelled || processingRef.current) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas || video.readyState < 2) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d");
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

        readBarcodes(imageData, { formats: ["QRCode"], maxNumberOfSymbols: 1 })
          .then((results) => {
            if (results[0]?.text) handleScanned(results[0].text);
            else rafRef.current = requestAnimationFrame(tick);
          })
          .catch(() => {
            rafRef.current = requestAnimationFrame(tick);
          });
      }

      rafRef.current = requestAnimationFrame(tick);
    }

    startCamera();

    return () => {
      cancelled = true;
      stopCamera();
    };
  }, [handleScanned, stopCamera]);

  return (
    <div className="flex flex-col gap-3">
      <Button variant="ghost" size="sm" className="self-start -ml-1" onClick={onBack}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t("generateNew")}
      </Button>

      {cameraError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {cameraError}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md bg-black aspect-[4/3]">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          {/* viewfinder */}
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {scanStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {assigning && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {scanStatus}
        </div>
      )}

      {scanStatus && !assigning && (
        <Button variant="outline" size="sm" onClick={onBack}>
          {t("generateNew")}
        </Button>
      )}

      {!scanStatus && !cameraError && (
        <p className="text-center text-xs text-muted-foreground">{t("scanHint")}</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main dialog
// ---------------------------------------------------------------------------

export function AssignQrLocationDialog({
  open,
  onOpenChange,
  locationId,
  locationName,
  onAssigned,
}: AssignQrLocationDialogProps) {
  const t = useTranslations("ambraLocations.qr");
  const [label, setLabel] = useState("");
  const [generating, setGenerating] = useState(false);
  const [scanning, setScanning] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setLabel("");
      setScanning(false);
    }
  }, [open]);

  const handleGenerate = async () => {
    setGenerating(true);
    try {
      const result = await createAndAssignQrToLocationAction({
        locationId,
        label: label.trim() || null,
      });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      toast.success(t("assignSuccess"));
      onAssigned(
        (
          result as {
            success: true;
            data: {
              assignmentId: string;
              qrCodeId: string;
              token: string;
              label: string | null;
              status: string;
            };
          }
        ).data
      );
      onOpenChange(false);
    } finally {
      setGenerating(false);
    }
  };

  const handleScannerBack = () => {
    setScannerKey((k) => k + 1);
    setScanning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(420px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
        <DialogHeader>
          <DialogTitle>
            {t("assignQr")} — {locationName}
          </DialogTitle>
        </DialogHeader>

        {scanning ? (
          <QrCameraScanner
            key={scannerKey}
            locationId={locationId}
            onSuccess={(a) => {
              onAssigned(a);
              onOpenChange(false);
            }}
            onBack={handleScannerBack}
            t={t}
          />
        ) : (
          <>
            <div className="space-y-4">
              <div className="rounded-md border bg-muted/30 p-4 text-center">
                <QrCode className="mx-auto mb-2 h-8 w-8 text-muted-foreground" />
                <p className="text-sm text-muted-foreground">{t("generateHint")}</p>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {t("labelOptional")}
                </label>
                <Input
                  placeholder={t("labelPlaceholder")}
                  value={label}
                  onChange={(e) => setLabel(e.target.value)}
                  maxLength={200}
                />
              </div>

              <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>{t("orScanExisting")}</span>
                <div className="flex-1 border-t" />
              </div>

              <Button
                variant="outline"
                className="w-full gap-2"
                onClick={() => setScanning(true)}
                disabled={generating}
              >
                <Camera className="h-4 w-4" />
                {t("scanWithCamera")}
              </Button>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={generating}>
                {t("cancel")}
              </Button>
              <Button onClick={handleGenerate} disabled={generating} className="gap-1.5">
                {generating ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : (
                  <Sparkles className="h-3.5 w-3.5" />
                )}
                {generating ? t("generating") : t("generateAndAssign")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
