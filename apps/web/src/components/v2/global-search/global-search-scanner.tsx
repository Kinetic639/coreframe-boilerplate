"use client";

import { useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";

/**
 * Formats the palette scanner reads: Ambra QR labels, DataMatrix on parts
 * packaging, and the common 1D codes (part numbers, EAN on boxes, VIN labels).
 */
const SCAN_FORMATS = [
  "QRCode",
  "DataMatrix",
  "Code128",
  "Code39",
  "EAN-13",
  "EAN-8",
  "UPC-A",
] as const;

export type ScannedCode =
  /** An Ambra QR label (…/qr/<token>): the QR page resolves and redirects */
  | { kind: "ambraQr"; token: string }
  /** Anything else: searched as text (part number, order number, VIN, EAN) */
  | { kind: "text"; text: string };

/** Classifies a decoded code. Pure — exported for tests. */
export function classifyScannedCode(raw: string): ScannedCode | null {
  const text = raw.trim();
  if (!text) return null;
  try {
    const url = new URL(text);
    const [, token] = url.pathname.split("/qr/");
    if (token) return { kind: "ambraQr", token: decodeURIComponent(token.replace(/\/+$/, "")) };
  } catch {
    // Not a URL: a plain code
  }
  return { kind: "text", text: text.slice(0, 80) };
}

interface GlobalSearchScannerProps {
  onDetected: (code: ScannedCode) => void;
  onBack: () => void;
}

/**
 * Camera scanner inside the search palette (phones). Decodes with zxing-wasm,
 * loaded only when the scanner opens; the camera stops on the first code or
 * when the scanner closes.
 */
export function GlobalSearchScanner({ onDetected, onBack }: GlobalSearchScannerProps) {
  const t = useTranslations("globalSearch.scanner");
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [error, setError] = useState<string | null>(null);
  const onDetectedRef = useRef(onDetected);
  onDetectedRef.current = onDetected;

  useEffect(() => {
    let cancelled = false;
    let stream: MediaStream | null = null;
    let frame: number | null = null;

    const stop = () => {
      if (frame !== null) cancelAnimationFrame(frame);
      stream?.getTracks().forEach((track) => track.stop());
      stream = null;
    };

    async function start() {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError(t("unsupported"));
        return;
      }
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" },
        });
      } catch {
        if (!cancelled) setError(t("cameraError"));
        return;
      }
      if (cancelled) {
        stop();
        return;
      }
      const video = videoRef.current;
      if (!video) return;
      video.srcObject = stream;
      await video.play().catch(() => undefined);

      const { readBarcodes } = await import("zxing-wasm/reader");

      const tick = () => {
        if (cancelled) return;
        const canvas = canvasRef.current;
        if (!canvas || video.readyState < 2) {
          frame = requestAnimationFrame(tick);
          return;
        }
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext("2d", { willReadFrequently: true });
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);
        readBarcodes(ctx.getImageData(0, 0, canvas.width, canvas.height), {
          formats: [...SCAN_FORMATS],
          maxNumberOfSymbols: 1,
          tryHarder: true,
        })
          .then((results) => {
            const code = results[0]?.text ? classifyScannedCode(results[0].text) : null;
            if (code && !cancelled) {
              cancelled = true;
              stop();
              navigator.vibrate?.(60);
              onDetectedRef.current(code);
            } else {
              frame = requestAnimationFrame(tick);
            }
          })
          .catch(() => {
            frame = requestAnimationFrame(tick);
          });
      };
      frame = requestAnimationFrame(tick);
    }

    void start();
    return () => {
      cancelled = true;
      stop();
    };
  }, [t]);

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 p-4">
      <Button variant="ghost" size="sm" className="-ml-1 self-start" onClick={onBack}>
        <ArrowLeft className="mr-1.5 h-4 w-4" />
        {t("back")}
      </Button>
      {error ? (
        <div className="flex items-center gap-2 rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive">
          <AlertCircle className="h-4 w-4 shrink-0" />
          {error}
        </div>
      ) : (
        <div className="relative aspect-[3/4] overflow-hidden rounded-xl bg-black sm:aspect-[4/3]">
          <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div className="h-44 w-64 rounded-xl border-2 border-white/80 shadow-[0_0_0_9999px_rgba(0,0,0,0.45)]" />
          </div>
        </div>
      )}
      <canvas ref={canvasRef} className="hidden" />
      {!error ? <p className="text-center text-sm text-muted-foreground">{t("hint")}</p> : null}
    </div>
  );
}
