"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useTranslations } from "next-intl";
import { AlertCircle, Loader2, Moon, ScanLine } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSharedCamera } from "@/components/features/qr/qr-camera-scanner";
import { scanErrorFeedback, scanSuccessFeedback, unlockScanSound } from "./scan-feedback";

/** No scan for this long puts the camera to sleep (battery, heat). */
export const SCAN_IDLE_SLEEP_MS = 2 * 60 * 1000;
/** A code must be read in this many consecutive frames to count. */
const CONFIRM_FRAMES = 2;
/** The same code is ignored for this long after it was handled. */
const REPEAT_GUARD_MS = 2500;
/** Decode at most this often (battery). */
const FRAME_INTERVAL_MS = 120;

type Props = {
  /** Armed: the next code read is taken. Paused: the strip collapses. */
  armed: boolean;
  onArm: () => void;
  /** Handle a code; return an error message to show, or null when taken. */
  onCode: (text: string) => Promise<string | null>;
  /** What the next scan is for ("Kontener, naklejka albo lokalizacja"). */
  hint: string;
};

/**
 * Always-there camera strip of the putaway sheet. Armed: a live preview
 * with a green frame; the first code that holds for two frames is taken
 * and the strip pauses -- one scan, one action, so a neighbouring sticker
 * is never picked up by accident. Paused: a slim bar ("tap to scan") that
 * gives the screen back to the list; the camera stays on in the background
 * so re-arming is instant. Sleeps after two idle minutes. A Bluetooth
 * (keyboard-wedge) scanner works too while armed.
 */
