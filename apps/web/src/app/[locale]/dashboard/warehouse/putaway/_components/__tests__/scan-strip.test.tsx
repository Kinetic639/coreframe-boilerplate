/**
 * @vitest-environment jsdom
 *
 * ScanStrip: decodes only while armed; a code must hold for two frames; the
 * same code is not taken twice in a row; idle sleep releases the camera; a
 * Bluetooth (keyboard-wedge) scanner is taken while armed.
 */
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));

const h = vi.hoisted(() => ({
  read: vi.fn(),
  release: vi.fn(),
  acquire: vi.fn(),
}));
vi.mock("zxing-wasm/reader", () => ({ readBarcodes: (...a: unknown[]) => h.read(...a) }));
vi.mock("@/components/features/qr/qr-camera-scanner", () => ({
  useSharedCamera: () => ({ acquire: h.acquire, release: h.release }),
}));
vi.mock("../scan-feedback", () => ({
  scanSuccessFeedback: vi.fn(),
  scanErrorFeedback: vi.fn(),
  unlockScanSound: vi.fn(),
}));

import { ScanStrip, SCAN_IDLE_SLEEP_MS } from "../scan-strip";

beforeEach(() => {
  vi.clearAllMocks();
  h.acquire.mockResolvedValue({});
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    value: () => Promise.resolve(),
    configurable: true,
  });
  // A video with frames, and a canvas that can be drawn on.
  Object.defineProperty(HTMLMediaElement.prototype, "readyState", { value: 4, configurable: true });
  Object.defineProperty(HTMLVideoElement.prototype, "videoWidth", {
    value: 10,
    configurable: true,
  });
  Object.defineProperty(HTMLVideoElement.prototype, "videoHeight", {
    value: 10,
    configurable: true,
  });
  HTMLCanvasElement.prototype.getContext = vi.fn(() => ({
    drawImage: vi.fn(),
    getImageData: vi.fn(() => ({})),
  })) as never;
});

afterEach(() => {
  vi.useRealTimers();
});

describe("ScanStrip", () => {
  it("takes a code only after two matching frames, and only once", async () => {
    h.read.mockResolvedValue([{ text: "https://app/qr/abc" }]);
    const onCode = vi.fn().mockResolvedValue(null);
    render(<ScanStrip armed onArm={() => {}} onCode={onCode} hint="hint" />);
    await waitFor(() => expect(onCode).toHaveBeenCalledTimes(1), { timeout: 2000 });
    expect(h.read.mock.calls.length).toBeGreaterThanOrEqual(2);
    await new Promise((r) => setTimeout(r, 400));
    expect(onCode).toHaveBeenCalledTimes(1);
  });

  it("does not decode while paused, and shows the tap-to-scan bar", async () => {
    h.read.mockResolvedValue([{ text: "abc" }]);
    const onArm = vi.fn();
    render(<ScanStrip armed={false} onArm={onArm} onCode={vi.fn()} hint="hint" />);
    await new Promise((r) => setTimeout(r, 300));
    expect(h.read).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("scan-strip-arm"));
    expect(onArm).toHaveBeenCalled();
  });

  it("puts the camera to sleep after the idle time", () => {
    vi.useFakeTimers();
    h.read.mockResolvedValue([]);
    render(<ScanStrip armed={false} onArm={() => {}} onCode={vi.fn()} hint="hint" />);
    act(() => {
      vi.advanceTimersByTime(SCAN_IDLE_SLEEP_MS + 10);
    });
    expect(h.release).toHaveBeenCalled();
    expect(screen.getByTestId("scan-strip-arm")).toHaveTextContent("sleeping");
  });

  it("takes a Bluetooth scanner's fast keystrokes ending in Enter while armed", async () => {
    h.read.mockResolvedValue([]);
    const onCode = vi.fn().mockResolvedValue(null);
    render(<ScanStrip armed onArm={() => {}} onCode={onCode} hint="hint" />);
    for (const key of "QRTOKEN1") fireEvent.keyDown(window, { key });
    fireEvent.keyDown(window, { key: "Enter" });
    await waitFor(() => expect(onCode).toHaveBeenCalledWith("QRTOKEN1"));
  });
});
