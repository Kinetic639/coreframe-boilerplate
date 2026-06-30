import { z } from "zod";
import { MAX_TEXT_LINES } from "@/lib/qr/label-config";

const textLineSchema = z.object({
  id: z.string().min(1).max(80),
  source: z.enum(["custom", "field"]),
  customText: z.string().max(120),
  fieldKey: z.string().max(80),
  caseTransform: z.enum(["none", "upper", "lower", "title"]),
  size: z.number().min(4).max(24),
  bold: z.boolean(),
  align: z.enum(["left", "center", "right"]),
});

export const labelConfigSchema = z.object({
  dimension: z.object({
    width: z.number().min(10).max(210),
    height: z.number().min(10).max(297),
  }),
  orientation: z.enum(["landscape", "portrait"]),
  includeLogo: z.boolean(),
  logoBackgroundStyle: z.enum(["brand", "circle", "square"]),
  qrHeightRatio: z.number().min(0.4).max(1),
  qrStyle: z.object({
    frameShape: z.enum(["square", "circle"]),
    dotStyle: z.enum(["square", "dots", "rounded", "classy", "classy-rounded", "extra-rounded"]),
    cornerSquareStyle: z.enum([
      "square",
      "dot",
      "extra-rounded",
      "dots",
      "rounded",
      "classy",
      "classy-rounded",
    ]),
    cornerDotStyle: z.enum([
      "dot",
      "square",
      "dots",
      "rounded",
      "classy",
      "classy-rounded",
      "extra-rounded",
    ]),
  }),
  showBorder: z.boolean(),
  outerPaddingMm: z.number().min(0).max(20),
  innerPaddingMm: z.number().min(0).max(20),
  textPosition: z.enum(["right", "left", "above", "below"]),
  textVerticalAlign: z.enum(["start", "center", "end"]),
  textLines: z.array(textLineSchema).max(MAX_TEXT_LINES),
  edgeGuides: z.object({
    show: z.boolean(),
    thickness: z.number().min(0.1).max(4),
    style: z.enum(["solid", "dotted", "dashed"]),
    color: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
    opacity: z.number().min(0).max(1),
  }),
  footer: z.object({
    show: z.boolean(),
  }),
});