export function ScanStrip({ armed, onArm, onCode, hint }: Props) {
  const t = useTranslations("modules.warehouse.putaway.scan.strip");
  const camera = useSharedCamera();
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [sleeping, setSleeping] = useState(false);
  const [cameraError, setCameraError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const candidateRef = useRef<{ text: string; count: number } | null>(null);
  const lastHandledRef = useRef<{ text: string; at: number } | null>(null);
  const busyRef = useRef(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const touch = useCallback(() => {
    if (idleTimer.current) clearTimeout(idleTimer.current);
    idleTimer.current = setTimeout(() => {
      camera?.release();
      setSleeping(true);
    }, SCAN_IDLE_SLEEP_MS);
  }, [camera]);

  useEffect(() => {
    touch();
    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
    };
  }, [touch, armed]);

  // Attach the shared stream (opened once per sheet) to the preview.
  useEffect(() => {
    if (sleeping || !camera) return;
    let cancelled = false;
    camera
      .acquire()
      .then(async (stream) => {
        if (cancelled || !videoRef.current) return;
        if (videoRef.current.srcObject !== stream) videoRef.current.srcObject = stream;
        await videoRef.current.play().catch(() => {});
        setCameraError(false);
      })
      .catch(() => !cancelled && setCameraError(true));
    return () => {
      cancelled = true;
    };
  }, [camera, sleeping]);

  // Resume playback when re-armed (iOS pauses a hidden video).
  useEffect(() => {
    if (armed && !sleeping) void videoRef.current?.play().catch(() => {});
    if (armed) setMessage(null);
  }, [armed, sleeping]);

  const handle = useCallback(
    async (text: string) => {
      const last = lastHandledRef.current;
      if (last && last.text === text && Date.now() - last.at < REPEAT_GUARD_MS) return;
      lastHandledRef.current = { text, at: Date.now() };
      busyRef.current = true;
      setBusy(true);
      touch();
      try {
        const error = await onCode(text);
        if (error) {
          scanErrorFeedback();
          setMessage(error);
        } else {
          scanSuccessFeedback();
          setMessage(null);
        }
      } finally {
        busyRef.current = false;
        setBusy(false);
      }
    },
    [onCode, touch]
  );

  // Camera decode loop -- only while armed and awake.
  useEffect(() => {
    if (!armed || sleeping || cameraError) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | null = null;
    candidateRef.current = null;

    (async () => {
      const { readBarcodes } = await import("zxing-wasm/reader");
      const tick = async () => {
        if (stopped) return;
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!busyRef.current && video && canvas && video.readyState >= 2 && video.videoWidth) {
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext("2d", { willReadFrequently: true });
          if (ctx) {
            ctx.drawImage(video, 0, 0);
            try {
              const results = await readBarcodes(
                ctx.getImageData(0, 0, canvas.width, canvas.height),
                { formats: ["QRCode"], maxNumberOfSymbols: 1 }
              );
              const text = results[0]?.text;
              if (text) {
                const c = candidateRef.current;
                candidateRef.current =
                  c && c.text === text ? { text, count: c.count + 1 } : { text, count: 1 };
                if (candidateRef.current.count >= CONFIRM_FRAMES) {
                  candidateRef.current = null;
                  void handle(text);
                }
              } else {
                candidateRef.current = null;
              }
            } catch {
              /* unreadable frame */
            }
          }
        }
        if (!stopped) timer = setTimeout(tick, FRAME_INTERVAL_MS);
      };
      void tick();
    })();

    return () => {
      stopped = true;
      if (timer) clearTimeout(timer);
    };
  }, [armed, sleeping, cameraError, handle]);

  // Bluetooth / keyboard-wedge scanners: fast keystrokes ending in Enter,
  // taken only while armed and no field is being typed in.
  useEffect(() => {
    if (!armed) return;
    let buffer = "";
    let lastAt = 0;
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (target && /^(INPUT|TEXTAREA|SELECT)$/.test(target.tagName)) return;
      const now = Date.now();
      if (now - lastAt > 60) buffer = "";
      lastAt = now;
      if (e.key === "Enter") {
        if (buffer.length >= 6) void handle(buffer);
        buffer = "";
      } else if (e.key.length === 1) {
        buffer += e.key;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [armed, handle]);

  const wake = () => {
    unlockScanSound();
    if (sleeping) setSleeping(false);
    onArm();
  };

  const live = armed && !sleeping && !cameraError;

  return (
    <div className="border-b" data-testid="scan-strip" data-armed={live ? "true" : "false"}>
      <div
        className={cn(
          "relative overflow-hidden bg-black transition-[height] duration-200",
          live ? "h-[28dvh] max-h-60" : "h-0"
        )}
      >
        <video ref={videoRef} className="h-full w-full object-cover" playsInline muted autoPlay />
        <canvas ref={canvasRef} className="hidden" />
        {live && (
          <>
            <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
              <div className="h-[70%] aspect-square rounded-xl border-4 border-emerald-400 shadow-[0_0_0_9999px_rgba(0,0,0,0.35)]" />
            </div>
            <div className="absolute inset-x-0 top-0 flex items-center justify-center gap-2 bg-emerald-600/90 px-3 py-1.5 text-sm font-medium text-white">
              {busy ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <ScanLine className="h-4 w-4" />
              )}
              {busy ? t("checking") : hint}
            </div>
            {message && (
              <div className="bg-destructive/90 absolute inset-x-0 bottom-0 flex items-center gap-2 px-3 py-2 text-sm text-white">
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span className="line-clamp-2">{message}</span>
              </div>
            )}
          </>
        )}
      </div>

      {!live && (
        <button
          type="button"
          onClick={wake}
          className="bg-muted/60 hover:bg-muted flex h-12 w-full items-center gap-2 px-4 text-left text-sm"
          data-testid="scan-strip-arm"
        >
          {sleeping ? (
            <Moon className="text-muted-foreground h-4 w-4 shrink-0" />
          ) : cameraError ? (
            <AlertCircle className="text-destructive h-4 w-4 shrink-0" />
          ) : (
            <ScanLine className="text-primary h-4 w-4 shrink-0" />
          )}
          <span className="min-w-0 flex-1 truncate">
            {sleeping ? t("sleeping") : cameraError ? t("cameraError") : t("paused")}
          </span>
          {message && !sleeping && (
            <span className="text-destructive max-w-[45%] truncate text-xs">{message}</span>
          )}
        </button>
      )}
    </div>
  );
}
