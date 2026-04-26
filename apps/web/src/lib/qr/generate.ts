import QRCode from "qrcode";
import type { QrStyleConfig } from "@/lib/qr/label-config";

const QR_OPTIONS = {
  errorCorrectionLevel: "H" as const, // high — 30% data recovery, essential for physical labels
  margin: 2,
  width: 300,
};

const styledQrSvgDataUrlCache = new Map<string, Promise<string>>();
const styledQrPngDataUrlCache = new Map<string, Promise<string>>();

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

/**
 * Generates an elegant styled QR SVG data URL for printable labels.
 * Falls back to the plain QR library if the styling renderer fails.
 */
export async function generateStyledQrSvgDataUrl(token: string): Promise<string> {
  if (!token || token.trim().length === 0) {
    throw new Error("QR token must be a non-empty string.");
  }

  let cached = styledQrSvgDataUrlCache.get(token);
  if (!cached) {
    cached = buildStyledQrSvgDataUrl(token);
    styledQrSvgDataUrlCache.set(token, cached);
  }

  try {
    return await cached;
  } catch (error) {
    styledQrSvgDataUrlCache.delete(token);
    console.error("[generateStyledQrSvgDataUrl] Falling back to plain SVG QR:", error);
    const plainSvg = await generateQrSvgString(token);
    return `data:image/svg+xml;base64,${Buffer.from(plainSvg, "utf8").toString("base64")}`;
  }
}

/**
 * Generates a styled PNG QR data URL suitable for @react-pdf/renderer.
 * Falls back to the plain qrcode PNG generator if the styling renderer fails.
 */
export async function generateStyledQrPngDataUrl(
  token: string,
  qrStyle: QrStyleConfig
): Promise<string> {
  if (!token || token.trim().length === 0) {
    throw new Error("QR token must be a non-empty string.");
  }

  const cacheKey = `${token}:${JSON.stringify(qrStyle)}`;
  let cached = styledQrPngDataUrlCache.get(cacheKey);
  if (!cached) {
    cached = buildStyledQrPngDataUrl(token, qrStyle);
    styledQrPngDataUrlCache.set(cacheKey, cached);
  }

  try {
    return await cached;
  } catch (error) {
    styledQrPngDataUrlCache.delete(cacheKey);
    console.error("[generateStyledQrPngDataUrl] Falling back to plain PNG QR:", error);
    return generateQrPngDataUrl(token);
  }
}

async function buildStyledQrSvgDataUrl(token: string): Promise<string> {
  const [{ JSDOM }, qrCodeStylingModule] = await Promise.all([
    import("jsdom"),
    import("qr-code-styling"),
  ]);

  const QRCodeStyling =
    qrCodeStylingModule.default ??
    (qrCodeStylingModule as { QRCodeStyling?: unknown }).QRCodeStyling;

  if (typeof QRCodeStyling !== "function") {
    throw new Error("qr-code-styling constructor is unavailable.");
  }

  const qr = new (QRCodeStyling as new (options: Record<string, unknown>) => {
    getRawData: (extension: "svg") => Promise<Buffer | Blob>;
  })({
    jsdom: JSDOM,
    type: "svg",
    width: QR_OPTIONS.width,
    height: QR_OPTIONS.width,
    data: token,
    margin: 0,
    qrOptions: {
      errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel,
      mode: "Byte",
    },
    dotsOptions: {
      color: "#111111",
      type: "rounded",
    },
    cornersSquareOptions: {
      color: "#111111",
      type: "extra-rounded",
    },
    cornersDotOptions: {
      color: "#111111",
      type: "dot",
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    imageOptions: {
      saveAsBlob: false,
    },
  });

  const raw = await qr.getRawData("svg");
  const svg = Buffer.isBuffer(raw) ? raw.toString("utf8") : String(raw);
  return `data:image/svg+xml;base64,${Buffer.from(svg, "utf8").toString("base64")}`;
}

async function buildStyledQrPngDataUrl(token: string, qrStyle: QrStyleConfig): Promise<string> {
  const [{ JSDOM }, canvasModule, qrCodeStylingModule] = await Promise.all([
    import("jsdom"),
    import("canvas"),
    import("qr-code-styling"),
  ]);

  const QRCodeStyling =
    qrCodeStylingModule.default ??
    (qrCodeStylingModule as { QRCodeStyling?: unknown }).QRCodeStyling;

  if (typeof QRCodeStyling !== "function") {
    throw new Error("qr-code-styling constructor is unavailable.");
  }

  const qr = new (QRCodeStyling as new (options: Record<string, unknown>) => {
    getRawData: (extension: "png") => Promise<Buffer | Blob>;
  })({
    jsdom: JSDOM,
    nodeCanvas: canvasModule,
    type: "canvas",
    width: QR_OPTIONS.width,
    height: QR_OPTIONS.width,
    data: token,
    margin: QR_OPTIONS.margin,
    shape: qrStyle.frameShape,
    qrOptions: {
      errorCorrectionLevel: QR_OPTIONS.errorCorrectionLevel,
      mode: "Byte",
    },
    dotsOptions: {
      color: "#111111",
      type: qrStyle.dotStyle,
      roundSize: true,
    },
    cornersSquareOptions: {
      color: "#111111",
      type: qrStyle.cornerSquareStyle,
    },
    cornersDotOptions: {
      color: "#111111",
      type: qrStyle.cornerDotStyle,
    },
    backgroundOptions: {
      color: "#ffffff",
    },
    imageOptions: {
      saveAsBlob: false,
    },
  });

  const raw = await qr.getRawData("png");
  const png = Buffer.isBuffer(raw) ? raw : Buffer.from(await (raw as Blob).arrayBuffer());
  return `data:image/png;base64,${png.toString("base64")}`;
}
