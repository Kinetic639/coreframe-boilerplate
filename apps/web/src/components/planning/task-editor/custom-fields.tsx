"use client";

import { useEffect, useState } from "react";
import { useFormatter, useTranslations } from "next-intl";
import { SlidersHorizontal } from "lucide-react";
import { toast } from "react-toastify";
import { setKanbanCustomFieldValueAction } from "@/app/actions/kanban";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  KanbanBoardCard,
  KanbanCustomField,
  KanbanCustomFieldValue,
} from "@/lib/types/kanban";
import { unwrapTaskResult as unwrap } from "./task-editor-queries";

type Formatter = ReturnType<typeof useFormatter>;

/** A value as the card shows it, or null when there is nothing to show. */
export function formatCustomFieldValue(
  field: KanbanCustomField,
  value: KanbanCustomFieldValue | undefined,
  format: Formatter,
  yes: string
): string | null {
  if (value === undefined || value === null || value === "") return null;
  switch (field.field_type) {
    case "number":
      return typeof value === "number" ? format.number(value) : String(value);
    case "date": {
      const [y, m, d] = String(value).split("-").map(Number);
      if (!y || !m || !d) return String(value);
      return format.dateTime(new Date(Date.UTC(y, m - 1, d)), {
        dateStyle: "medium",
        timeZone: "UTC",
      });
    }
    case "checkbox":
      return value === true ? yes : null;
    case "select":
      return field.options.find((option) => option.id === value)?.name ?? null;
    default:
      return String(value);
  }
}

const NONE = "__none__";

/** The card's values for its board's custom fields; each saves on its own. */
export function CustomFieldsSection({
  card,
  fields,
  disabled,
  onCardChange,
}: {
  card: KanbanBoardCard;
  fields: KanbanCustomField[];
  disabled: boolean;
  onCardChange: (card: KanbanBoardCard) => void;
}) {
  const t = useTranslations("modules.planning.boardExtras.fields");
  if (!fields.length) return null;

  const save = async (field: KanbanCustomField, value: KanbanCustomFieldValue | null) => {
    const current = card.custom_values?.[field.id] ?? null;
    if (current === value) return;
    const values = { ...(card.custom_values ?? {}) };
    if (value === null || value === "") delete values[field.id];
    else values[field.id] = value;
    onCardChange({ ...card, custom_values: values });
    try {
      const saved = await unwrap(
        setKanbanCustomFieldValueAction({ task_id: card.id, field_id: field.id, value })
      );
      onCardChange(saved);
    } catch (error) {
      onCardChange(card);
      toast.error(error instanceof Error ? error.message : "Operation failed");
    }
  };

  return (
    <section className="space-y-2">
      <h3 className="flex items-center gap-1.5 text-sm font-semibold">
        <SlidersHorizontal className="h-4 w-4 text-muted-foreground" />
        {t("title")}
      </h3>
      <div className="grid gap-x-4 gap-y-3 sm:grid-cols-2">
        {fields.map((field) => (
          <div key={field.id} className="min-w-0 space-y-1">
            <label
              htmlFor={`custom-field-${field.id}`}
              className="block truncate text-xs font-medium text-muted-foreground"
            >
              {field.name}
            </label>
            <FieldInput
              id={`custom-field-${field.id}`}
              field={field}
              value={card.custom_values?.[field.id]}
              disabled={disabled}
              noneLabel={t("none")}
              onSave={(value) => void save(field, value)}
            />
          </div>
        ))}
      </div>
    </section>
  );
}

function FieldInput({
  id,
  field,
  value,
  disabled,
  noneLabel,
  onSave,
}: {
  id: string;
  field: KanbanCustomField;
  value: KanbanCustomFieldValue | undefined;
  disabled: boolean;
  noneLabel: string;
  onSave: (value: KanbanCustomFieldValue | null) => void;
}) {
  const shown = value === undefined || value === null ? "" : String(value);
  const [draft, setDraft] = useState(shown);
  // A value saved elsewhere (another person, Realtime) shows when not typing.
  useEffect(() => setDraft(shown), [shown]);

  if (field.field_type === "checkbox") {
    return (
      <div className="flex h-8 items-center">
        <Checkbox
          id={id}
          checked={value === true}
          disabled={disabled}
          onCheckedChange={(checked) => onSave(checked === true ? true : null)}
        />
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <Select
        value={typeof value === "string" && value ? value : NONE}
        disabled={disabled}
        onValueChange={(next) => onSave(next === NONE ? null : next)}
      >
        <SelectTrigger id={id} className="h-8">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={NONE}>{noneLabel}</SelectItem>
          {field.options.map((option) => (
            <SelectItem key={option.id} value={option.id}>
              <span className="flex items-center gap-2">
                <span
                  className="h-2.5 w-2.5 rounded-full"
                  style={{ backgroundColor: option.color }}
                  aria-hidden="true"
                />
                {option.name}
              </span>
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    );
  }

  const commit = () => {
    const text = draft.trim();
    if (text === shown) return;
    if (!text) return onSave(null);
    if (field.field_type === "number") {
      const number = Number(text.replace(",", "."));
      if (!Number.isFinite(number)) {
        setDraft(shown);
        return;
      }
      return onSave(number);
    }
    onSave(text);
  };

  return (
    <Input
      id={id}
      className="h-8"
      type={field.field_type === "date" ? "date" : "text"}
      inputMode={field.field_type === "number" ? "decimal" : undefined}
      maxLength={field.field_type === "text" ? 2000 : undefined}
      value={draft}
      disabled={disabled}
      onChange={(event) => {
        setDraft(event.target.value);
        if (field.field_type === "date") {
          const next = event.target.value;
          if (next !== shown) onSave(next || null);
        }
      }}
      onBlur={field.field_type === "date" ? undefined : commit}
      onKeyDown={(event) => {
        if (event.key === "Enter") {
          event.preventDefault();
          commit();
        }
        if (event.key === "Escape") {
          event.stopPropagation();
          setDraft(shown);
        }
      }}
    />
  );
}
