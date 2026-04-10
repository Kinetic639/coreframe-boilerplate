"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Camera, X, Flashlight, FlashlightOff } from "lucide-react";

interface QRScannerProps {
  onScan: (result: string) => void;
  onError?: (error: string) => void;
  onClose?: () => void;
  className?: string;
}

export function QRScanner({ onScan, onError, onClose, className = "" }: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const readerRef = useRef<
    | ((
        imageData: ImageData,
        options?: { tryHarder?: boolean; formats?: string[]; maxNumberOfSymbols?: number }
      ) => Promise<{ text: string }[]>)
    | null
  >(null);

  const [isScanning, setIsScanning] = useState(false);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [flashlightOn, setFlashlightOn] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let mounted = true;

    const initializeScanner = async () => {
      try {
        // Dynamic import of zxing-wasm
        const { readBarcodes } = await import("zxing-wasm/reader");

        if (!mounted) return;

        readerRef.current = readBarcodes;
        await startCamera();
      } catch (err) {
        console.error("Failed to initialize QR scanner:", err);
        if (mounted && onError) {
          setError("Nie udało się zainicjalizować skanera QR");
          onError("Nie udało się zainicjalizować skanera QR");
        }
      }
    };

    initializeScanner();

    return () => {
      mounted = false;
      cleanup();
    };
  }, [onError]);

  const startCamera = async () => {
    try {
      const constraints = {
        video: {
          facingMode: "environment", // Use back camera if available
          width: { ideal: 1280 },
          height: { ideal: 720 },
        },
      };

      const stream = await navigator.mediaDevices.getUserMedia(constraints);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();
        setHasPermission(true);
        setIsScanning(true);
        startScanning();
      }
    } catch (err) {
      console.error("Camera access denied:", err);
      setHasPermission(false);
      setError("Brak dostępu do kamery. Upewnij się, że przeglądarka ma odpowiednie uprawnienia.");
      onError?.("Brak dostępu do kamery");
    }
  };

  const startScanning = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
    }

    scanIntervalRef.current = setInterval(async () => {
      await scanFrame();
    }, 250); // Scan every 250ms
  };

  const scanFrame = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;

    if (!video || !canvas || !readerRef.current || video.readyState !== video.HAVE_ENOUGH_DATA) {
      return;
    }

    try {
      const ctx = canvas.getContext("2d");
      if (!ctx) return;

      // Set canvas dimensions to match video
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;

      // Draw current video frame to canvas
      ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Get image data
      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

      // Scan for QR codes
      const results = await readerRef.current(imageData, {
        tryHarder: true,
        formats: ["QRCode"],
        maxNumberOfSymbols: 1,
      });

      if (results && results.length > 0) {
        const qrCode = results[0].text;
        if (qrCode) {
          setIsScanning(false);
          onScan(qrCode);
          cleanup();
        }
      }
    } catch {
      // Silently ignore scanning errors - they're common and expected
    }
  };

  const toggleFlashlight = async () => {
    const stream = streamRef.current;
    if (!stream) return;

    const track = stream.getVideoTracks()[0];
    if (!track || !("applyConstraints" in track)) return;

    try {
      await track.applyConstraints({
        advanced: [
          {
            torch: !flashlightOn,
          } as MediaTrackConstraints,
        ],
      });
      setFlashlightOn(!flashlightOn);
    } catch {
      // Flashlight not supported - silently ignore
    }
  };

  const cleanup = () => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => {
        track.stop();
      });
      streamRef.current = null;
    }

    setIsScanning(false);
  };

  const handleRetry = () => {
    setError(null);
    setHasPermission(null);
    startCamera();
  };

  if (hasPermission === false || error) {
    return (
      <Card className={className}>
        <CardContent className="flex flex-col items-center justify-center p-8 text-center">
          <Camera className="mb-4 h-16 w-16 text-muted-foreground" />
          <h3 className="mb-2 text-lg font-semibold">Brak dostępu do kamery</h3>
          <p className="mb-4 max-w-md text-muted-foreground">
            {error ||
              "Aby skanować kody QR, musisz zezwolić na dostęp do kamery w ustawieniach przeglądarki."}
          </p>
          <div className="flex gap-2">
            <Button onClick={handleRetry}>Spróbuj ponownie</Button>
            {onClose && (
              <Button variant="outline" onClick={onClose}>
                Anuluj
              </Button>
            )}
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardContent className="relative p-0">
        {/* Video Stream */}
        <div className="relative">
          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="h-64 w-full rounded-t-lg bg-black object-cover"
          />
          <canvas ref={canvasRef} className="hidden" />

          {/* Scanning Overlay */}
          {isScanning && (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="relative h-48 w-48 rounded-lg border-2 border-primary">
                {/* Corner indicators */}
                <div className="absolute left-0 top-0 h-6 w-6 border-l-4 border-t-4 border-primary"></div>
                <div className="absolute right-0 top-0 h-6 w-6 border-r-4 border-t-4 border-primary"></div>
                <div className="absolute bottom-0 left-0 h-6 w-6 border-b-4 border-l-4 border-primary"></div>
                <div className="absolute bottom-0 right-0 h-6 w-6 border-b-4 border-r-4 border-primary"></div>

                {/* Scanning line animation */}
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-0.5 w-full animate-pulse bg-primary"></div>
                </div>
              </div>
            </div>
          )}

          {/* Controls */}
          <div className="absolute right-4 top-4 flex gap-2">
            <Button
              size="sm"
              variant="secondary"
              onClick={toggleFlashlight}
              className="border-0 bg-black/50 text-white hover:bg-black/70"
            >
              {flashlightOn ? (
                <FlashlightOff className="h-4 w-4" />
              ) : (
                <Flashlight className="h-4 w-4" />
              )}
            </Button>
            {onClose && (
              <Button
                size="sm"
                variant="secondary"
                onClick={onClose}
                className="border-0 bg-black/50 text-white hover:bg-black/70"
              >
                <X className="h-4 w-4" />
              </Button>
            )}
          </div>
        </div>

        {/* Status */}
        <div className="p-4 text-center">
          <p className="text-sm text-muted-foreground">
            {isScanning
              ? "Skieruj kamerę na kod QR, aby go zeskanować"
              : "Inicjalizowanie kamery..."}
          </p>
        </div>
      </CardContent>
    </Card>
  );
}
