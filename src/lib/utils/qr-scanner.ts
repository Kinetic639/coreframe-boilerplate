import { readBarcodes } from "zxing-wasm/reader";
import type { ScannerResult, ScannerConfig } from "@/lib/types/qr-system";

/**
 * Default scanner configuration
 */
export const DEFAULT_SCANNER_CONFIG: ScannerConfig = {
  enabledFormats: ["QRCode", "Code128", "EAN13", "Code39", "DataMatrix"],
  tryHarder: true,
  maxNumberOfSymbols: 1,
  enableCamera: true,
  enableManualEntry: true,
  continuousScanning: false,
  beepOnSuccess: true,
  vibrateOnSuccess: true,
};

/**
 * Check if camera is available and accessible
 */
export async function checkCameraAvailability(): Promise<boolean> {
  try {
    if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
      return false;
    }

    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    // Stop the stream immediately after checking
    stream.getTracks().forEach((track) => track.stop());

    return true;
  } catch (error) {
    console.warn("Camera not available:", error);
    return false;
  }
}

/**
 * Get available camera devices
 */
export async function getCameraDevices(): Promise<MediaDeviceInfo[]> {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    return devices.filter((device) => device.kind === "videoinput");
  } catch (error) {
    console.error("Error getting camera devices:", error);
    return [];
  }
}

/**
 * Request camera permissions
 */
export async function requestCameraPermission(): Promise<boolean> {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: "environment" },
    });

    // Stop the stream after getting permission
    stream.getTracks().forEach((track) => track.stop());

    return true;
  } catch (error) {
    console.error("Camera permission denied:", error);
    return false;
  }
}

/**
 * Create camera stream with optimal settings for QR scanning
 */
export async function createCameraStream(deviceId?: string): Promise<MediaStream> {
  const constraints: MediaStreamConstraints = {
    video: {
      width: { ideal: 1280 },
      height: { ideal: 720 },
      facingMode: deviceId ? undefined : "environment",
      deviceId: deviceId ? { exact: deviceId } : undefined,
      focusMode: "continuous",
      exposureMode: "continuous",
      whiteBalanceMode: "continuous",
    },
  };

  return await navigator.mediaDevices.getUserMedia(constraints);
}

/**
 * Scan QR/barcode from image data
 */
export async function scanFromImageData(
  imageData: ImageData,
  config: Partial<ScannerConfig> = {}
): Promise<ScannerResult[]> {
  const scanConfig = { ...DEFAULT_SCANNER_CONFIG, ...config };

  try {
    const results = await readBarcodes(imageData, {
      tryHarder: scanConfig.tryHarder,
      formats: scanConfig.enabledFormats,
      maxNumberOfSymbols: scanConfig.maxNumberOfSymbols,
    });

    return results.map((result) => ({
      code: result.text,
      type: determineCodeType(result.format),
      format: result.format,
      rawBytes: result.bytes,
      quality: result.quality || 0,
    }));
  } catch (error) {
    console.error("Error scanning image:", error);
    return [];
  }
}

/**
 * Scan QR/barcode from video element
 */
export async function scanFromVideo(
  video: HTMLVideoElement,
  config: Partial<ScannerConfig> = {}
): Promise<ScannerResult[]> {
  // Create canvas from video frame
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d")!;

  canvas.width = video.videoWidth;
  canvas.height = video.videoHeight;

  ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

  // Get image data from canvas
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);

  return await scanFromImageData(imageData, config);
}

/**
 * Scan QR/barcode from image file
 */
export async function scanFromFile(
  file: File,
  config: Partial<ScannerConfig> = {}
): Promise<ScannerResult[]> {
  return new Promise((resolve) => {
    const img = new Image();
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d")!;

    img.onload = async () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx.drawImage(img, 0, 0);

      const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
      const results = await scanFromImageData(imageData, config);
      resolve(results);
    };

    img.onerror = () => resolve([]);

    // Create object URL for image
    const objectUrl = URL.createObjectURL(file);
    img.src = objectUrl;
  });
}

/**
 * Determine if a code is QR or barcode based on format
 */
function determineCodeType(format: string): "qr_code" | "barcode" {
  const qrFormats = ["QRCode", "DataMatrix", "Aztec", "PDF417"];
  return qrFormats.includes(format) ? "qr_code" : "barcode";
}

/**
 * Validate QR token format
 */
export function isValidQRToken(token: string): boolean {
  // QR tokens should match our generation pattern: TIMESTAMP-RANDOM
  const tokenPattern = /^[A-Z0-9]+-[A-Z0-9]+$/;
  return tokenPattern.test(token) && token.length >= 10 && token.length <= 50;
}

/**
 * Extract QR token from URL
 */
export function extractQRTokenFromURL(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const pathParts = urlObj.pathname.split("/");

    // Looking for /qr/{token} pattern
    if (pathParts.length >= 3 && pathParts[1] === "qr") {
      const token = pathParts[2];
      return isValidQRToken(token) ? token : null;
    }

    return null;
  } catch {
    return null;
  }
}

/**
 * Validate barcode format
 */
export function isValidBarcode(code: string, format?: string): boolean {
  if (!code || code.length === 0) return false;

  switch (format) {
    case "EAN13":
      return /^\d{13}$/.test(code);
    case "EAN8":
      return /^\d{8}$/.test(code);
    case "UPC":
      return /^\d{12}$/.test(code);
    case "Code128":
      return code.length > 0; // Code128 can contain any ASCII characters
    case "Code39":
      return /^[A-Z0-9\-. $\/+%]+$/.test(code);
    default:
      return code.length > 0;
  }
}

/**
 * Play success sound
 */
export function playSuccessSound(): void {
  try {
    // Create a simple beep sound using Web Audio API
    const AudioCtx =
      window.AudioContext ||
      (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    const audioContext = new AudioCtx();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    oscillator.frequency.setValueAtTime(800, audioContext.currentTime);
    gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);

    oscillator.start(audioContext.currentTime);
    oscillator.stop(audioContext.currentTime + 0.2);
  } catch (error) {
    // Fallback: no sound if Web Audio API is not available
    console.warn("Could not play success sound:", error);
  }
}

/**
 * Trigger vibration feedback
 */
export function triggerVibration(): void {
  try {
    if ("vibrate" in navigator) {
      navigator.vibrate(100); // Vibrate for 100ms
    }
  } catch (error) {
    console.warn("Could not trigger vibration:", error);
  }
}

/**
 * Handle scan success feedback
 */
export function handleScanSuccess(config: ScannerConfig): void {
  if (config.beepOnSuccess) {
    playSuccessSound();
  }

  if (config.vibrateOnSuccess) {
    triggerVibration();
  }
}
