"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Camera,
  CameraOff,
  ScanLine,
  Type,
  Upload,
  Settings,
  Zap,
  ZapOff,
  RotateCcw,
  CheckCircle,
  AlertTriangle,
  Loader2,
} from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { ScannerResult, ScannerConfig } from "@/lib/types/qr-system";
import {
  checkCameraAvailability,
  getCameraDevices,
  createCameraStream,
  scanFromVideo,
  scanFromFile,
  handleScanSuccess,
  extractQRTokenFromURL,
  isValidQRToken,
  isValidBarcode,
  DEFAULT_SCANNER_CONFIG,
} from "@/lib/utils/qr-scanner";

interface QRScannerProps {
  onScanResult: (result: ScannerResult) => void;
  onError?: (error: string) => void;
  config?: Partial<ScannerConfig>;
  className?: string;
  autoStart?: boolean;
  showManualEntry?: boolean;
  showFileUpload?: boolean;
}

export function QRScanner({
  onScanResult,
  onError,
  config = {},
  className = "",
  autoStart = false,
  showManualEntry = true,
  showFileUpload = true,
}: QRScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const scanIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [isScanning, setIsScanning] = useState(false);
  const [cameraAvailable, setCameraAvailable] = useState(false);
  const [cameras, setCameras] = useState<MediaDeviceInfo[]>([]);
  const [selectedCamera, setSelectedCamera] = useState<string>("");
  const [flashEnabled, setFlashEnabled] = useState(false);
  const [manualCode, setManualCode] = useState("");
  const [showSettings, setShowSettings] = useState(false);
  const [scannerConfig, setScannerConfig] = useState<ScannerConfig>({
    ...DEFAULT_SCANNER_CONFIG,
    ...config,
  });
  const [lastScanResult, setLastScanResult] = useState<ScannerResult | null>(null);
  const [scanStatus, setScanStatus] = useState<"idle" | "scanning" | "success" | "error">("idle");
  const [isInitializing, setIsInitializing] = useState(false);

  // Initialize camera on component mount
  useEffect(() => {
    initializeCamera();
    return () => {
      stopScanning();
    };
  }, [initializeCamera, stopScanning]);

  // Auto-start scanning if enabled
  useEffect(() => {
    if (autoStart && cameraAvailable && !isScanning) {
      startScanning();
    }
  }, [autoStart, cameraAvailable, isScanning, startScanning]);

  const initializeCamera = useCallback(async () => {
    setIsInitializing(true);

    try {
      const available = await checkCameraAvailability();
      setCameraAvailable(available);

      if (available) {
        const devices = await getCameraDevices();
        setCameras(devices);

        // Select the back camera if available
        const backCamera = devices.find(
          (device) =>
            device.label.toLowerCase().includes("back") ||
            device.label.toLowerCase().includes("rear")
        );
        setSelectedCamera(backCamera?.deviceId || devices[0]?.deviceId || "");
      }
    } catch (error) {
      console.error("Error initializing camera:", error);
      onError?.("Błąd podczas inicjalizacji kamery");
    } finally {
      setIsInitializing(false);
    }
  }, [onError]);

  const validateScanResult = useCallback((result: ScannerResult): boolean => {
    if (result.type === "qr_code") {
      // Check if it's a valid QR token or URL
      const token = extractQRTokenFromURL(result.code);
      return token !== null || isValidQRToken(result.code);
    } else {
      // Validate barcode
      return isValidBarcode(result.code, result.format);
    }
  }, []);

  const handleValidScan = useCallback(
    (result: ScannerResult) => {
      setLastScanResult(result);
      setScanStatus("success");

      // Provide feedback
      handleScanSuccess(scannerConfig);

      // Call the callback
      onScanResult(result);

      // Stop continuous scanning if not enabled
      if (!scannerConfig.continuousScanning) {
        stopScanning();
      }

      // Reset status after 2 seconds
      setTimeout(() => {
        if (!scannerConfig.continuousScanning) {
          setScanStatus("idle");
        }
      }, 2000);
    },
    [scannerConfig, onScanResult, stopScanning]
  );

  const startScanLoop = useCallback(() => {
    if (!videoRef.current) return;

    scanIntervalRef.current = setInterval(async () => {
      if (!videoRef.current || !isScanning) return;

      try {
        const results = await scanFromVideo(videoRef.current, scannerConfig);

        if (results.length > 0) {
          const result = results[0]; // Take the first result

          // Validate the result
          if (validateScanResult(result)) {
            handleValidScan(result);
          }
        }
      } catch (error) {
        console.error("Scan error:", error);
      }
    }, 500); // Scan every 500ms
  }, [isScanning, scannerConfig, validateScanResult, handleValidScan]);

  const startScanning = useCallback(async () => {
    if (!cameraAvailable || isScanning) return;

    try {
      setIsInitializing(true);
      setScanStatus("scanning");

      const stream = await createCameraStream(selectedCamera);
      streamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        videoRef.current.play();

        // Enable flashlight if supported and requested
        if (flashEnabled) {
          try {
            const track = stream.getVideoTracks()[0];
            await track.applyConstraints({
              // @ts-ignore - torch is not in standard types yet
              advanced: [{ torch: true }],
            });
          } catch (error) {
            console.warn("Flashlight not supported:", error);
          }
        }

        setIsScanning(true);
        startScanLoop();
      }
    } catch (error) {
      console.error("Error starting camera:", error);
      setScanStatus("error");
      onError?.("Błäd podczas uruchamiania kamery");
    } finally {
      setIsInitializing(false);
    }
  }, [cameraAvailable, isScanning, selectedCamera, flashEnabled, onError, startScanLoop]);

  const stopScanning = useCallback(() => {
    if (scanIntervalRef.current) {
      clearInterval(scanIntervalRef.current);
      scanIntervalRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((track) => track.stop());
      streamRef.current = null;
    }

    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }

    setIsScanning(false);
    setScanStatus("idle");
  }, []);

  const validateScanResult = (result: ScannerResult): boolean => {
    if (result.type === "qr_code") {
      // Check if it's a valid QR token or URL
      const token = extractQRTokenFromURL(result.code);
      return token !== null || isValidQRToken(result.code);
    } else {
      // Validate barcode
      return isValidBarcode(result.code, result.format);
    }
  };

  const handleValidScan = (result: ScannerResult) => {
    setLastScanResult(result);
    setScanStatus("success");

    // Provide feedback
    handleScanSuccess(scannerConfig);

    // Call the callback
    onScanResult(result);

    // Stop continuous scanning if not enabled
    if (!scannerConfig.continuousScanning) {
      stopScanning();
    }

    // Reset status after 2 seconds
    setTimeout(() => {
      if (!scannerConfig.continuousScanning) {
        setScanStatus("idle");
      }
    }, 2000);
  };

  const handleManualEntry = () => {
    if (!manualCode.trim()) return;

    // Determine if it's QR or barcode
    const token = extractQRTokenFromURL(manualCode);
    const isQR = token !== null || isValidQRToken(manualCode);

    const result: ScannerResult = {
      code: token || manualCode,
      type: isQR ? "qr_code" : "barcode",
      format: isQR ? "QR-Code" : "Manual",
    };

    handleValidScan(result);
    setManualCode("");
  };

  const handleFileUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      setScanStatus("scanning");
      const results = await scanFromFile(file, scannerConfig);

      if (results.length > 0) {
        const result = results[0];
        if (validateScanResult(result)) {
          handleValidScan(result);
        } else {
          setScanStatus("error");
          onError?.("Nie rozpoznano prawidłowego kodu na obrazie");
        }
      } else {
        setScanStatus("error");
        onError?.("Nie znaleziono żadnego kodu na obrazie");
      }
    } catch (error) {
      console.error("File scan error:", error);
      setScanStatus("error");
      onError?.("Błąd podczas skanowania pliku");
    }

    // Reset file input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const toggleFlashlight = async () => {
    if (!streamRef.current) return;

    try {
      const track = streamRef.current.getVideoTracks()[0];
      await track.applyConstraints({
        // @ts-ignore
        advanced: [{ torch: !flashEnabled }],
      });
      setFlashEnabled(!flashEnabled);
    } catch (error) {
      console.warn("Flashlight toggle failed:", error);
    }
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Scanner Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <ScanLine className="h-5 w-5" />
          <h3 className="font-semibold">Skaner QR/Kodu Kreskowego</h3>
          {scanStatus === "success" && (
            <Badge variant="default" className="border-green-200 bg-green-100 text-green-800">
              <CheckCircle className="mr-1 h-3 w-3" />
              Zeskanowano
            </Badge>
          )}
          {scanStatus === "error" && (
            <Badge variant="destructive">
              <AlertTriangle className="mr-1 h-3 w-3" />
              Błąd
            </Badge>
          )}
        </div>
        <Button variant="ghost" size="sm" onClick={() => setShowSettings(true)}>
          <Settings className="h-4 w-4" />
        </Button>
      </div>

      {/* Camera Scanner */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-lg">Skanowanie kamerą</CardTitle>
            <div className="flex items-center gap-2">
              {isScanning && streamRef.current && (
                <Button variant="ghost" size="sm" onClick={toggleFlashlight}>
                  {flashEnabled ? <ZapOff className="h-4 w-4" /> : <Zap className="h-4 w-4" />}
                </Button>
              )}
              {cameraAvailable ? (
                <Button
                  onClick={isScanning ? stopScanning : startScanning}
                  disabled={isInitializing}
                >
                  {isInitializing ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : isScanning ? (
                    <CameraOff className="mr-2 h-4 w-4" />
                  ) : (
                    <Camera className="mr-2 h-4 w-4" />
                  )}
                  {isInitializing ? "Inicjalizacja..." : isScanning ? "Zatrzymaj" : "Start"}
                </Button>
              ) : (
                <Button variant="outline" onClick={initializeCamera}>
                  <RotateCcw className="mr-2 h-4 w-4" />
                  Sprawdź kamerę
                </Button>
              )}
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {!cameraAvailable && (
            <Alert>
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                Kamera nie jest dostępna. Sprawdź uprawnienia lub użyj ręcznego wprowadzania kodu.
              </AlertDescription>
            </Alert>
          )}

          {cameraAvailable && (
            <div className="relative">
              <video
                ref={videoRef}
                className={`max-h-80 w-full rounded-lg border object-cover ${
                  scanStatus === "scanning"
                    ? "ring-2 ring-blue-500"
                    : scanStatus === "success"
                      ? "ring-2 ring-green-500"
                      : scanStatus === "error"
                        ? "ring-2 ring-red-500"
                        : ""
                }`}
                muted
                playsInline
              />

              {/* Scanning overlay */}
              {isScanning && (
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="h-48 w-48 animate-pulse rounded-lg border-2 border-dashed border-white" />
                </div>
              )}

              {/* Status overlay */}
              {scanStatus === "scanning" && (
                <div className="absolute left-4 top-4">
                  <Badge variant="default" className="border-blue-200 bg-blue-100 text-blue-800">
                    <Loader2 className="mr-1 h-3 w-3 animate-spin" />
                    Skanowanie...
                  </Badge>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {/* Manual Entry */}
      {showManualEntry && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Type className="h-4 w-4" />
              Ręczne wprowadzenie
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex gap-2">
              <Input
                value={manualCode}
                onChange={(e) => setManualCode(e.target.value)}
                placeholder="Wklej lub wpisz kod QR/kreskowy"
                onKeyPress={(e) => e.key === "Enter" && handleManualEntry()}
              />
              <Button onClick={handleManualEntry} disabled={!manualCode.trim()}>
                Skanuj
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* File Upload */}
      {showFileUpload && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-lg">
              <Upload className="h-4 w-4" />
              Prześlij obraz
            </CardTitle>
          </CardHeader>
          <CardContent>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleFileUpload}
              className="hidden"
            />
            <Button
              variant="outline"
              onClick={() => fileInputRef.current?.click()}
              className="w-full"
            >
              <Upload className="mr-2 h-4 w-4" />
              Wybierz obraz z kodem
            </Button>
          </CardContent>
        </Card>
      )}

      {/* Last Scan Result */}
      {lastScanResult && (
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Ostatni wynik</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2">
            <div className="flex items-center gap-2">
              <Badge variant="outline">
                {lastScanResult.type === "qr_code" ? "QR Code" : "Kod kreskowy"}
              </Badge>
              {lastScanResult.format && (
                <Badge variant="secondary" className="text-xs">
                  {lastScanResult.format}
                </Badge>
              )}
            </div>
            <div className="break-all rounded bg-muted p-2 font-mono text-sm">
              {lastScanResult.code}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Settings Dialog */}
      <Dialog open={showSettings} onOpenChange={setShowSettings}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Ustawienia skanera</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {cameras.length > 1 && (
              <div className="space-y-2">
                <Label>Kamera</Label>
                <Select value={selectedCamera} onValueChange={setSelectedCamera}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {cameras.map((camera) => (
                      <SelectItem key={camera.deviceId} value={camera.deviceId}>
                        {camera.label || `Kamera ${camera.deviceId.substring(0, 8)}`}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between">
              <Label>Skanowanie ciągłe</Label>
              <Switch
                checked={scannerConfig.continuousScanning}
                onCheckedChange={(checked) =>
                  setScannerConfig((prev) => ({ ...prev, continuousScanning: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Dźwięk po zeskanowaniu</Label>
              <Switch
                checked={scannerConfig.beepOnSuccess}
                onCheckedChange={(checked) =>
                  setScannerConfig((prev) => ({ ...prev, beepOnSuccess: checked }))
                }
              />
            </div>

            <div className="flex items-center justify-between">
              <Label>Wibracja po zeskanowaniu</Label>
              <Switch
                checked={scannerConfig.vibrateOnSuccess}
                onCheckedChange={(checked) =>
                  setScannerConfig((prev) => ({ ...prev, vibrateOnSuccess: checked }))
                }
              />
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
