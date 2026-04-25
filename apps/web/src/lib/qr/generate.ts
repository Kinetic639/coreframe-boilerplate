import QRCode from "qrcode";

const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const, // high — 30% data recovery, essential for physical labels
  margin: 2,
  width: 300,
};

/**
 * Generates a base64 data URL for the given QR token.
 * Output format: `data:image/png;base64,...`
 * Suitable for embedding in @react-pdf/renderer Image components.
 */
export async function generateQrPngDataUrl(token: string): Promise<string> {
  if (!token || token.trim().length === 0) {
    throw new Error("QR token must be a non-empty string.");
  }
  return QRCode.toDataURL(token, QR_OPTIONS);
}

/**
 * Generates an SVG string for the given QR token.
 * Suitable for inline SVG display or further processing.
 */
export async function generateQrSvgString(token: string): Promise<string> {
  if (!token || token.trim().length === 0) {
    throw new Error("QR token must be a non-empty string.");
  }
  return QRCode.toString(token, { ...QR_OPTIONS, type: "svg" });
}
