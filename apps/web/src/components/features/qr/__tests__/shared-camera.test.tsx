/**
 * @vitest-environment jsdom
 *
 * SharedCameraProvider: scanners mounted one after another inside it reuse
 * one camera stream (one browser "camera access" notice per session); the
 * stream stops when the provider unmounts. Outside it, each scanner opens
 * and stops its own stream as before.
 */
import { render, waitFor } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";

vi.mock("next-intl", () => ({ useTranslations: () => (key: string) => key }));
vi.mock("@/app/actions/qr/assign", () => ({ getQrCodeByTokenAction: vi.fn() }));
vi.mock("zxing-wasm/reader", () => ({ readBarcodes: vi.fn(() => new Promise(() => {})) }));

import { QrCameraScanner, SharedCameraProvider } from "../qr-camera-scanner";

const stop = vi.fn();
const getUserMedia = vi.fn();

beforeEach(() => {
  vi.clearAllMocks();
  getUserMedia.mockImplementation(() =>
    Promise.resolve({
      getTracks: () => [{ stop }],
      getVideoTracks: () => [{ readyState: "live" }],
    })
  );
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia },
    configurable: true,
  });
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    value: () => Promise.resolve(),
    configurable: true,
  });
});

const scanner = (key: number) => (
  <QrCameraScanner key={key} onScanned={async () => null} onBack={() => {}} />
);

describe("SharedCameraProvider", () => {
  it("opens the camera once for scanners mounted one after another", async () => {
    const { rerender, unmount } = render(<SharedCameraProvider>{scanner(1)}</SharedCameraProvider>);
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));

    rerender(<SharedCameraProvider>{scanner(2)}</SharedCameraProvider>);
    rerender(<SharedCameraProvider>{scanner(3)}</SharedCameraProvider>);
    await new Promise((r) => setTimeout(r, 10));
    expect(getUserMedia).toHaveBeenCalledTimes(1);
    expect(stop).not.toHaveBeenCalled();

    unmount();
    expect(stop).toHaveBeenCalledTimes(1);
  });

  it("without the provider each scanner opens and stops its own stream", async () => {
    const first = render(scanner(1));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(1));
    first.unmount();
    expect(stop).toHaveBeenCalledTimes(1);

    render(scanner(2));
    await waitFor(() => expect(getUserMedia).toHaveBeenCalledTimes(2));
  });
});
