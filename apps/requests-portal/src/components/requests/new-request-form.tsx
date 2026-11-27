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
import { Avatar } from "./avatar";

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

  const choiceClass = (selected: boolean) =>
    cn(
      "inline-flex h-9 max-w-full shrink-0 cursor-pointer items-center justify-center gap-1.5 rounded-md border px-3 text-sm transition-colors has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-ring",
      selected
        ? "border-primary bg-primary/10 font-medium text-foreground"
        : "border-input bg-transparent text-foreground hover:bg-accent hover:text-accent-foreground"
    );
  const isDialog = layout === "dialog";

  // As the ERP's new ticket: the request on the left, where it goes and who handles it on
  // the right; one column on a phone.
  const columns = (
    <div
      className={cn(
        "flex flex-col gap-5",
        isDialog
          ? "md:grid md:grid-cols-[minmax(0,1fr)_18rem] md:gap-6"
          : "lg:grid lg:grid-cols-[minmax(0,1fr)_20rem] lg:gap-8"
      )}
    >
      <div className="flex min-w-0 flex-col gap-5">
        <div className="flex flex-col gap-1.5">
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
            disabled={pending}
            aria-invalid={errors.title || undefined}
            className={cn(
              "h-11 text-base sm:h-10 sm:text-sm",
              errors.title && "border-destructive"
            )}
          />
          {err("title")}
        </div>

        <div className="flex flex-col gap-1.5">
          <Label>{t("description")}</Label>
          <div className="rounded-md border border-input">
            <RichTextEditorField
              value={description}
              onChange={setDescription}
              placeholder={t("descriptionPlaceholder")}
              maxLength={LIMITS.bodyMax}
              mode="simple"
              disabled={pending}
              contentClassName="min-h-[140px]"
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
        </div>

        <div className="flex flex-col gap-2">
          <Label>{t("attachments")}</Label>
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
          <div className="grid grid-cols-2 gap-2">
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={pending}
              onClick={() => cameraRef.current?.click()}
            >
              <Camera className="h-4 w-4" />
              {t("photo")}
            </Button>
            <Button
              type="button"
              variant="outline"
              className="h-11 sm:h-9"
              disabled={pending}
              onClick={() => fileRef.current?.click()}
            >
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
      </div>

      <div
        className={cn(
          "flex min-w-0 flex-col gap-5",
          isDialog ? "md:border-l md:pl-6" : "lg:border-l lg:pl-8"
        )}
      >
        {branches.length > 1 ? (
          <div className="flex flex-col gap-2">
            <Label htmlFor="nr-branch">{t("branch")}</Label>
            <input type="hidden" name="branchId" value={branchId} />
            <Select value={branchId} onValueChange={setBranchId} disabled={pending}>
              <SelectTrigger
                id="nr-branch"
                className="h-11 justify-start gap-2 sm:h-10 [&>svg:last-child]:ml-auto"
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

        <div className="flex flex-col gap-2">
          <Label id="nr-type-label">
            {t("type")} <span className="text-destructive">*</span>
          </Label>
          {types.length === 0 ? (
            <p className="rounded-md border border-dashed p-4 text-sm text-muted-foreground">
              {t("noTypes")}
            </p>
          ) : (
            <div
              role="radiogroup"
              aria-labelledby="nr-type-label"
              aria-invalid={errors.typeId || undefined}
              className="flex flex-wrap gap-2"
            >
              {types.map((x) => {
                const on = x.id === typeId;
                return (
                  <label
                    key={x.id}
                    className={cn(choiceClass(on), errors.typeId && !on && "border-destructive/60")}
                  >
                    <input
                      type="radio"
                      name="typeId"
                      value={x.id}
                      checked={on}
                      disabled={pending}
                      onChange={() => setTypeId(x.id)}
                      className="sr-only"
                    />
                    <span
                      aria-hidden
                      className="h-2.5 w-2.5 shrink-0 rounded-full"
                      style={{ background: x.color }}
                    />
                    <span className="truncate">{x.name}</span>
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
          {type?.description ? (
            <p className="text-xs text-muted-foreground">{type.description}</p>
          ) : null}
        </div>

        {/* Who handles it follows from the type (set in the ERP), as read-only fields. */}
        <div className="flex flex-col gap-2">
          <Label>{t("responders")}</Label>
          <div className="flex min-h-10 flex-wrap items-center gap-2 rounded-md border border-input bg-muted/40 px-3 py-1.5 text-sm">
            {!type ? (
              <span className="text-muted-foreground">{t("respondersPick")}</span>
            ) : type.responders.length > 0 ? (
              type.responders.map((p) => (
                <span
                  key={p.id}
                  className="inline-flex h-7 items-center gap-1.5 rounded-full border bg-background pl-0.5 pr-2.5 text-xs"
                >
                  <Avatar person={p} size={22} />
                  {p.name}
                </span>
              ))
            ) : (
              <span className="text-muted-foreground">{t("toQueue")}</span>
            )}
          </div>
          {type?.requiresAcceptance && type.acceptors.length > 0 ? (
            <p className="inline-flex items-center gap-1.5 text-xs text-violet-700 dark:text-violet-300">
              <ShieldCheck className="h-3.5 w-3.5 shrink-0" />
              {t("acceptedBy", { names: type.acceptors.map((p) => p.name).join(", ") })}
            </p>
          ) : null}
        </div>

        <fieldset className="flex flex-col gap-2">
          <legend className="mb-2 text-sm font-medium leading-none">
            {t("order")} <span className="font-normal text-muted-foreground">{t("optional")}</span>
          </legend>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,6.5rem)] gap-2">
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
                disabled={pending}
                onChange={(e) => setNr(e.target.value.replace(/\D/g, "").slice(0, 8))}
                placeholder="51481"
                aria-invalid={errors.orderNumber || undefined}
                className={cn("h-11 font-mono sm:h-10", errors.orderNumber && "border-destructive")}
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
                disabled={pending}
                onChange={(e) => setMag(e.target.value.replace(/\D/g, "").slice(0, 4))}
                placeholder="3112"
                aria-invalid={errors.warehouse || undefined}
                className={cn("h-11 font-mono sm:h-10", errors.warehouse && "border-destructive")}
              />
            </div>
          </div>
          {shortcuts.length > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground">
              <span>{branchWarehouses.length ? t("branchWarehouses") : t("recent")}</span>
              {shortcuts.map((w) => (
                <button
                  key={w.code}
                  type="button"
                  onClick={() => setMag(w.code)}
                  aria-pressed={mag === w.code}
                  title={w.name ?? undefined}
                  className={cn(
                    "h-7 rounded-md border px-2 text-xs text-foreground transition-colors hover:bg-accent",
                    mag === w.code && "border-primary bg-primary/10 hover:bg-primary/10"
                  )}
                >
                  <span className="font-mono">{w.code}</span>
                </button>
              ))}
            </div>
          )}
          {err("orderNumber") ?? err("warehouse")}
          {looking && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
              {t("looking")}
            </p>
          )}
          {!looking && lookup?.found && (
            <div className="flex items-center gap-2 rounded-md border border-green-200 bg-green-50 px-3 py-2 text-xs text-green-800 dark:border-green-500/30 dark:bg-green-500/10 dark:text-green-300">
              <CircleCheck className="h-4 w-4 shrink-0" />
              <span className="min-w-0">
                {t("found")}: <b className="font-mono font-semibold">{lookup.order.zlNumber}</b>
                {lookup.order.branchName ? ` · ${lookup.order.branchName}` : ""}
              </span>
            </div>
          )}
          {!looking && lookup && !lookup.found && (
            <p className="flex items-center gap-2 text-xs text-muted-foreground">
              <SearchX className="h-3.5 w-3.5 shrink-0" />
              {t("notFound")}
            </p>
          )}
        </fieldset>
      </div>
    </div>
  );

  const failure = state?.error ? (
    <p
      role="alert"
      className="mt-5 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-sm text-destructive"
    >
      {t.has(`errors.${state.error}`) ? t(`errors.${state.error}`) : t("errors.generic")}
    </p>
  ) : null;

  const actionButtons = (
    <>
      <Button
        type="button"
        variant="outline"
        className="h-11 shrink-0 border-input bg-transparent font-normal shadow-none sm:h-10"
        onClick={onCancel}
        disabled={pending}
      >
        {t("cancel")}
      </Button>
      <Button
        type="submit"
        className="h-11 flex-1 sm:h-10 sm:flex-none"
        disabled={pending || types.length === 0}
      >
        {pending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
        {pending ? t("sending") : t("submit")}
      </Button>
    </>
  );

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
      className={cn("flex min-h-0 flex-1 flex-col", !isDialog && "w-full")}
    >
      {isDialog ? (
        <>
          {/* The fields scroll; the buttons stay at the bottom (a full screen on a phone). */}
          <div className="min-h-0 flex-1 overflow-y-auto px-4 py-4 sm:px-6">
            {columns}
            {failure}
          </div>
          <div className="flex shrink-0 gap-2 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 sm:justify-end sm:px-6 sm:pb-3">
            {actionButtons}
          </div>
        </>
      ) : (
        <>
          <div className="pb-24 lg:pb-4">
            {columns}
            {failure}
          </div>
          {/* On phones the buttons stay at the bottom of the screen. */}
          <div className="fixed inset-x-0 bottom-0 z-40 flex gap-2 border-t bg-background px-4 pb-[max(0.75rem,env(safe-area-inset-bottom))] pt-3 lg:static lg:z-auto lg:justify-end lg:border-t-0 lg:px-0 lg:pb-0">
            {actionButtons}
          </div>
        </>
      )}
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
