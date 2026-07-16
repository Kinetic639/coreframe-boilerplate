"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ArrowLeft, Loader2, AlertCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { getQrCodeByTokenAction } from "@/app/actions/qr/assign";

export interface QrScanLookup {
  id: string;
  token: string;
  label: string | null;
  status: string;
  assignment: { target_type: string; target_id: string } | null;
}

interface QrCameraScannerProps {
  /**
   * Called once a code is scanned, found, and active. Return `null` on
   * success (the caller has already handled the transition — e.g. closing
   * the dialog or storing the staged code). Return a message string to stay
   * in scanning mode and show it, letting the user try again.
   */
  onScanned: (lookup: QrScanLookup) => Promise<string | null>;
  onBack: () => void;
  backLabel?: string;
  hintLabel?: string;
}

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

export function QrCameraScanner({ onScanned, onBack, backLabel, hintLabel }: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const processingRef = useRef(false);

  const [cameraError, setCameraError] = useState<string | null>(null);
  const [scanStatus, setScanStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
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
        setScanStatus("Could not read a valid QR token. Try again.");
        processingRef.current = false;
        return;
      }

      setScanStatus("Looking up QR code…");
      const lookup = await getQrCodeByTokenAction(token);

      if (!lookup.success || !lookup.data) {
        setScanStatus("QR code not found in this organisation.");
        processingRef.current = false;
        return;
      }

      const { id, label, status, assignment } = lookup.data;

      if (status !== "active") {
        setScanStatus("This QR code has been revoked.");
        processingRef.current = false;
        return;
      }

      setBusy(true);
      const errorMessage = await onScanned({ id, token, label, status, assignment });
      setBusy(false);

      if (errorMessage) {
        setScanStatus(errorMessage);
        processingRef.current = false;
      }
    },
    [onScanned, stopCamera]
  );

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop());
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
        {backLabel ?? "Back"}
      </Button>

      {cameraError ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {cameraError}
        </div>
      ) : (
        <div className="relative overflow-hidden rounded-md bg-black aspect-[4/3]">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-40 w-40 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]" />
          </div>
        </div>
      )}

      <canvas ref={canvasRef} className="hidden" />

      {scanStatus && (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          {busy && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
          {scanStatus}
        </div>
      )}

      {scanStatus && !busy && (
        <Button variant="outline" size="sm" onClick={onBack}>
          Try again
        </Button>
      )}

      {!scanStatus && !cameraError && (
        <p className="text-center text-xs text-muted-foreground">
          {hintLabel ?? "Point the camera at a QR label to scan it automatically."}
        </p>
      )}
    </div>
  );
}
