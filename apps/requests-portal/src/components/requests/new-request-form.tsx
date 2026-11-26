"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import {
  Building2,
  Camera,
  CircleCheck,
  FileText,
  Loader2,
  Paperclip,
  SearchX,
  Send,
  ShieldCheck,
  X,
} from "lucide-react";
import { useLocale, useTranslations } from "next-intl";
import { RichTextEditorField } from "@repo/rich-text/rich-text-editor-field";
import { extractPlainText, isRichTextEmpty, type RichTextValue } from "@repo/rich-text";
import { createRequestAction, lookupOrderAction, type ActionState } from "@/app/actions/requests";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatBytes } from "@/lib/format";
import { cn } from "@/lib/utils";
import { LIMITS } from "@/lib/validation/requests";
import type { OrderLookup } from "@/server/requests/requests.service";
import type { NewRequestOptions } from "@/server/requests/new-request-options";
import { AvatarStack } from "./avatar";

const RECENT_KEY = "rp_recent_warehouses";

function readRecent(): string[] {
  try {
    const v = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(v) ? v.filter((x) => /^\d{4}$/.test(x)).slice(0, 4) : [];
  } catch {
    return [];
  }
}

function rememberWarehouse(mag: string) {
  try {
    const next = [mag, ...readRecent().filter((m) => m !== mag)].slice(0, 4);
    window.localStorage.setItem(RECENT_KEY, JSON.stringify(next));
  } catch {
    // storage unavailable (private mode): the shortcuts are a convenience only
  }
}

type FieldErrors = Partial<Record<"typeId" | "title" | "orderNumber" | "warehouse", true>>;

/**
 * New request: branch, type (who will resolve it), title, optional repair order (looked up
 * in Ambra), description and files. Same form in the desktop dialog and the phone page;
 * `footer` places the buttons (dialog footer or a bar stuck to the bottom of the screen).
 */
