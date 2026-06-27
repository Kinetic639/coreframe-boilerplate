"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { QrCode, Search, Camera, ArrowLeft, Loader2, AlertCircle } from "lucide-react";
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
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { listQrCodesAction } from "@/app/actions/qr/list";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";
import { assignQrToLocationAction } from "@/app/actions/qr/assign-location";
import type { QrCodeWithStatus } from "@/server/services/qr.service";

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
// Camera scanner component
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
        if (
          assignment.target_type === "warehouse.location" &&
          assignment.target_id === locationId
        ) {
          setScanStatus(t("alreadyAssigned"));
          processingRef.current = false;
          return;
        }
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
        {t("selectFromList")}
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
          {t("selectFromList")}
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
  const [codes, setCodes] = useState<QrCodeWithStatus[]>([]);
  const [loading, setLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null);
  const [scanning, setScanning] = useState(false);
  const [scannerKey, setScannerKey] = useState(0);

  useEffect(() => {
    if (!open) {
      setSearch("");
      setSelected(null);
      setScanning(false);
      return;
    }
    setLoading(true);
    listQrCodesAction().then((result) => {
      if (result.success) {
        setCodes(
          (result as { success: true; data: QrCodeWithStatus[] }).data.filter((c) => {
            if (c.status !== "active") return false;
            return !c.assignment;
          })
        );
      }
      setLoading(false);
    });
  }, [open, locationId]);

  const filtered = codes.filter((c) => {
    if (!search.trim()) return true;
    const q = search.toLowerCase();
    return c.token.toLowerCase().includes(q) || (c.label ?? "").toLowerCase().includes(q);
  });

  const handleAssign = async () => {
    if (!selected) return;
    setAssigning(true);
    try {
      const result = await assignQrToLocationAction({ qrCodeId: selected, locationId });
      if (!result.success) {
        toast.error((result as { success: false; error: string }).error);
        return;
      }
      const code = codes.find((c) => c.id === selected);
      toast.success(t("assignSuccess"));
      onAssigned({
        assignmentId: (result as { success: true; data: { id: string } }).data.id,
        qrCodeId: selected,
        token: code?.token ?? "",
        label: code?.label ?? null,
        status: "active",
      });
      onOpenChange(false);
    } finally {
      setAssigning(false);
    }
  };

  const handleScannerBack = () => {
    setScannerKey((k) => k + 1);
    setScanning(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="w-[min(480px,calc(100vw-2rem))]" style={{ maxWidth: "none" }}>
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
            <div className="space-y-3">
              {/* Scan button */}
              <Button variant="outline" className="w-full gap-2" onClick={() => setScanning(true)}>
                <Camera className="h-4 w-4" />
                {t("scanWithCamera")}
              </Button>

              <div className="relative flex items-center gap-2 text-xs text-muted-foreground">
                <div className="flex-1 border-t" />
                <span>{t("selectFromList")}</span>
                <div className="flex-1 border-t" />
              </div>

              {/* Search */}
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder={t("searchQr")}
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  className="pl-8"
                />
              </div>

              {/* List */}
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border p-1">
                {loading ? (
                  Array.from({ length: 4 }).map((_, i) => (
                    <Skeleton key={i} className="h-10 w-full rounded-md" />
                  ))
                ) : filtered.length === 0 ? (
                  <p className="py-6 text-center text-sm text-muted-foreground">
                    {search ? t("noUnassignedCodes") : t("noUnassignedCodes")}
                  </p>
                ) : (
                  filtered.map((code) => (
                    <button
                      key={code.id}
                      onClick={() => setSelected(code.id === selected ? null : code.id)}
                      className={`flex w-full items-center gap-2.5 rounded-md px-3 py-2 text-left text-sm transition-colors ${
                        selected === code.id
                          ? "bg-primary text-primary-foreground"
                          : "hover:bg-muted"
                      }`}
                    >
                      <QrCode className="h-4 w-4 shrink-0" />
                      <div className="min-w-0 flex-1">
                        <p className="truncate font-medium">
                          {code.label ?? (
                            <span className="italic text-muted-foreground">Unlabelled</span>
                          )}
                        </p>
                        <p
                          className={`truncate text-xs ${selected === code.id ? "text-primary-foreground/70" : "text-muted-foreground"}`}
                        >
                          {code.token}
                        </p>
                      </div>
                      <Badge
                        variant="secondary"
                        className={`shrink-0 text-xs ${selected === code.id ? "bg-primary-foreground/20 text-primary-foreground" : ""}`}
                      >
                        unassigned
                      </Badge>
                    </button>
                  ))
                )}
              </div>
            </div>

            <DialogFooter>
              <Button variant="outline" onClick={() => onOpenChange(false)} disabled={assigning}>
                Cancel
              </Button>
              <Button onClick={handleAssign} disabled={!selected || assigning}>
                {assigning ? t("scanning") : t("assignQr")}
              </Button>
            </DialogFooter>
          </>
        )}
      </DialogContent>
    </Dialog>
  );
}
