import "server-only";

import type { LabelConfig } from "@/lib/qr/label-config";
import { generateStyledQrPngDataUrl } from "@/lib/qr/generate";
import { generateQrLabelsPdfWithConfig } from "@/server/qr/label-pdf";
import type { QrLabelPdfItem } from "@/server/qr/label-pdf";
import { generateZplLabels } from "@/lib/qr/zpl";
import type { ZplLabelItem, ZplLabelSize } from "@/lib/qr/zpl";
import { mapWithConcurrency } from "@/lib/utils/concurrency";

const QR_IMAGE_CONCURRENCY = 8;

export interface RenderLabelItem {
  /** Any stable id (code or object); used by the PDF generator only. */
  id: string;
  token: string;
  primaryText: string;
  /** Values for text lines bound to fields (see label-config field keys). */
  fields: Record<string, string>;
}

export interface RenderedLabels {
  body: Uint8Array;
  contentType: string;
  extension: "pdf" | "zpl";
}

/** One PDF (A4 sheets) or ZPL file with a label for each item, in order. */
export async function renderQrLabels(
  items: RenderLabelItem[],
  format: "pdf" | "zpl",
  labelConfig: LabelConfig,
  zplSize: ZplLabelSize = "50x30"
): Promise<RenderedLabels> {
  if (format === "pdf") {
    const pdfItems: QrLabelPdfItem[] = await mapWithConcurrency(
      items,
      QR_IMAGE_CONCURRENCY,
      async (item) => ({
        qrCodeId: item.id,
        token: item.token,
        qrDataUrl: await generateStyledQrPngDataUrl(item.token, labelConfig.qrStyle),
        primaryText: item.primaryText,
        fields: item.fields,
      })
    );
    const buffer = await generateQrLabelsPdfWithConfig(pdfItems, labelConfig);
    return { body: new Uint8Array(buffer), contentType: "application/pdf", extension: "pdf" };
  }

  const zplItems: ZplLabelItem[] = items.map((item) => ({
    token: item.token,
    fields: item.fields,
  }));
  const base = zplSize === "50x30" ? { width: 50, height: 30 } : { width: 70, height: 40 };
  const zpl = await generateZplLabels(zplItems, zplSize, {
    ...labelConfig,
    dimension:
      labelConfig.orientation === "portrait"
        ? { width: base.height, height: base.width }
        : { width: base.width, height: base.height },
  });
  return {
    body: new TextEncoder().encode(zpl),
    contentType: "text/plain; charset=utf-8",
    extension: "zpl",
  };
}

export function labelsResponse(
  rendered: RenderedLabels,
  fileName: string,
  headers: Record<string, string> = {}
): Response {
  return new Response(rendered.body as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": rendered.contentType,
      "Content-Disposition": `attachment; filename="${fileName}.${rendered.extension}"`,
      "Cache-Control": "no-store",
      ...headers,
    },
  });
}
