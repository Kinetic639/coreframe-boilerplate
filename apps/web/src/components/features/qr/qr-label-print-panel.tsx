"use client";

import { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import type { LabelConfig } from "@/lib/qr/label-config";
import { getQrPrintOptionsAction, type QrPrintOptions } from "@/app/actions/qr/label-templates";
import type {
  LabelDesignerField,
  LabelDesignerItem,
} from "@/app/[locale]/dashboard/qr/_components/label-designer";
import type { QrLabelTargetType } from "@/lib/qr/label-templates";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

const PREVIOUS = "previous";
const BUILTIN = "builtin";

export interface QrLabelPrintPanelProps {
  /** Object type of the labels (picks its templates); null for bare codes. */
  targetType: QrLabelTargetType | null;
  /** Codes being printed, for "as before". */
  qrCodeIds?: string[];
  /** Or the objects (of targetType) whose codes are printed. */
  targetIds?: string[];
  items: LabelDesignerItem[];
  availableFields: LabelDesignerField[];
  canExport?: boolean;
  exportEndpoint?: string;
  idsBodyKey?: string;
  fileNamePrefix?: string;
}

/**
 * Print labels of existing codes: choose the layout (as last printed, a
 * template, or the built-in one), adjust it in the designer if needed, print.
 * The server records the layout used, so the next print can match it.
 */
export function QrLabelPrintPanel({
  targetType,
  qrCodeIds,
  targetIds,
  items,
  availableFields,
  canExport = true,
  exportEndpoint,
  idsBodyKey,
  fileNamePrefix,
}: QrLabelPrintPanelProps) {
  const t = useTranslations("modules.qr.templates");
  const [options, setOptions] = useState<QrPrintOptions | null>(null);
  const [choice, setChoice] = useState<string | null>(null);
  const [formatOverride, setFormatOverride] = useState<"pdf" | "zpl" | null>(null);

  const idsKey = (qrCodeIds ?? []).join(",");
  const targetsKey = (targetIds ?? []).join(",");

  useEffect(() => {
    let live = true;
    getQrPrintOptionsAction({
      targetType,
      qrCodeIds: qrCodeIds?.slice(0, 200),
      targetIds: targetIds?.slice(0, 200),
    }).then((result) => {
      if (!live) return;
      const data: QrPrintOptions = result.success
        ? result.data
        : { templates: [], previous: null, suggested: null };
      setOptions(data);
      setChoice(data.suggested ?? BUILTIN);
      setFormatOverride(null);
    });
    return () => {
      live = false;
    };
    // The id lists are compared by value.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [targetType, idsKey, targetsKey]);

  const selected = useMemo((): {
    format: "pdf" | "zpl";
    config: LabelConfig | undefined;
    templateId: string | null;
  } => {
    if (!options || !choice || choice === BUILTIN) {
      return { format: "pdf", config: undefined, templateId: null };
    }
    if (choice === PREVIOUS && options.previous) {
      return {
        format: options.previous.layout.format,
        config: options.previous.layout.config,
        templateId: options.previous.templateId,
      };
    }
    const template = options.templates.find((tpl) => tpl.id === choice);
    if (!template?.layout) return { format: "pdf", config: undefined, templateId: null };
    return {
      format: template.layout.format,
      config: template.layout.config,
      templateId: template.id,
    };
  }, [options, choice]);

  const format = formatOverride ?? selected.format;

  if (!options || !choice) {
    return (
      <div className="flex h-full flex-col gap-4">
        <Skeleton className="h-9 w-72" />
        <Skeleton className="min-h-[320px] flex-1" />
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-end gap-3">
        <div className="grid gap-1.5">
          <Label htmlFor="qr-print-layout">{t("layoutLabel")}</Label>
          <Select
            value={choice}
            onValueChange={(value) => {
              setChoice(value);
              setFormatOverride(null);
            }}
          >
            <SelectTrigger id="qr-print-layout" className="w-72">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {options.previous ? <SelectItem value={PREVIOUS}>{t("previous")}</SelectItem> : null}
              {options.templates.map((tpl) => (
                <SelectItem key={tpl.id} value={tpl.id}>
                  {tpl.name}
                  {tpl.is_default ? ` · ${t("defaultBadge")}` : ""}
                  {tpl.layout ? ` · ${tpl.layout.format.toUpperCase()}` : ""}
                </SelectItem>
              ))}
              <SelectItem value={BUILTIN}>{t("builtin")}</SelectItem>
            </SelectContent>
          </Select>
        </div>
        <div className="grid h-9 w-[140px] grid-cols-2 rounded-lg border bg-muted p-1">
          {(["pdf", "zpl"] as const).map((value) => (
            <Button
              key={value}
              type="button"
              variant={format === value ? "default" : "ghost"}
              size="sm"
              className="h-7 text-xs"
              onClick={() => setFormatOverride(value)}
            >
              {value.toUpperCase()}
            </Button>
          ))}
        </div>
      </div>
      <div className="min-h-0 flex-1 overflow-hidden">
        <LabelDesigner
          key={`${choice}:${format}`}
          items={items}
          canExport={canExport}
          format={format}
          availableFields={availableFields}
          initialConfig={selected.config}
          exportEndpoint={exportEndpoint}
          idsBodyKey={idsBodyKey}
          fileNamePrefix={fileNamePrefix}
          extraBody={{ templateId: selected.templateId }}
        />
      </div>
    </div>
  );
}
