"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { ArrowLeft, Plus, Save, Trash2, X } from "lucide-react";
import { Link, useRouter } from "@/i18n/navigation";
import {
  archiveInventoryCustomFieldAction,
  createInventoryCustomFieldAction,
  updateInventoryCustomFieldAction,
} from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { InventoryCustomFieldDefinition } from "@/lib/warehouse/inventory-types";

type Draft = {
  id: string | null;
  entity_type: "product" | "variant" | "lot" | "serial";
  name: string;
  field_type: InventoryCustomFieldDefinition["field_type"];
  is_required: boolean;
  is_filterable: boolean;
  options: string[];
};

const emptyDraft: Draft = {
  id: null,
  entity_type: "product",
  name: "",
  field_type: "text",
  is_required: false,
  is_filterable: true,
  options: [],
};

const selectClass =
  "h-9 rounded-md border border-input bg-background px-3 pr-9 text-sm text-foreground shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

function fieldKeyFromName(name: string) {
  const key = name
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return key || `field_${Date.now()}`;
}

export function InventoryCustomFieldsClient({
  initialFields,
  title,
  description,
  backHref = "/dashboard/warehouse/items",
  backLabel,
  framed = true,
}: {
  initialFields: InventoryCustomFieldDefinition[];
  title?: string;
  description?: string;
  backHref?: "/dashboard/warehouse/items" | "/dashboard/warehouse/settings";
  backLabel?: string;
  framed?: boolean;
}) {
  const t = useTranslations("warehouseInventory.customFields");
  const tc = useTranslations("warehouseInventory.common");
  const tFieldTypes = useTranslations("warehouseInventory.fieldTypes");
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setMessage(t("fieldNameRequired"));
      return;
    }
    if (
      (draft.field_type === "select" || draft.field_type === "multi_select") &&
      draft.options.length === 0
    ) {
      setMessage(t("selectNeedsOption"));
      return;
    }

    startTransition(async () => {
      setMessage(null);
      if (draft.id) {
        const result = await updateInventoryCustomFieldAction({
          id: draft.id,
          name,
          is_required: draft.is_required,
          is_filterable: draft.is_filterable,
          options:
            draft.field_type === "select" || draft.field_type === "multi_select"
              ? draft.options
              : [],
          display_order: fields.find((field) => field.id === draft.id)?.display_order ?? 0,
        });
        if (!result.success) {
          setMessage("error" in result ? result.error : t("updateFailed"));
          return;
        }
        setFields((current) =>
          current.map((field) =>
            field.id === draft.id
              ? {
                  ...field,
                  name,
                  is_required: draft.is_required,
                  is_filterable: draft.is_filterable,
                  options:
                    draft.field_type === "select" || draft.field_type === "multi_select"
                      ? draft.options
                      : [],
                }
              : field
          )
        );
        setDraft(emptyDraft);
        setMessage(t("updated"));
        router.refresh();
        return;
      }

      const result = await createInventoryCustomFieldAction({
        entity_type: draft.entity_type,
        name,
        field_key: fieldKeyFromName(name),
        field_type: draft.field_type,
        is_required: draft.is_required,
        is_filterable: draft.is_filterable,
        options:
          draft.field_type === "select" || draft.field_type === "multi_select" ? draft.options : [],
        display_order: fields.length + 1,
      });
      if (!result.success || !("data" in result)) {
        setMessage("error" in result ? result.error : t("createFailed"));
        return;
      }
      setFields((current) => [
        ...current,
        {
          id: result.data.id,
          entity_type: draft.entity_type,
          name,
          field_key: fieldKeyFromName(name),
          field_type: draft.field_type,
          is_required: draft.is_required,
          is_filterable: draft.is_filterable,
          options:
            draft.field_type === "select" || draft.field_type === "multi_select"
              ? draft.options
              : [],
          display_order: fields.length + 1,
          section_name: t("title"),
          help_text: null,
          placeholder: null,
        },
      ]);
      setDraft(emptyDraft);
      setMessage(t("created"));
      router.refresh();
    });
  };

  const archive = (field: InventoryCustomFieldDefinition) => {
    startTransition(async () => {
      const result = await archiveInventoryCustomFieldAction({ id: field.id });
      if (!result.success) {
        setMessage("error" in result ? result.error : t("archiveFailed"));
        return;
      }
      setFields((current) => current.filter((item) => item.id !== field.id));
      if (draft.id === field.id) setDraft(emptyDraft);
      setMessage(t("archived"));
      router.refresh();
    });
  };

  return (
    <div className={framed ? "mx-auto grid w-full max-w-7xl gap-6 px-6 py-6" : "grid gap-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title ?? t("title")}</h1>
          <p className="text-sm text-muted-foreground">{description ?? t("description")}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel ?? t("products")}
          </Link>
        </Button>
      </div>

      {message ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{draft.id ? t("editField") : t("newField")}</h2>
          {draft.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(emptyDraft)}>
              {t("newField")}
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <Input
            value={draft.name}
            placeholder={t("fieldName")}
            className="h-9"
            onChange={(event) => setDraft((current) => ({ ...current, name: event.target.value }))}
          />
          <select
            value={draft.entity_type}
            disabled={!!draft.id}
            className={selectClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                entity_type: event.target.value as Draft["entity_type"],
              }))
            }
          >
            <option value="product">{tFieldTypes("product")}</option>
            <option value="variant">{tFieldTypes("variant")}</option>
            <option value="lot">{tFieldTypes("lot")}</option>
            <option value="serial">{tFieldTypes("serial")}</option>
          </select>
          <select
            value={draft.field_type}
            disabled={!!draft.id}
            className={selectClass}
            onChange={(event) =>
              setDraft((current) => ({
                ...current,
                field_type: event.target.value as Draft["field_type"],
                options:
                  event.target.value === "select" || event.target.value === "multi_select"
                    ? current.options
                    : [],
              }))
            }
          >
            <option value="text">{tFieldTypes("text")}</option>
            <option value="number">{tFieldTypes("number")}</option>
            <option value="date">{tFieldTypes("date")}</option>
            <option value="boolean">{tFieldTypes("boolean")}</option>
            <option value="select">{tFieldTypes("select")}</option>
            <option value="multi_select">{tFieldTypes("multi_select")}</option>
          </select>
        </div>
        {draft.field_type === "select" || draft.field_type === "multi_select" ? (
          <TokenInput
            value={draft.options}
            onChange={(options) => setDraft((current) => ({ ...current, options }))}
            placeholder={t("optionsPlaceholder")}
            removeLabel={(name) => t("removeOption", { name })}
          />
        ) : null}
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex gap-5 text-sm">
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_required}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, is_required: event.target.checked }))
                }
              />
              {t("required")}
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_filterable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, is_filterable: event.target.checked }))
                }
              />
              {t("filterable")}
            </label>
          </div>
          <Button type="button" onClick={save} disabled={isPending}>
            {draft.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {draft.id ? t("saveField") : t("createField")}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[1fr_120px_140px_100px_100px_110px] bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>{t("name")}</span>
          <span>{t("entity")}</span>
          <span>{t("type")}</span>
          <span>{t("required")}</span>
          <span>{t("filterable")}</span>
          <span className="text-right">{t("actions")}</span>
        </div>
        {fields.map((field) => (
          <div
            key={field.id}
            className="grid grid-cols-[1fr_120px_140px_100px_100px_110px] items-center gap-3 border-t border-border px-3 py-2 text-sm"
          >
            <div className="min-w-0">
              <p className="truncate font-medium">{field.name}</p>
              {field.options.length > 0 ? (
                <p className="truncate text-xs text-muted-foreground">{field.options.join(", ")}</p>
              ) : null}
            </div>
            <span className="text-muted-foreground">{tFieldTypes(field.entity_type)}</span>
            <span className="text-muted-foreground">{tFieldTypes(field.field_type)}</span>
            <span>{field.is_required ? tc("yes") : tc("no")}</span>
            <span>{field.is_filterable ? tc("yes") : tc("no")}</span>
            <div className="flex justify-end gap-1">
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() =>
                  setDraft({
                    id: field.id,
                    entity_type: field.entity_type,
                    name: field.name,
                    field_type: field.field_type,
                    is_required: field.is_required,
                    is_filterable: field.is_filterable ?? false,
                    options: field.options,
                  })
                }
              >
                {tc("edit")}
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => archive(field)}
                aria-label={t("archive", { name: field.name })}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}

function TokenInput({
  value,
  onChange,
  placeholder,
  removeLabel,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  removeLabel: (name: string) => string;
}) {
  const [draft, setDraft] = useState("");
  const add = () => {
    const text = draft.trim();
    if (!text) return;
    if (!value.some((item) => item.toLowerCase() === text.toLowerCase())) {
      onChange([...value, text]);
    }
    setDraft("");
  };

  return (
    <div className="flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm shadow-sm focus-within:ring-2 focus-within:ring-ring">
      {value.map((token) => (
        <span
          key={token}
          className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs"
        >
          {token}
          <button
            type="button"
            className="text-muted-foreground hover:text-destructive"
            onClick={() => onChange(value.filter((item) => item !== token))}
            aria-label={removeLabel(token)}
          >
            <X className="h-3 w-3" />
          </button>
        </span>
      ))}
      <input
        value={draft}
        placeholder={value.length === 0 ? placeholder : ""}
        className="h-7 min-w-48 flex-1 bg-transparent outline-none placeholder:text-muted-foreground"
        onChange={(event) => setDraft(event.target.value)}
        onBlur={add}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === "Tab") {
            if (!draft.trim()) return;
            event.preventDefault();
            add();
          }
          if (event.key === "Backspace" && !draft && value.length > 0) onChange(value.slice(0, -1));
        }}
      />
    </div>
  );
}
