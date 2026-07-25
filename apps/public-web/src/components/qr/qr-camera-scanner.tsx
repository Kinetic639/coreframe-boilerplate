"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AlertCircle } from "lucide-react";
import { cn } from "@/lib/utils";

/**
 * Extracts a QR token from either a full scanned URL (".../qr/{token}") or
 * raw text, treating the raw text as the token itself when it isn't a URL.
 *
 * Duplicated logic previously lived independently in
 * assign-qr-location-dialog.tsx and assign-qr-dialog.tsx (help-desk
 * tickets) — this is the single source of truth going forward for any new
 * scanner consumer (e.g. the stock-audit wizard/guided-count screens).
 */
export function extractQrToken(scannedText: string): string | null {
  try {
    const url = new URL(scannedText);
    const parts = url.pathname.split("/qr/");
    const raw = parts[1];
    return raw ? decodeURIComponent(raw) : null;
  } catch {
    const t = scannedText.trim();
    return t.length > 0 ? t : null;
  }
}

export interface QrCameraScannerProps {
  /** Called once per successful decode. The scan loop keeps running
   * afterward unless `paused` is set — callers doing async work after a
   * decode (a lookup, an assignment) should set `paused` while that work is
   * in flight and clear it to resume scanning, or unmount to stop the
   * camera entirely. */
  onDecode: (text: string) => void;
  /** Pauses the decode loop while keeping the camera stream alive. */
  paused?: boolean;
  /** Called if camera access fails or is denied. */
  onError?: (message: string) => void;
  className?: string;
  viewfinderClassName?: string;
  cameraErrorMessage?: string;
}

/**
 * Real device camera QR/barcode scanner using zxing-wasm. This is the shared
 * primitive extracted per the stock-audit implementation plan §5/§16 (step
 * 6) — it owns only camera lifecycle + the decode loop + the viewfinder
 * chrome; it deliberately does NOT know what a decoded value means (token
 * lookup, assignment, SKU match, etc.) — that's entirely the caller's
 * responsibility via `onDecode`. Do not add the prototype's fake
 * setTimeout-simulated scan flow anywhere near this component.
 */
export function QrCameraScanner({
  onDecode,
  paused = false,
  onError,
  className,
  viewfinderClassName,
  cameraErrorMessage = "Camera access denied or unavailable.",
}: QrCameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const rafRef = useRef<number | null>(null);
  const pausedRef = useRef(paused);
  pausedRef.current = paused;

  const [cameraError, setCameraError] = useState<string | null>(null);

  const stopCamera = useCallback(() => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function startCamera() {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }
        streamRef.current = stream;
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          await videoRef.current.play();
        }
        startScanLoop();
      } catch {
        if (!cancelled) {
          setCameraError(cameraErrorMessage);
          onError?.(cameraErrorMessage);
        }
      }
    }

    async function startScanLoop() {
      const { readBarcodes } = await import("zxing-wasm/reader");

      function tick() {
        if (cancelled) return;
        if (pausedRef.current) {
          rafRef.current = requestAnimationFrame(tick);
          return;
        }
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
            if (results[0]?.text) {
              onDecode(results[0].text);
            }
            rafRef.current = requestAnimationFrame(tick);
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
    // eslint-disable-next-line react-hooks/exhaustive-deps -- onDecode/onError intentionally not deps: re-running this effect would restart the camera stream on every render of a caller that doesn't memoize its callbacks.
  }, [cameraErrorMessage, stopCamera]);

  if (cameraError) {
    return (
      <div
        className={cn(
          "flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive",
          className
        )}
      >
        <AlertCircle className="h-4 w-4 shrink-0" />
        {cameraError}
      </div>
    );
  }

  return (
    <div className={cn("relative overflow-hidden rounded-md bg-black aspect-[4/3]", className)}>
      <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <div
          className={cn(
            "h-40 w-40 rounded-lg border-2 border-white/70 shadow-[0_0_0_9999px_rgba(0,0,0,0.4)]",
            viewfinderClassName
          )}
        />
      </div>
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}