export function NewRequestForm({
  options,
  onCancel,
  layout,
}: {
  options: NewRequestOptions & { defaultBranchId: string };
  onCancel: () => void;
  layout: "dialog" | "page";
}) {
  const t = useTranslations("requests.new");
  const tb = useTranslations("requests.editor");
  const locale = useLocale();
  const { branches, typesByBranch, warehousesByBranch } = options;
  const [state, action, pending] = useActionState<ActionState, FormData>(createRequestAction, null);

  const [branchId, setBranchId] = useState(options.defaultBranchId);
  const types = useMemo(() => typesByBranch[branchId] ?? [], [typesByBranch, branchId]);
  const [typeId, setTypeId] = useState("");
  const type = types.find((x) => x.id === typeId);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState<RichTextValue | null>(null);

  const [nr, setNr] = useState("");
  const [mag, setMag] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const branchWarehouses = warehousesByBranch[branchId] ?? [];
  const [lookup, setLookup] = useState<OrderLookup | null>(null);
  const [looking, startLookup] = useTransition();
  const [files, setFiles] = useState<File[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  // Client checks run on submit, then again as the user fixes a field (an error clears at once).
  const [tried, setTried] = useState(false);
  const localErrors: FieldErrors = {};
  if (!typeId) localErrors.typeId = true;
  if (title.trim().length < LIMITS.titleMin) localErrors.title = true;
  if (nr && !/^\d{4}$/.test(mag)) localErrors.warehouse = true;
  if (mag && !nr) localErrors.orderNumber = true;
  const serverErrors = (state?.fieldErrors ?? {}) as FieldErrors;
  const errors: FieldErrors = tried ? localErrors : {};
  for (const k of Object.keys(serverErrors) as (keyof FieldErrors)[]) {
    if (localErrors[k]) errors[k] = true;
  }

  useEffect(() => setRecent(readRecent()), []);
  useEffect(() => {
    if (!types.some((x) => x.id === typeId)) setTypeId("");
  }, [types, typeId]);

  useEffect(() => {
    setLookup(null);
    if (!/^\d{3,8}$/.test(nr) || !/^\d{4}$/.test(mag)) return;
    const id = setTimeout(
      () => startLookup(async () => setLookup(await lookupOrderAction(nr, mag))),
      350
    );
    return () => clearTimeout(id);
  }, [nr, mag]);

  const err = (field: keyof FieldErrors) =>
    errors[field] ? (
      <p role="alert" className="text-[13px] text-destructive">
        {t(`errors.${field}`)}
      </p>
    ) : null;
  const addFiles = (list: FileList | null) =>
    setFiles((all) => [...all, ...Array.from(list ?? [])].slice(0, LIMITS.maxFiles));
  const shortcuts = branchWarehouses.length
    ? branchWarehouses.map((w) => ({ code: w.code, name: w.name }))
    : recent.map((code) => ({ code, name: null as string | null }));

  return (
    <form
      noValidate
      action={(fd) => {
        fd.delete("files");
        files.forEach((f) => fd.append("files", f));
        if (description && !isRichTextEmpty(description)) {
          fd.set("descriptionRich", JSON.stringify(description));
          fd.set("description", extractPlainText(description).slice(0, LIMITS.bodyMax));
        }
        if (/^\d{4}$/.test(mag) && nr) rememberWarehouse(mag);
        action(fd);
      }}
      onSubmit={(e) => {
        setTried(true);
        if (Object.keys(localErrors).length > 0) e.preventDefault();
      }}
      className={cn("flex min-h-0 flex-1 flex-col", layout === "page" && "pb-24")}
    >
      <div
        className={cn(
          "flex flex-col gap-6",
          layout === "dialog" ? "min-h-0 flex-1 overflow-y-auto px-6 py-5" : "px-4 py-5"
        )}
      >
        {branches.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-branch">{t("branch")}</Label>
            <input type="hidden" name="branchId" value={branchId} />
            <Select value={branchId} onValueChange={setBranchId}>
              <SelectTrigger
                id="nr-branch"
                className="h-10 justify-start gap-2 [&>svg:last-child]:ml-auto"
              >
                <Building2 className="h-4 w-4 shrink-0 text-muted-foreground" />
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {branches.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
        ) : (
          <input type="hidden" name="branchId" value={branchId} />
        )}

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("type")} <span className="text-destructive">*</span>
          </legend>
          {types.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t("noTypes")}
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-invalid={errors.typeId || undefined}
              className="flex flex-wrap gap-2"
            >
              {types.map((x) => {
                const on = x.id === typeId;
                return (
                  <label
                    key={x.id}
                    className={cn(
                      "relative flex h-10 cursor-pointer items-center gap-2 rounded-md border bg-background px-3 text-sm transition-colors hover:bg-accent/50 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
                      on && "border-primary bg-primary/10 ring-1 ring-primary hover:bg-primary/10",
                      errors.typeId && !on && "border-destructive/60"
                    )}
                  >
                    <input
                      type="radio"
                      name="typeId"
                      value={x.id}
                      checked={on}
                      onChange={() => setTypeId(x.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="h-2 w-2 shrink-0 rounded-full"
                      style={{ background: x.color }}
                    />
                    <span className="font-medium">{x.name}</span>
                    {x.requiresAcceptance && (
                      <ShieldCheck
                        className="h-3.5 w-3.5 text-violet-600 dark:text-violet-400"
                        aria-label={t("acceptance")}
                      />
                    )}
                  </label>
                );
              })}
            </div>
          )}
          {err("typeId")}
          {type && (
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-[13px] text-muted-foreground">
              {type.description && <p className="w-full">{type.description}</p>}
              {type.responders.length > 0 ? (
                <>
                  <span>{t("solvedBy")}</span>
                  <AvatarStack people={type.responders} size={22} />
                  <span className="text-foreground">
                    {type.responders.map((p) => p.name).join(", ")}
                  </span>
                </>
              ) : (
                <span>{t("toQueue")}</span>
              )}
              {type.requiresAcceptance && type.acceptors.length > 0 && (
                <span className="inline-flex items-center gap-1 text-violet-700 dark:text-violet-300">
                  <ShieldCheck className="h-3.5 w-3.5" />
                  {t("acceptedBy", { names: type.acceptors.map((p) => p.name).join(", ") })}
                </span>
              )}
            </div>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label htmlFor="nr-title">
            {t("title")} <span className="text-destructive">*</span>
          </Label>
          <Input
            id="nr-title"
            name="title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            maxLength={LIMITS.titleMax}
            placeholder={t("titlePlaceholder")}
            aria-invalid={errors.title || undefined}
            className={cn("h-10", errors.title && "border-destructive")}
          />
          {err("title")}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium">
            {t("order")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
          </legend>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,9rem)] gap-3">
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nr-order" className="text-xs font-normal text-muted-foreground">
                {t("orderNumber")}
              </Label>
              <Input
                id="nr-order"
                name="orderNumber"
                inputMode="numeric"
                autoComplete="off"
                value={nr}
                onChange={(e) => setNr(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="51481"
                aria-invalid={errors.orderNumber || undefined}
                className={cn("h-10 font-mono", errors.orderNumber && "border-destructive")}
              />
            </div>
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="nr-mag" className="text-xs font-normal text-muted-foreground">
                {t("warehouse")}
              </Label>
              <Input
                id="nr-mag"
                name="warehouse"
                inputMode="numeric"
                autoComplete="off"
                value={mag}
                onChange={(e) => setMag(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="3112"
                aria-invalid={errors.warehouse || undefined}
                className={cn("h-10 font-mono", errors.warehouse && "border-destructive")}
              />
            </div>
          </div>
          {shortcuts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-[13px] text-muted-foreground">
              <span>{branchWarehouses.length ? t("branchWarehouses") : t("recent")}</span>
              {shortcuts.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => setMag(w.code)}
                  aria-pressed={mag === w.code}
                  className={cn(
                    "h-7 rounded-full border px-2.5 text-xs text-foreground transition-colors hover:bg-accent/60",
                    mag === w.code && "border-primary bg-primary/10 hover:bg-primary/10"
                  )}
                >
                  <span className="font-mono">{w.code}</span>
                  {w.name ? <span className="ml-1">{w.name}</span> : null}
                </button>
              ))}
            </div>
          )}
          {err("orderNumber") ?? err("warehouse")}
          {looking && (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("looking")}
            </p>
          )}
          {!looking && lookup?.found && (
            <div className="flex items-center gap-2.5 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-[13px] text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              <CircleCheck className="h-4 w-4 shrink-0" />
              <span>
                {t("found")}: <b className="font-mono font-semibold">{lookup.order.zlNumber}</b>
                {lookup.order.branchName ? ` · ${lookup.order.branchName}` : ""}
              </span>
            </div>
          )}
          {!looking && lookup && !lookup.found && (
            <p className="flex items-center gap-2 text-[13px] text-muted-foreground">
              <SearchX className="h-3.5 w-3.5" />
              {t("notFound")}
            </p>
          )}
        </fieldset>

        <div className="flex flex-col gap-2">
          <Label>{t("description")}</Label>
          <RichTextEditorField
            value={description}
            onChange={setDescription}
            placeholder={t("descriptionPlaceholder")}
            maxLength={LIMITS.bodyMax}
            mode="simple"
            contentClassName="min-h-[110px]"
            toolbarLabels={{
              bold: tb("bold"),
              italic: tb("italic"),
              underline: tb("underline"),
              strikethrough: tb("strikethrough"),
              bulletList: tb("bulletList"),
              orderedList: tb("orderedList"),
              link: tb("link"),
              linkPrompt: tb("linkPrompt"),
            }}
          />
        </div>

        <div className="flex flex-col gap-2">
          <span className="text-sm font-medium">{t("attachments")}</span>
          {files.length > 0 && (
            <ul className="divide-y rounded-md border">
              {files.map((f, i) => (
                <FileRow
                  key={`${f.name}-${i}`}
                  file={f}
                  size={formatBytes(f.size, locale)}
                  removeLabel={t("removeFile", { name: f.name })}
                  onRemove={() => setFiles((all) => all.filter((_, j) => j !== i))}
                />
              ))}
            </ul>
          )}
          <div className="grid grid-cols-2 gap-3">
            <Button type="button" variant="outline" onClick={() => cameraRef.current?.click()}>
              <Camera className="h-4 w-4" />
              {t("photo")}
            </Button>
            <Button type="button" variant="outline" onClick={() => fileRef.current?.click()}>
              <Paperclip className="h-4 w-4" />
              {t("file")}
            </Button>
          </div>
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
          <input
            ref={fileRef}
            type="file"
            accept="image/*,application/pdf"
            multiple
            className="hidden"
            onChange={(e) => {
              addFiles(e.target.files);
              e.target.value = "";
            }}
          />
        </div>

        {state?.error && (
          <p
            role="alert"
            className="rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
          >
            {t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.generic")}
          </p>
        )}
      </div>

      <div
        className={cn(
          "flex items-center justify-end gap-2 border-t bg-background",
          layout === "dialog"
            ? "px-6 py-4"
            : "fixed inset-x-0 bottom-0 z-20 px-4 pb-[max(1rem,env(safe-area-inset-bottom))] pt-3 [&>*]:flex-1"
        )}
      >
        <Button type="button" variant="outline" onClick={onCancel} disabled={pending}>
          {t("cancel")}
        </Button>
        <Button type="submit" disabled={pending || types.length === 0}>
          {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
          {pending ? t("sending") : t("submit")}
        </Button>
      </div>
    </form>
  );
}

function FileRow({
  file,
  size,
  removeLabel,
  onRemove,
}: {
  file: File;
  size: string;
  removeLabel: string;
  onRemove: () => void;
}) {
  const [preview, setPreview] = useState<string | null>(null);
  useEffect(() => {
    if (!file.type.startsWith("image/")) return;
    const url = URL.createObjectURL(file);
    setPreview(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);
  return (
    <li className="flex items-center gap-3 px-3 py-2.5">
      {preview ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={preview} alt="" className="h-10 w-10 shrink-0 rounded-md object-cover" />
      ) : (
        <span className="flex h-10 w-10 shrink-0 items-center justify-center rounded-md bg-muted">
          <FileText className="h-4 w-4 text-muted-foreground" />
        </span>
      )}
      <span className="flex min-w-0 flex-1 flex-col">
        <span className="truncate text-sm font-medium">{file.name}</span>
        <span className="text-xs text-muted-foreground">{size}</span>
      </span>
      <Button type="button" variant="ghost" size="icon" aria-label={removeLabel} onClick={onRemove}>
        <X className="h-4 w-4" />
      </Button>
    </li>
  );
}
