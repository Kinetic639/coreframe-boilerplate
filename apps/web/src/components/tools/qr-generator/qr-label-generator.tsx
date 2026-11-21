"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { useFormatter, useTranslations } from "next-intl";
import { toast } from "react-toastify";
import {
  ArrowLeft,
  Copy,
  FileSearch,
  MoreHorizontal,
  Pencil,
  Plus,
  Printer,
  Star,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { usePermissions } from "@/hooks/v2/use-permissions";
import { QR_CREATE, QR_EXPORT, QR_READ } from "@/lib/constants/permissions";
import {
  DEFAULT_LABEL_CONFIG,
  PRIMARY_FIELD_KEY,
  SCAN_URL_FIELD_KEY,
  TOKEN_FIELD_KEY,
  type LabelConfig,
} from "@/lib/qr/label-config";
import {
  QR_LABEL_TARGET_TYPES,
  zplSizeForConfig,
  type QrLabelFormat,
  type QrLabelTargetType,
} from "@/lib/qr/label-templates";
import {
  deleteQrLabelTemplateAction,
  duplicateQrLabelTemplateAction,
  listQrLabelTemplatesAction,
  listQrPrintBatchesAction,
  saveQrLabelTemplateAction,
  setDefaultQrLabelTemplateAction,
} from "@/app/actions/qr/label-templates";
import type { QrLabelTemplate, QrPrintBatch } from "@/server/services/qr-labels.service";
import type { LabelDesignerField } from "@/app/[locale]/dashboard/qr/_components/label-designer";
import { QrPdfPreviewDialog } from "@/app/[locale]/dashboard/qr/_components/qr-pdf-preview-dialog";
import { ZplPreviewDialog } from "@/components/features/qr/zpl-preview-dialog";
import { getLocationLabelFields } from "@/app/[locale]/dashboard/warehouse/locations/_lib/label-fields";

const LabelDesigner = dynamic(
  () =>
    import("@/app/[locale]/dashboard/qr/_components/label-designer").then(
      (mod) => mod.LabelDesigner
    ),
  { ssr: false }
);

/** Mirrors MAX_PRINT_QUANTITY of /api/qr/print. */
const MAX_PRINT_QUANTITY = 500;
const GENERAL = "general";
const BUILTIN = "builtin";

type TypeKey = typeof GENERAL | QrLabelTargetType;

function typeKey(type: QrLabelTargetType | null): TypeKey {
  return type ?? GENERAL;
}

function typeLabelKey(key: TypeKey): string {
  return `types.${key.replace(".", "_")}`;
}

type EditorState = { template: QrLabelTemplate | null };

/**
 * QR Label Generator (tool "qr-generator"): label templates and blank label
 * printing. Codes are created by printing -- never by hand -- and managed in
 * Organization → QR codes.
 */
export function QrLabelGenerator({ orgId }: { orgId: string }) {
  const t = useTranslations("modules.qr.templates");
  const { can } = usePermissions();
  const canExport = can(QR_EXPORT);
  const canCreate = can(QR_CREATE) && canExport;
  const canRead = can(QR_READ);

  const [templates, setTemplates] = useState<QrLabelTemplate[] | null>(null);
  const [batches, setBatches] = useState<QrPrintBatch[] | null>(null);
  const [editor, setEditor] = useState<EditorState | null>(null);
  const [printTemplateId, setPrintTemplateId] = useState<string | null>(null);
  const [printOpen, setPrintOpen] = useState(false);
  const [toDelete, setToDelete] = useState<QrLabelTemplate | null>(null);
  const [preview, setPreview] = useState<{ url: string | null; generating: boolean } | null>(null);
  const [zplPreview, setZplPreview] = useState<{
    zpl: string | null;
    /** Generated files can be downloaded; an opened file has its name as the title. */
    fileName?: string;
    title: string;
  } | null>(null);
  const zplFileInput = useRef<HTMLInputElement | null>(null);
  const tZpl = useTranslations("modules.qr.zplPreview");

  async function openZplFile(file: File | undefined) {
    if (!file) return;
    try {
      setZplPreview({ zpl: await file.text(), title: file.name });
    } catch {
      toast.error(tZpl("readError"));
    }
  }

  const loadTemplates = useCallback(async () => {
    const result = await listQrLabelTemplatesAction();
    setTemplates(result.success ? result.data : []);
  }, []);

  const loadBatches = useCallback(async () => {
    if (!canRead) return setBatches([]);
    const result = await listQrPrintBatchesAction();
    setBatches(result.success ? result.data : []);
  }, [canRead]);

  useEffect(() => {
    setTemplates(null);
    setBatches(null);
    void loadTemplates();
    void loadBatches();
  }, [orgId, loadTemplates, loadBatches]);

  /** Shows the printed labels in the PDF or ZPL preview, which also downloads them. */
  async function runPrint(body: Record<string, unknown>): Promise<boolean> {
    const isZpl = body.mode === "new" && body.format === "zpl";
    const zplTarget = { fileName: "qr-labels.zpl", title: t("print.previewTitle") };
    if (isZpl) setZplPreview({ zpl: null, ...zplTarget });
    else setPreview({ url: null, generating: true });
    try {
      const res = await fetch("/api/qr/print", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = (await res.json().catch(() => ({}))) as { error?: string };
        setPreview(null);
        setZplPreview(null);
        toast.error(err.error ?? t("toasts.printFailed"));
        return false;
      }
      const blob = await res.blob();
      if (blob.type.startsWith("application/pdf")) {
        setPreview({ url: URL.createObjectURL(blob), generating: false });
      } else {
        setPreview(null);
        setZplPreview({ zpl: await blob.text(), ...zplTarget });
      }
      return true;
    } catch {
      setPreview(null);
      setZplPreview(null);
      toast.error(t("toasts.printFailed"));
      return false;
    }
  }

  async function handleDuplicate(template: QrLabelTemplate) {
    const result = await duplicateQrLabelTemplateAction({
      id: template.id,
      name: t("copyOf", { name: template.name }).slice(0, 120),
    });
    if (!result.success) return toast.error(t("toasts.failed"));
    toast.success(t("toasts.duplicated"));
    void loadTemplates();
  }

  async function handleSetDefault(template: QrLabelTemplate) {
    const result = await setDefaultQrLabelTemplateAction({ id: template.id });
    if (!result.success) return toast.error(t("toasts.failed"));
    toast.success(t("toasts.defaultSet"));
    void loadTemplates();
  }

  async function handleDelete() {
    if (!toDelete) return;
    const result = await deleteQrLabelTemplateAction({ id: toDelete.id });
    setToDelete(null);
    if (!result.success) return toast.error(t("toasts.failed"));
    toast.success(t("toasts.deleted"));
    void loadTemplates();
  }

  if (editor) {
    return (
      <TemplateEditor
        template={editor.template}
        canEdit={canExport}
        onBack={() => {
          setEditor(null);
          void loadTemplates();
        }}
        onSaved={(saved) => setEditor({ template: saved })}
      />
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <Tabs defaultValue="templates" className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="templates">{t("tabs.templates")}</TabsTrigger>
            {canRead ? <TabsTrigger value="batches">{t("tabs.batches")}</TabsTrigger> : null}
          </TabsList>
          <div className="flex items-center gap-2">
            <input
              ref={zplFileInput}
              type="file"
              accept=".zpl,.txt,text/plain"
              className="hidden"
              onChange={(e) => {
                void openZplFile(e.target.files?.[0]);
                e.target.value = "";
              }}
            />
            <Button
              variant="outline"
              title={tZpl("openHint")}
              onClick={() => zplFileInput.current?.click()}
            >
              <FileSearch className="mr-1.5 size-4" />
              {tZpl("open")}
            </Button>
            {canExport ? (
              <Button variant="outline" onClick={() => setEditor({ template: null })}>
                <Plus className="mr-1.5 size-4" />
                {t("new")}
              </Button>
            ) : null}
            {canCreate ? (
              <Button
                onClick={() => {
                  setPrintTemplateId(null);
                  setPrintOpen(true);
                }}
              >
                <Printer className="mr-1.5 size-4" />
                {t("print.open")}
              </Button>
            ) : null}
          </div>
        </div>

        <TabsContent value="templates" className="!mt-0">
          <p className="mb-3 text-sm text-muted-foreground">{t("description")}</p>
          {templates === null ? (
            <Skeleton className="h-40 w-full" />
          ) : templates.length === 0 ? (
            <div className="rounded-lg border border-dashed p-8 text-center">
              <p className="text-sm font-medium">{t("empty")}</p>
              <p className="mt-1 text-sm text-muted-foreground">{t("emptyHint")}</p>
              {canExport ? (
                <Button className="mt-4" onClick={() => setEditor({ template: null })}>
                  <Plus className="mr-1.5 size-4" />
                  {t("new")}
                </Button>
              ) : null}
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>{t("columns.name")}</TableHead>
                    <TableHead>{t("columns.type")}</TableHead>
                    <TableHead>{t("columns.format")}</TableHead>
                    <TableHead>{t("columns.size")}</TableHead>
                    <TableHead className="w-12" />
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {templates.map((template) => (
                    <TableRow key={template.id}>
                      <TableCell className="font-medium">
                        <button
                          type="button"
                          className="text-left hover:underline disabled:no-underline"
                          disabled={!canExport}
                          onClick={() => setEditor({ template })}
                        >
                          {template.name}
                        </button>
                        {template.is_default ? (
                          <Badge variant="secondary" className="ml-2">
                            {t("defaultBadge")}
                          </Badge>
                        ) : null}
                      </TableCell>
                      <TableCell>{t(typeLabelKey(typeKey(template.target_type)))}</TableCell>
                      <TableCell>{template.layout?.format.toUpperCase() ?? "—"}</TableCell>
                      <TableCell className="tabular-nums">
                        {template.layout
                          ? `${template.layout.config.dimension.width}×${template.layout.config.dimension.height} mm`
                          : "—"}
                      </TableCell>
                      <TableCell>
                        <DropdownMenu>
                          <DropdownMenuTrigger asChild>
                            <Button variant="ghost" size="icon" aria-label={t("columns.actions")}>
                              <MoreHorizontal className="size-4" />
                            </Button>
                          </DropdownMenuTrigger>
                          <DropdownMenuContent align="end">
                            {canCreate ? (
                              <DropdownMenuItem
                                onSelect={() => {
                                  setPrintTemplateId(template.id);
                                  setPrintOpen(true);
                                }}
                              >
                                <Printer className="mr-2 size-4" />
                                {t("actions.print")}
                              </DropdownMenuItem>
                            ) : null}
                            {canExport ? (
                              <>
                                <DropdownMenuItem onSelect={() => setEditor({ template })}>
                                  <Pencil className="mr-2 size-4" />
                                  {t("actions.edit")}
                                </DropdownMenuItem>
                                <DropdownMenuItem onSelect={() => void handleDuplicate(template)}>
                                  <Copy className="mr-2 size-4" />
                                  {t("actions.duplicate")}
                                </DropdownMenuItem>
                                {!template.is_default ? (
                                  <DropdownMenuItem
                                    onSelect={() => void handleSetDefault(template)}
                                  >
                                    <Star className="mr-2 size-4" />
                                    {t("actions.setDefault")}
                                  </DropdownMenuItem>
                                ) : null}
                                <DropdownMenuSeparator />
                                <DropdownMenuItem
                                  className="text-destructive focus:text-destructive"
                                  onSelect={() => setToDelete(template)}
                                >
                                  <Trash2 className="mr-2 size-4" />
                                  {t("actions.delete")}
                                </DropdownMenuItem>
                              </>
                            ) : null}
                          </DropdownMenuContent>
                        </DropdownMenu>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </TabsContent>

        {canRead ? (
          <TabsContent value="batches" className="!mt-0">
            <BatchList
              batches={batches}
              canPrint={canExport}
              onPrintAgain={async (batch) => {
                await runPrint({ mode: "again", batchId: batch.id });
              }}
            />
          </TabsContent>
        ) : null}
      </Tabs>

      <BlankPrintDialog
        open={printOpen}
        onOpenChange={setPrintOpen}
        templates={templates ?? []}
        initialTemplateId={printTemplateId}
        onPrint={async (body) => {
          const ok = await runPrint(body);
          if (ok) {
            setPrintOpen(false);
            toast.success(t("print.done", { count: body.quantity as number }));
            void loadBatches();
          }
          return ok;
        }}
      />

      <QrPdfPreviewDialog
        open={!!preview}
        onOpenChange={(open) => {
          if (!open) {
            if (preview?.url) URL.revokeObjectURL(preview.url);
            setPreview(null);
          }
        }}
        blobUrl={preview?.url ?? null}
        generating={!!preview?.generating}
        fileName="qr-labels.pdf"
        title={t("print.previewTitle")}
      />

      <ZplPreviewDialog
        open={!!zplPreview}
        onOpenChange={(open) => {
          if (!open) setZplPreview(null);
        }}
        zpl={zplPreview?.zpl ?? null}
        generating={!!zplPreview && zplPreview.zpl === null}
        fileName={zplPreview?.fileName}
        title={zplPreview?.title ?? ""}
      />

      <AlertDialog open={!!toDelete} onOpenChange={(open) => !open && setToDelete(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{t("deleteTitle", { name: toDelete?.name ?? "" })}</AlertDialogTitle>
            <AlertDialogDescription>{t("deleteDescription")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              onClick={() => void handleDelete()}
            >
              {t("deleteConfirm")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Template editor
// ---------------------------------------------------------------------------

function TemplateEditor({
  template,
  canEdit,
  onBack,
  onSaved,
}: {
  template: QrLabelTemplate | null;
  canEdit: boolean;
  onBack: () => void;
  onSaved: (template: QrLabelTemplate) => void;
}) {
  const t = useTranslations("modules.qr.templates");
  const tQr = useTranslations("modules.qr.designer");
  const tLoc = useTranslations("ambraLocations.qr");
  const [name, setName] = useState(template?.name ?? "");
  const [type, setType] = useState<TypeKey>(typeKey(template?.target_type ?? null));
  const [format, setFormat] = useState<QrLabelFormat>(template?.layout?.format ?? "pdf");
  const [isDefault, setIsDefault] = useState(template?.is_default ?? false);
  const [nameError, setNameError] = useState(false);

  const fields: LabelDesignerField[] = useMemo(
    () =>
      type === "warehouse.location"
        ? getLocationLabelFields(tLoc)
        : [
            { key: PRIMARY_FIELD_KEY, label: tQr("fields.qrLabel") },
            { key: TOKEN_FIELD_KEY, label: tQr("fields.qrToken") },
            { key: SCAN_URL_FIELD_KEY, label: tQr("fields.scanUrl") },
          ],
    [type, tLoc, tQr]
  );

  // The saved layout seeds the designer only in its own format.
  const initialConfig =
    template?.layout && template.layout.format === format ? template.layout.config : undefined;

  async function save(config: LabelConfig) {
    if (!name.trim()) {
      setNameError(true);
      toast.error(t("editor.nameRequired"));
      return;
    }
    const result = await saveQrLabelTemplateAction({
      id: template?.id,
      name: name.trim(),
      targetType: type === GENERAL ? null : type,
      format,
      config,
      isDefault,
    });
    if (!result.success) {
      toast.error(t("toasts.saveFailed"));
      return;
    }
    toast.success(t("toasts.saved"));
    onSaved(result.data);
  }

  return (
    <div className="flex h-full min-h-0 flex-col gap-4">
      <div className="flex shrink-0 flex-wrap items-center gap-3">
        <Button variant="outline" size="icon" onClick={onBack} aria-label={t("editor.back")}>
          <ArrowLeft className="size-4" />
        </Button>
        <h2 className="text-lg font-semibold">
          {template ? t("editor.editTitle", { name: template.name }) : t("editor.newTitle")}
        </h2>
      </div>

      <div className="grid shrink-0 gap-4 rounded-lg border bg-card p-4 md:grid-cols-[minmax(0,1fr)_220px_auto_auto] md:items-end">
        <div className="grid gap-1.5">
          <Label htmlFor="qr-template-name">{t("editor.name")}</Label>
          <Input
            id="qr-template-name"
            value={name}
            maxLength={120}
            aria-invalid={nameError}
            onChange={(e) => {
              setName(e.target.value);
              if (e.target.value.trim()) setNameError(false);
            }}
            onBlur={() => setNameError(!name.trim())}
          />
          {nameError ? (
            <p className="text-xs text-destructive">{t("editor.nameRequired")}</p>
          ) : null}
        </div>
        <div className="grid gap-1.5">
          <Label htmlFor="qr-template-type">{t("editor.type")}</Label>
          <Select value={type} onValueChange={(value) => setType(value as TypeKey)}>
            <SelectTrigger id="qr-template-type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {[GENERAL, ...QR_LABEL_TARGET_TYPES].map((key) => (
                <SelectItem key={key} value={key}>
                  {t(typeLabelKey(key as TypeKey))}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="grid gap-1.5">
          <Label>{t("editor.format")}</Label>
          <div className="grid h-9 w-[140px] grid-cols-2 rounded-lg border bg-muted p-1">
            {(["pdf", "zpl"] as const).map((value) => (
              <Button
                key={value}
                type="button"
                variant={format === value ? "default" : "ghost"}
                size="sm"
                className="h-7 text-xs"
                onClick={() => setFormat(value)}
              >
                {value.toUpperCase()}
              </Button>
            ))}
          </div>
        </div>
        <label className="flex h-9 items-center gap-2 text-sm">
          <Checkbox
            checked={isDefault}
            disabled={template?.is_default}
            onCheckedChange={(checked) => setIsDefault(checked === true)}
          />
          {t("editor.isDefault")}
        </label>
      </div>

      <div className="min-h-[640px] flex-1 overflow-hidden">
        <LabelDesigner
          key={`${template?.id ?? "new"}:${format}`}
          items={[]}
          canExport={canEdit}
          format={format}
          availableFields={fields}
          mode="template-editor"
          initialConfig={initialConfig}
          onSaveTemplate={save}
          saveTemplateSummary={t("editor.summary")}
          saveTemplateLabel={t("editor.save")}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Blank label print
// ---------------------------------------------------------------------------

function BlankPrintDialog({
  open,
  onOpenChange,
  templates,
  initialTemplateId,
  onPrint,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  templates: QrLabelTemplate[];
  initialTemplateId: string | null;
  onPrint: (body: Record<string, unknown>) => Promise<boolean>;
}) {
  const t = useTranslations("modules.qr.templates");
  const [templateId, setTemplateId] = useState<string>(BUILTIN);
  const [quantity, setQuantity] = useState("10");
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!open) return;
    const general = templates.find((tpl) => tpl.is_default && tpl.target_type === null);
    setTemplateId(initialTemplateId ?? general?.id ?? templates[0]?.id ?? BUILTIN);
    setName("");
  }, [open, initialTemplateId, templates]);

  const count = Number(quantity);
  const validCount = Number.isInteger(count) && count >= 1 && count <= MAX_PRINT_QUANTITY;

  async function submit() {
    if (!validCount) return;
    const template = templates.find((tpl) => tpl.id === templateId);
    const format: QrLabelFormat = template?.layout?.format ?? "pdf";
    const labelConfig: LabelConfig = template?.layout?.config ?? DEFAULT_LABEL_CONFIG;
    setBusy(true);
    try {
      await onPrint({
        mode: "new",
        quantity: count,
        name: name.trim() || null,
        templateId: template?.id ?? null,
        format,
        labelConfig,
        ...(format === "zpl" ? { zplSize: zplSizeForConfig(labelConfig) } : {}),
      });
    } finally {
      setBusy(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("print.title")}</DialogTitle>
          <DialogDescription>{t("print.description")}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4">
          <div className="grid gap-1.5">
            <Label htmlFor="qr-print-template">{t("print.template")}</Label>
            <Select value={templateId} onValueChange={setTemplateId}>
              <SelectTrigger id="qr-print-template">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {templates.map((tpl) => (
                  <SelectItem key={tpl.id} value={tpl.id}>
                    {tpl.name}
                    {tpl.layout ? ` · ${tpl.layout.format.toUpperCase()}` : ""}
                  </SelectItem>
                ))}
                <SelectItem value={BUILTIN}>{t("builtin")}</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qr-print-quantity">{t("print.quantity")}</Label>
            <Input
              id="qr-print-quantity"
              type="number"
              inputMode="numeric"
              min={1}
              max={MAX_PRINT_QUANTITY}
              value={quantity}
              aria-invalid={!validCount}
              onChange={(e) => setQuantity(e.target.value)}
            />
            <p
              className={validCount ? "text-xs text-muted-foreground" : "text-xs text-destructive"}
            >
              {t("print.quantityHint", { max: MAX_PRINT_QUANTITY })}
            </p>
          </div>
          <div className="grid gap-1.5">
            <Label htmlFor="qr-print-name">{t("print.name")}</Label>
            <Input
              id="qr-print-name"
              value={name}
              maxLength={120}
              placeholder={t("print.namePlaceholder")}
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            {t("cancel")}
          </Button>
          <Button onClick={() => void submit()} disabled={!validCount || busy}>
            <Printer className="mr-1.5 size-4" />
            {busy ? t("print.printing") : t("print.submit", { count: validCount ? count : 0 })}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

// ---------------------------------------------------------------------------
// Print runs
// ---------------------------------------------------------------------------

function BatchList({
  batches,
  canPrint,
  onPrintAgain,
}: {
  batches: QrPrintBatch[] | null;
  canPrint: boolean;
  onPrintAgain: (batch: QrPrintBatch) => Promise<void>;
}) {
  const t = useTranslations("modules.qr.templates.batches");
  const format = useFormatter();
  const [busyId, setBusyId] = useState<string | null>(null);

  if (batches === null) return <Skeleton className="h-40 w-full" />;

  return (
    <div className="grid gap-3">
      <p className="text-sm text-muted-foreground">{t("description")}</p>
      {batches.length === 0 ? (
        <div className="rounded-lg border border-dashed p-8 text-center text-sm text-muted-foreground">
          {t("empty")}
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>{t("columns.created")}</TableHead>
                <TableHead>{t("columns.name")}</TableHead>
                <TableHead>{t("columns.template")}</TableHead>
                <TableHead className="text-right">{t("columns.quantity")}</TableHead>
                <TableHead className="w-40" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {batches.map((batch) => (
                <TableRow key={batch.id}>
                  <TableCell className="whitespace-nowrap tabular-nums">
                    {format.dateTime(new Date(batch.created_at), {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </TableCell>
                  <TableCell>{batch.name ?? t("unnamed")}</TableCell>
                  <TableCell>{batch.template?.name ?? "—"}</TableCell>
                  <TableCell className="text-right tabular-nums">{batch.quantity}</TableCell>
                  <TableCell className="text-right">
                    {canPrint ? (
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={busyId === batch.id}
                        onClick={async () => {
                          setBusyId(batch.id);
                          try {
                            await onPrintAgain(batch);
                          } finally {
                            setBusyId(null);
                          }
                        }}
                      >
                        <Printer className="mr-1.5 size-3.5" />
                        {t("again")}
                      </Button>
                    ) : null}
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  );
}
