"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLocationSchema, updateLocationSchema } from "@/app/actions/warehouse/schemas";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";
import type { WarehouseLocation } from "@/server/services/warehouse-locations.service";
import type { WarehouseLocationGroup } from "@/lib/warehouse/location-tree";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, renders in edit mode with prefilled values */
  location?: WarehouseLocation | null;
  /** Flat list of locations available as parents (excludes the location being edited) */
  availableParents: WarehouseLocation[];
  /** Available groups for assignment */
  availableGroups?: WarehouseLocationGroup[];
  onSubmit: (data: CreateLocationInput | (UpdateLocationInput & { id: string })) => void;
  isPending: boolean;
}

// ─── Form values type (id excluded — added manually on submit for updates) ────

type FormValues = Omit<CreateLocationInput, never>;

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  availableParents,
  availableGroups = [],
  onSubmit,
  isPending,
}: LocationFormDialogProps) {
  const isEdit = !!location;
  const t = useTranslations("warehouseLocationsPage.form");
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  // For edit mode, omit `id` from the resolver — it's added manually on submit.
  const schema = isEdit ? updateLocationSchema.omit({ id: true }) : createLocationSchema;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: null,
      description: null,
      icon_name: null,
      color: null,
      parent_id: null,
      group_id: null,
      inherit_group_color: false,
      sort_order: 0,
    },
  });

  // Seed form when editing
  useEffect(() => {
    if (open && location) {
      reset({
        name: location.name,
        code: location.code ?? null,
        description: location.description ?? null,
        icon_name: location.icon_name ?? null,
        color: location.color ?? null,
        parent_id: location.parent_id ?? null,
        group_id: location.group_id ?? null,
        inherit_group_color: location.inherit_group_color ?? false,
        sort_order: location.sort_order,
      });
    } else if (open && !location) {
      reset({
        name: "",
        code: null,
        description: null,
        icon_name: null,
        color: null,
        parent_id: null,
        group_id: null,
        inherit_group_color: false,
        sort_order: 0,
      });
    }
  }, [open, location, reset]);

  function handleFormSubmit(data: FormValues) {
    if (isEdit && location) {
      onSubmit({ ...data, id: location.id } as UpdateLocationInput & { id: string });
    } else {
      onSubmit(data as CreateLocationInput);
    }
  }

  const selectedParentId = watch("parent_id");
  const selectedGroupId = watch("group_id");
  const colorValue = watch("color");
  const inheritGroupColor = watch("inherit_group_color");
  const selectedGroup = selectedGroupId
    ? (availableGroups.find((group) => group.id === selectedGroupId) ?? null)
    : null;
  const displayedColorValue =
    selectedGroupId && inheritGroupColor ? (selectedGroup?.color ?? null) : colorValue;
  const colorPickerValue =
    colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue) ? colorValue : "#94a3b8";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("titleEdit") : t("titleCreate")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">
              {t("fields.name")} <span className="text-destructive">*</span>
            </Label>
            <Input id="name" {...register("name")} placeholder={t("placeholders.name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Code */}
          <div className="space-y-1">
            <Label htmlFor="code">{t("fields.code")}</Label>
            <Input
              id="code"
              {...register("code", { setValueAs: (v) => (v === "" ? null : v) })}
              placeholder={t("placeholders.code")}
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          {/* Parent */}
          <div className="space-y-1">
            <Label>{t("fields.parentLocation")}</Label>
            <Select
              value={selectedParentId ?? "__none__"}
              onValueChange={(val) => setValue("parent_id", val === "__none__" ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder={t("placeholders.noParent")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">{t("fields.parentNone")}</SelectItem>
                {availableParents.map((loc) => (
                  <SelectItem key={loc.id} value={loc.id}>
                    {"  ".repeat(loc.level)}
                    {loc.level > 0 ? "└ " : ""}
                    {loc.name}
                    {loc.code ? ` (${loc.code})` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Group */}
          {availableGroups.length > 0 && (
            <div className="space-y-1">
              <Label>{t("fields.group")}</Label>
              <Select
                value={selectedGroupId ?? "__none__"}
                onValueChange={(val) => {
                  const nextGroupId = val === "__none__" ? null : val;
                  setValue("group_id", nextGroupId);
                  if (!nextGroupId) {
                    setValue("inherit_group_color", false);
                  }
                }}
              >
                <SelectTrigger>
                  <SelectValue placeholder={t("placeholders.noGroup")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="__none__">{t("fields.groupNone")}</SelectItem>
                  {availableGroups.map((g) => (
                    <SelectItem key={g.id} value={g.id}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          {selectedGroupId && (
            <div className="space-y-1">
              <div className="flex items-center justify-between rounded-md border px-3 py-2">
                <div className="space-y-0.5">
                  <Label htmlFor="inherit-group-color">{t("fields.inheritGroupColor")}</Label>
                  <p className="text-xs text-muted-foreground">{t("help.inheritGroupColor")}</p>
                </div>
                <Switch
                  id="inherit-group-color"
                  checked={inheritGroupColor}
                  onCheckedChange={(checked) => setValue("inherit_group_color", checked)}
                />
              </div>
            </div>
          )}

          {/* Color */}
          <div className="space-y-1">
            <Label htmlFor="color">{t("fields.color")}</Label>
            <div className="flex items-center gap-2">
              <input
                ref={colorInputRef}
                id="color"
                type="color"
                value={colorPickerValue}
                onChange={(e) => setValue("color", e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border p-0.5 transition-colors hover:border-foreground/30 disabled:cursor-not-allowed disabled:border-muted-foreground/15 disabled:bg-muted/50"
                onClick={() => colorInputRef.current?.click()}
                aria-label={t("fields.color")}
                disabled={!!selectedGroupId && inheritGroupColor}
              >
                <span
                  className={`flex h-full w-full items-center justify-center rounded-sm ${
                    displayedColorValue
                      ? ""
                      : "border border-dashed border-muted-foreground/40 bg-muted"
                  }`}
                  style={
                    displayedColorValue
                      ? {
                          backgroundColor: displayedColorValue,
                          opacity: selectedGroupId && inheritGroupColor ? 0.38 : 1,
                          filter: selectedGroupId && inheritGroupColor ? "grayscale(0.45)" : "none",
                        }
                      : undefined
                  }
                >
                  {!displayedColorValue ? (
                    <span className="text-[10px] text-muted-foreground">-</span>
                  ) : null}
                </span>
              </button>
              <span className="text-xs font-mono text-muted-foreground flex-1">
                {!!selectedGroupId && inheritGroupColor
                  ? t("fields.groupColorInherited")
                  : (colorValue ?? t("fields.noColor"))}
              </span>
              {colorValue && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs text-muted-foreground"
                  onClick={() => setValue("color", null)}
                >
                  {t("actions.clearColor")}
                </Button>
              )}
            </div>
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">{t("fields.description")}</Label>
            <Textarea
              id="description"
              {...register("description", { setValueAs: (v) => (v === "" ? null : v) })}
              placeholder={t("placeholders.description")}
              rows={3}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              {t("actions.cancel")}
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? t("actions.saving")
                : isEdit
                  ? t("actions.saveChanges")
                  : t("actions.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
