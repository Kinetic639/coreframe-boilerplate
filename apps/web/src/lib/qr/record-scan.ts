/**
 * Counts a scan the app resolved without going through /qr/[token]
 * (see /api/qr/scans). Fire and forget: never awaited, never throws.
 */
export function reportQrScan(token: string): void {
  try {
    const payload = JSON.stringify({ token });
    if (typeof navigator !== "undefined" && typeof navigator.sendBeacon === "function") {
      navigator.sendBeacon("/api/qr/scans", new Blob([payload], { type: "application/json" }));
      return;
    }
    void fetch("/api/qr/scans", {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: payload,
      keepalive: true,
    }).catch(() => undefined);
  } catch {
    // Counting a scan must never break the scan.
  }
}
