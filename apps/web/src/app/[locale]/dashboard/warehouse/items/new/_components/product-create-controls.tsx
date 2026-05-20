"use client";

import { useState, useTransition } from "react";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { Check, ChevronsUpDown, Copy, ImageIcon, Plus, X } from "lucide-react";
import { createInventoryCustomFieldAction } from "@/app/actions/warehouse/inventory";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Input } from "@/components/ui/input";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/utils";
import {
  fieldKeyFromName,
  type CustomFieldOption,
  type ProductImageDraft,
  type SkuSourceOption,
} from "./product-create-utils";
import { labelClass, requiredLabelClass, selectClass } from "./product-create-styles";

type MasterDataOption = {
  id: string;
  name: string;
};

export function SkuSourceCombobox({
  value,
  options,
  onChange,
}: {
  value: string;
  options: SkuSourceOption[];
  onChange: (value: string) => void;
}) {
  const t = useTranslations("warehouseInventory.create");
  const [open, setOpen] = useState(false);
  const selectedLabel =
    options.find((option) => option.value === value)?.label ??
    (value === "sequence" ? t("sequence") : t("selectField"));

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className={cn(
            "flex h-9 w-full items-center justify-between rounded-md border border-input bg-background pl-3 pr-4 text-left text-sm text-foreground shadow-sm outline-none",
            open && "ring-2 ring-ring ring-offset-2 ring-offset-background"
          )}
        >
          <span className="truncate">{selectedLabel}</span>
          <ChevronsUpDown className="ml-3 h-4 w-4 shrink-0 text-muted-foreground" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-[--radix-popover-trigger-width] p-0">
        <Command>
          <CommandInput placeholder={t("search")} />
          <CommandList>
            <CommandEmpty>{t("noAttributesFound")}</CommandEmpty>
            <CommandGroup>
              {options.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.label}
                  onSelect={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className="h-10"
                >
                  <span className="truncate">{option.label}</span>
                  <Check
                    className={cn(
                      "ml-auto h-4 w-4",
                      option.value === value ? "opacity-100" : "opacity-0"
                    )}
                  />
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

export function VariantImagePicker({
  gallery,
  selectedPreviews,
  onChange,
  onClear,
  onUpload,
}: {
  gallery: ProductImageDraft[];
  selectedPreviews: string[];
  onChange: (previews: string[]) => void;
  onClear: () => void;
  onUpload: (files: FileList | null) => void;
}) {
  const t = useTranslations("warehouseInventory.create");
  const [open, setOpen] = useState(false);
  const primaryPreview = gallery[0]?.preview ?? null;
  const displayPreview = selectedPreviews[0] ?? primaryPreview;
  const isInherited = selectedPreviews.length === 0 && Boolean(primaryPreview);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-md border border-border bg-muted/30"
          aria-label={t("chooseVariantImage")}
        >
          {displayPreview ? (
            <Image
              src={displayPreview}
              alt=""
              width={36}
              height={36}
              unoptimized
              className="h-full w-full rounded-md object-cover"
            />
          ) : (
            <ImageIcon className="h-4 w-4 text-muted-foreground" />
          )}
          {isInherited ? (
            <span className="absolute -right-1 -top-1 h-2.5 w-2.5 rounded-full border border-background bg-primary" />
          ) : null}
        </button>
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-3">
        <div className="grid gap-3">
          <div className="flex items-center justify-between gap-3">
            <p className="text-sm font-medium">{t("variantImages")}</p>
            {selectedPreviews.length > 0 ? (
              <button
                type="button"
                className="text-xs text-muted-foreground hover:text-destructive"
                onClick={onClear}
              >
                {t("useDefault")}
              </button>
            ) : null}
          </div>

          {gallery.length > 0 ? (
            <div className="grid grid-cols-5 gap-2">
              {gallery.map((image, index) => {
                const active = selectedPreviews.includes(image.preview);
                return (
                  <button
                    key={image.preview}
                    type="button"
                    className={cn(
                      "relative h-10 w-10 overflow-hidden rounded-md border border-border",
                      active && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    onClick={() =>
                      onChange(
                        active
                          ? selectedPreviews.filter((preview) => preview !== image.preview)
                          : [...selectedPreviews, image.preview]
                      )
                    }
                    aria-label={index === 0 ? t("useDefaultProductImage") : t("useGalleryImage")}
                  >
                    <Image
                      src={image.preview}
                      alt=""
                      width={40}
                      height={40}
                      unoptimized
                      className="h-full w-full object-cover"
                    />
                    {index === 0 ? (
                      <span className="absolute bottom-0 left-0 right-0 bg-background/80 text-[9px] leading-3 text-foreground">
                        {t("default")}
                      </span>
                    ) : null}
                    {active ? (
                      <span className="absolute right-0 top-0 grid h-4 w-4 place-items-center rounded-bl bg-primary text-[10px] text-primary-foreground">
                        {selectedPreviews.indexOf(image.preview) + 1}
                      </span>
                    ) : null}
                  </button>
                );
              })}
            </div>
          ) : (
            <p className="rounded-md border border-dashed border-border p-3 text-sm text-muted-foreground">
              {t("uploadProductImagesFirst")}
            </p>
          )}

          <label className="flex h-9 cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border text-sm text-muted-foreground hover:bg-muted/40">
            <Plus className="h-4 w-4" />
            {t("uploadToGallery")}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={(event) => onUpload(event.target.files)}
            />
          </label>
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Field({
  label,
  name,
  prefix,
  type = "text",
  placeholder,
  required,
  list,
}: {
  label: string;
  name: string;
  prefix?: string;
  type?: string;
  placeholder?: string;
  required?: boolean;
  list?: string;
}) {
  const t = useTranslations("warehouseInventory.create");
  return (
    <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
      <label className={required || label.endsWith("*") ? requiredLabelClass : labelClass}>
        {label}
      </label>
      <div className="flex">
        {prefix ? (
          <span className="flex h-9 items-center rounded-l-md border border-r-0 border-input bg-muted px-3 text-sm text-muted-foreground">
            {prefix}
          </span>
        ) : null}
        <Input
          name={name}
          type={type}
          list={list}
          placeholder={placeholder}
          required={required}
          className={cn("h-9", prefix ? "rounded-l-none" : "")}
          step={type === "number" ? "0.01" : undefined}
          min={type === "number" ? "0" : undefined}
        />
      </div>
    </div>
  );
}

export function MasterDataField({
  label,
  name,
  options,
  showQuickAdd,
  draft,
  onDraftChange,
  onToggleQuickAdd,
  onCreate,
}: {
  label: string;
  name: string;
  options: MasterDataOption[];
  showQuickAdd: boolean;
  draft: string;
  onDraftChange: (value: string) => void;
  onToggleQuickAdd: () => void;
  onCreate: () => void;
}) {
  const t = useTranslations("warehouseInventory.create");

  return (
    <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
      <label className="pt-2 text-sm text-foreground">{label}</label>
      <div className="grid gap-2">
        <div className="flex gap-2">
          <Input name={name} list={`${name}-options`} className="h-9" />
          <TooltipProvider delayDuration={150}>
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={onToggleQuickAdd}
                >
                  <Plus className="h-4 w-4" />
                </Button>
              </TooltipTrigger>
              <TooltipContent>{t("addNamed", { label: label.toLowerCase() })}</TooltipContent>
            </Tooltip>
          </TooltipProvider>
        </div>
        <datalist id={`${name}-options`}>
          {options.map((option) => (
            <option key={option.id} value={option.name} />
          ))}
        </datalist>
        {showQuickAdd ? (
          <div className="flex gap-2">
            <Input
              value={draft}
              placeholder={t("newNamed", { label: label.toLowerCase() })}
              className="h-9"
              onChange={(event) => onDraftChange(event.target.value)}
            />
            <Button type="button" variant="outline" size="sm" onClick={onCreate}>
              {t("add")}
            </Button>
          </div>
        ) : null}
      </div>
    </div>
  );
}

export function Cell({
  value,
  onChange,
  type = "text",
}: {
  value: string;
  onChange: (value: string) => void;
  type?: string;
}) {
  return (
    <td className="px-2 py-2">
      <Input
        value={value}
        type={type}
        min={type === "number" ? "0" : undefined}
        step={type === "number" ? "0.01" : undefined}
        onChange={(event) => onChange(event.target.value)}
        className="h-9"
      />
    </td>
  );
}

export function HeaderCopyAction({ label, onCopy }: { label: string; onCopy: () => void }) {
  const t = useTranslations("warehouseInventory.common");
  return (
    <div className="flex items-center gap-1.5 whitespace-nowrap">
      <span>{label}</span>
      <TooltipProvider delayDuration={150}>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className="h-6 w-6 rounded-sm text-muted-foreground hover:text-foreground"
              aria-label={t("copyColumnToAllRows", { label })}
              onClick={onCopy}
            >
              <Copy className="h-3.5 w-3.5" />
            </Button>
          </TooltipTrigger>
          <TooltipContent>{t("copyToAllRows")}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export function CustomFieldControl({
  field,
  tokens = [],
  onTokensChange,
}: {
  field: CustomFieldOption;
  tokens?: string[];
  onTokensChange?: (tokens: string[]) => void;
}) {
  const t = useTranslations("warehouseInventory.create");
  const name = `custom_field_${field.id}`;
  if (field.field_type === "boolean") {
    return (
      <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
        <span className={labelClass}>{field.name}</span>
        <div className="grid gap-1">
          <label className="flex items-center gap-2 text-sm">
            <input name={name} type="checkbox" required={field.is_required} />
            {t("yes")}
          </label>
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.field_type === "select") {
    return (
      <div className="grid items-center gap-3 md:grid-cols-[170px_1fr]">
        <label className={field.is_required ? requiredLabelClass : labelClass}>{field.name}</label>
        <div className="grid gap-1">
          <select name={name} required={field.is_required} className={cn(selectClass, "pr-9")}>
            <option value="">{t("select")}</option>
            {field.options.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  if (field.field_type === "multi_select") {
    return (
      <div className="grid items-start gap-3 md:grid-cols-[170px_1fr]">
        <label className={field.is_required ? requiredLabelClass : labelClass}>{field.name}</label>
        <div className="grid gap-1">
          <TokenInput
            value={tokens}
            onChange={onTokensChange ?? (() => undefined)}
            placeholder={field.placeholder ?? t("typeValueEnter")}
            suggestions={field.options}
          />
          {field.help_text ? (
            <p className="text-xs text-muted-foreground">{field.help_text}</p>
          ) : null}
        </div>
      </div>
    );
  }

  return (
    <Field
      label={field.is_required ? `${field.name}*` : field.name}
      name={name}
      type={
        field.field_type === "number" ? "number" : field.field_type === "date" ? "date" : "text"
      }
      placeholder={field.placeholder ?? undefined}
      required={field.is_required}
    />
  );
}

export function TokenCell({
  value,
  onChange,
}: {
  value: string[];
  onChange: (value: string[]) => void;
}) {
  const t = useTranslations("warehouseInventory.create");

  return (
    <td className="min-w-64 px-2 py-2 align-top">
      <TokenInput value={value} onChange={onChange} placeholder={t("enterValue")} compact />
    </td>
  );
}

export function TokenInput({
  value,
  onChange,
  placeholder,
  suggestions = [],
  compact = false,
}: {
  value: string[];
  onChange: (value: string[]) => void;
  placeholder?: string;
  suggestions?: string[];
  compact?: boolean;
}) {
  const [draft, setDraft] = useState("");
  const normalized = new Set(value.map((item) => item.toLowerCase()));
  const availableSuggestions = suggestions.filter(
    (suggestion) => suggestion.trim() && !normalized.has(suggestion.trim().toLowerCase())
  );

  const addTokens = (rawValue: string) => {
    const nextTokens = rawValue
      .split(/[,\n]/)
      .map((item) => item.trim())
      .filter(Boolean);
    if (nextTokens.length === 0) return;

    const next = [...value];
    const seen = new Set(next.map((item) => item.toLowerCase()));
    for (const token of nextTokens) {
      const key = token.toLowerCase();
      if (seen.has(key)) continue;
      next.push(token);
      seen.add(key);
    }
    onChange(next);
    setDraft("");
  };

  const removeToken = (token: string) => {
    onChange(value.filter((item) => item !== token));
  };

  return (
    <div className="space-y-2">
      <div
        className={cn(
          "flex min-h-9 flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1 text-sm text-foreground shadow-sm ring-offset-background focus-within:ring-2 focus-within:ring-ring focus-within:ring-offset-2",
          compact ? "min-w-56" : "w-full"
        )}
      >
        {value.map((token) => (
          <span
            key={token}
            className="inline-flex h-7 items-center gap-1 rounded-md bg-muted px-2 text-xs text-foreground"
          >
            {token}
            <button
              type="button"
              className="text-muted-foreground hover:text-foreground"
              onClick={() => removeToken(token)}
              aria-label={`Remove ${token}`}
            >
              <X className="h-3 w-3" />
            </button>
          </span>
        ))}
        <input
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" || event.key === "Tab") {
              if (!draft.trim()) return;
              event.preventDefault();
              addTokens(draft);
            }
            if (event.key === "Backspace" && !draft && value.length > 0) {
              removeToken(value[value.length - 1]);
            }
          }}
          onBlur={() => {
            if (draft.trim()) addTokens(draft);
          }}
          onPaste={(event) => {
            const text = event.clipboardData.getData("text");
            if (!/[,\n]/.test(text)) return;
            event.preventDefault();
            addTokens(text);
          }}
          className="min-w-36 flex-1 bg-transparent px-1 py-1 outline-none placeholder:text-muted-foreground"
          placeholder={value.length === 0 ? placeholder : undefined}
        />
      </div>
      {availableSuggestions.length > 0 && !compact ? (
        <div className="flex flex-wrap gap-1">
          {availableSuggestions.slice(0, 8).map((suggestion) => (
            <button
              key={suggestion}
              type="button"
              className="rounded-md border border-border px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground"
              onClick={() => addTokens(suggestion)}
            >
              {suggestion}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function AddCustomFieldSelect({
  label,
  fields,
  onAdd,
}: {
  label: string;
  fields: CustomFieldOption[];
  onAdd: (fieldId: string) => void;
}) {
  const t = useTranslations("warehouseInventory.create");
  const [value, setValue] = useState("");
  return (
    <div className="grid gap-1 text-sm">
      <span>{label}</span>
      <div className="flex gap-2">
        <select
          value={value}
          className={selectClass}
          onChange={(event) => setValue(event.target.value)}
        >
          <option value="">{t("selectField")}</option>
          {fields.map((field) => (
            <option key={field.id} value={field.id}>
              {field.name} ({field.field_type.replace("_", " ")})
            </option>
          ))}
        </select>
        <Button
          type="button"
          variant="outline"
          disabled={!value}
          onClick={() => {
            if (!value) return;
            onAdd(value);
            setValue("");
          }}
        >
          <Plus className="mr-2 h-4 w-4" />
          {t("add")}
        </Button>
      </div>
    </div>
  );
}

export function QuickCreateCustomField({
  entityType,
  existingFields,
  onCreated,
}: {
  entityType: "product" | "variant";
  existingFields: CustomFieldOption[];
  onCreated: (field: CustomFieldOption) => void;
}) {
  const t = useTranslations("warehouseInventory.create");
  const tFieldTypes = useTranslations("warehouseInventory.fieldTypes");
  const [isOpen, setIsOpen] = useState(false);
  const [name, setName] = useState("");
  const [fieldType, setFieldType] = useState<CustomFieldOption["field_type"]>("text");
  const [options, setOptions] = useState<string[]>([]);
  const [isRequired, setIsRequired] = useState(false);
  const [isFilterable, setIsFilterable] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const needsOptions = fieldType === "select" || fieldType === "multi_select";

  const reset = () => {
    setName("");
    setFieldType("text");
    setOptions([]);
    setIsRequired(false);
    setIsFilterable(true);
    setError(null);
    setIsOpen(false);
  };

  const create = () => {
    const trimmedName = name.trim();
    if (!trimmedName) {
      setError(t("fieldNameRequired"));
      return;
    }
    if (needsOptions && options.length === 0) {
      setError(t("selectFieldsNeedOptions"));
      return;
    }

    const baseFieldKey = fieldKeyFromName(trimmedName);
    const existingKeys = new Set(existingFields.map((field) => field.field_key.toLowerCase()));
    let fieldKey = baseFieldKey;
    let suffix = 2;
    while (existingKeys.has(fieldKey.toLowerCase())) {
      fieldKey = `${baseFieldKey}_${suffix}`;
      suffix += 1;
    }
    const displayOrder = existingFields.length + 1;

    startTransition(async () => {
      setError(null);
      const result = await createInventoryCustomFieldAction({
        entity_type: entityType,
        name: trimmedName,
        field_key: fieldKey,
        field_type: fieldType,
        is_required: isRequired,
        is_filterable: isFilterable,
        options: needsOptions ? options : [],
        display_order: displayOrder,
      });
      if (!result.success || !("data" in result)) {
        setError("error" in result ? result.error : t("createCustomFieldFailed"));
        return;
      }

      onCreated({
        id: result.data.id,
        entity_type: entityType,
        name: trimmedName,
        field_key: fieldKey,
        field_type: fieldType,
        is_required: isRequired,
        is_filterable: isFilterable,
        options: needsOptions ? options : [],
        display_order: displayOrder,
        section_name: t("customFields"),
        help_text: null,
        placeholder: null,
      });
      reset();
    });
  };

  return (
    <div className="rounded-md border border-dashed border-border p-3 text-sm">
      {!isOpen ? (
        <Button type="button" variant="ghost" size="sm" onClick={() => setIsOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          {entityType === "product" ? t("newProductField") : t("newVariantColumn")}
        </Button>
      ) : (
        <div className="grid gap-3">
          <div className="grid gap-2 sm:grid-cols-[1fr_150px]">
            <Input
              value={name}
              className="h-9"
              placeholder={t("fieldName")}
              onChange={(event) => setName(event.target.value)}
            />
            <select
              value={fieldType}
              className={selectClass}
              onChange={(event) => {
                const nextType = event.target.value as CustomFieldOption["field_type"];
                setFieldType(nextType);
                if (nextType !== "select" && nextType !== "multi_select") setOptions([]);
              }}
            >
              <option value="text">{tFieldTypes("text")}</option>
              <option value="number">{tFieldTypes("number")}</option>
              <option value="date">{tFieldTypes("date")}</option>
              <option value="boolean">{tFieldTypes("boolean")}</option>
              <option value="select">{tFieldTypes("select")}</option>
              <option value="multi_select">{tFieldTypes("multi_select")}</option>
            </select>
          </div>
          {needsOptions ? (
            <TokenInput value={options} onChange={setOptions} placeholder={t("typeValueEnter")} />
          ) : null}
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isRequired}
                  onChange={(event) => setIsRequired(event.target.checked)}
                />
                {t("required")}
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="checkbox"
                  checked={isFilterable}
                  onChange={(event) => setIsFilterable(event.target.checked)}
                />
                {t("filterable")}
              </label>
            </div>
            <div className="flex gap-2">
              <Button type="button" variant="ghost" size="sm" onClick={reset}>
                {t("cancel")}
              </Button>
              <Button type="button" size="sm" onClick={create} disabled={isPending}>
                <Plus className="mr-2 h-4 w-4" />
                {t("create")}
              </Button>
            </div>
          </div>
          {error ? <p className="text-xs text-destructive">{error}</p> : null}
        </div>
      )}
    </div>
  );
}

export function Separator() {
  return <div className="border-t border-border" />;
}
