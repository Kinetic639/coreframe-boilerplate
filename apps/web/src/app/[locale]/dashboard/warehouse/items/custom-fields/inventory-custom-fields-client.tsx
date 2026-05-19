"use client";

import { useState, useTransition } from "react";
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
  title = "Custom fields",
  description = "Manage typed product and variant fields used by item creation, edit, list columns, and filters.",
  backHref = "/dashboard/warehouse/items",
  backLabel = "Products",
  framed = true,
}: {
  initialFields: InventoryCustomFieldDefinition[];
  title?: string;
  description?: string;
  backHref?: "/dashboard/warehouse/items" | "/dashboard/warehouse/settings";
  backLabel?: string;
  framed?: boolean;
}) {
  const router = useRouter();
  const [fields, setFields] = useState(initialFields);
  const [draft, setDraft] = useState<Draft>(emptyDraft);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const save = () => {
    const name = draft.name.trim();
    if (!name) {
      setMessage("Field name is required.");
      return;
    }
    if (
      (draft.field_type === "select" || draft.field_type === "multi_select") &&
      draft.options.length === 0
    ) {
      setMessage("Select fields need at least one option.");
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
          setMessage("error" in result ? result.error : "Could not update field.");
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
        setMessage("Custom field updated.");
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
        setMessage("error" in result ? result.error : "Could not create field.");
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
          section_name: "Custom fields",
          help_text: null,
          placeholder: null,
        },
      ]);
      setDraft(emptyDraft);
      setMessage("Custom field created.");
      router.refresh();
    });
  };

  const archive = (field: InventoryCustomFieldDefinition) => {
    startTransition(async () => {
      const result = await archiveInventoryCustomFieldAction({ id: field.id });
      if (!result.success) {
        setMessage("error" in result ? result.error : "Could not archive field.");
        return;
      }
      setFields((current) => current.filter((item) => item.id !== field.id));
      if (draft.id === field.id) setDraft(emptyDraft);
      setMessage("Custom field archived.");
      router.refresh();
    });
  };

  return (
    <div className={framed ? "mx-auto grid w-full max-w-7xl gap-6 px-6 py-6" : "grid gap-6"}>
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold">{title}</h1>
          <p className="text-sm text-muted-foreground">{description}</p>
        </div>
        <Button asChild variant="outline">
          <Link href={backHref}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            {backLabel}
          </Link>
        </Button>
      </div>

      {message ? (
        <p className="rounded-md border bg-muted/30 px-3 py-2 text-sm">{message}</p>
      ) : null}

      <section className="grid gap-4 rounded-md border border-border p-4">
        <div className="flex items-center justify-between gap-3">
          <h2 className="text-lg font-medium">{draft.id ? "Edit field" : "New field"}</h2>
          {draft.id ? (
            <Button type="button" variant="ghost" size="sm" onClick={() => setDraft(emptyDraft)}>
              New field
            </Button>
          ) : null}
        </div>
        <div className="grid gap-3 lg:grid-cols-[1fr_180px_180px]">
          <Input
            value={draft.name}
            placeholder="Field name"
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
            <option value="product">Product</option>
            <option value="variant">Variant</option>
            <option value="lot">Lot</option>
            <option value="serial">Serial</option>
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
            <option value="text">Text</option>
            <option value="number">Number</option>
            <option value="date">Date</option>
            <option value="boolean">Checkbox</option>
            <option value="select">Single select</option>
            <option value="multi_select">Multi select</option>
          </select>
        </div>
        {draft.field_type === "select" || draft.field_type === "multi_select" ? (
          <TokenInput
            value={draft.options}
            onChange={(options) => setDraft((current) => ({ ...current, options }))}
            placeholder="Type option and press Enter"
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
              Required
            </label>
            <label className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={draft.is_filterable}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, is_filterable: event.target.checked }))
                }
              />
              Filterable
            </label>
          </div>
          <Button type="button" onClick={save} disabled={isPending}>
            {draft.id ? <Save className="mr-2 h-4 w-4" /> : <Plus className="mr-2 h-4 w-4" />}
            {draft.id ? "Save field" : "Create field"}
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-md border border-border">
        <div className="grid grid-cols-[1fr_120px_140px_100px_100px_110px] bg-muted/40 px-3 py-2 text-xs font-semibold uppercase text-muted-foreground">
          <span>Name</span>
          <span>Entity</span>
          <span>Type</span>
          <span>Required</span>
          <span>Filterable</span>
          <span className="text-right">Actions</span>
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
            <span className="text-muted-foreground">{field.entity_type}</span>
            <span className="text-muted-foreground">{field.field_type.replace("_", " ")}</span>
            <span>{field.is_required ? "Yes" : "No"}</span>
            <span>{field.is_filterable ? "Yes" : "No"}</span>
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
                Edit
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="h-8 w-8 text-destructive hover:text-destructive"
                onClick={() => archive(field)}
                aria-label={`Archive ${field.name}`}
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
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
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
            aria-label={`Remove ${token}`}
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
