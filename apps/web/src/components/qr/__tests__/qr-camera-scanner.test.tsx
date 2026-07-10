/**
 * Tests: components/qr/qr-camera-scanner.tsx
 *
 * extractQrToken is pure and fully tested. QrCameraScanner itself wraps
 * browser camera APIs (getUserMedia, requestAnimationFrame) and a WASM
 * decoder — this test covers the camera-denied error path (a real,
 * reachable production scenario) rather than attempting to fully simulate
 * the RAF-driven decode loop, which would require a fragile deep mock of
 * canvas/video internals for little additional confidence.
 */
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { extractQrToken, QrCameraScanner } from "../qr-camera-scanner";

describe("extractQrToken", () => {
  it("extracts the token from a full scan-gateway URL", () => {
    expect(extractQrToken("https://example.com/qr/abc123XYZ")).toBe("abc123XYZ");
  });

  it("extracts the token from a localized scan-gateway URL", () => {
    expect(extractQrToken("https://example.com/pl/qr/abc123XYZ")).toBe("abc123XYZ");
  });

  it("URL-decodes the token segment", () => {
    expect(extractQrToken("https://example.com/qr/abc%20123")).toBe("abc 123");
  });

  it("treats non-URL raw text as the token itself", () => {
    expect(extractQrToken("just-a-raw-token")).toBe("just-a-raw-token");
  });

  it("trims whitespace from raw text", () => {
    expect(extractQrToken("  raw-token  ")).toBe("raw-token");
  });

  it("returns null for empty raw text", () => {
    expect(extractQrToken("   ")).toBeNull();
  });

  it("returns null for a URL with no /qr/ segment", () => {
    expect(extractQrToken("https://example.com/dashboard/warehouse")).toBeNull();
  });
});

describe("QrCameraScanner", () => {
  it("renders the camera-error state and calls onError when getUserMedia rejects", async () => {
    const originalMediaDevices = navigator.mediaDevices;
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(new Error("denied")) },
    });

    const onError = vi.fn();
    render(
      <QrCameraScanner onDecode={vi.fn()} onError={onError} cameraErrorMessage="No camera access" />
    );

    await waitFor(() => expect(screen.getByText("No camera access")).toBeInTheDocument());
    expect(onError).toHaveBeenCalledWith("No camera access");

    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: originalMediaDevices,
    });
  });
});
