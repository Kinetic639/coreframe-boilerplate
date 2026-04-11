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
import {
  createLocationGroupSchema,
  updateLocationGroupSchema,
} from "@/app/actions/warehouse/schemas";
import type {
  CreateLocationGroupInput,
  UpdateLocationGroupInput,
} from "@/app/actions/warehouse/schemas";
import type { WarehouseLocationGroup } from "@/lib/warehouse/location-tree";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationGroupFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, renders in edit mode with prefilled values */
  group?: WarehouseLocationGroup | null;
  onSubmit: (data: CreateLocationGroupInput | (UpdateLocationGroupInput & { id: string })) => void;
  isPending: boolean;
}

type FormValues = CreateLocationGroupInput;

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationGroupFormDialog({
  open,
  onOpenChange,
  group,
  onSubmit,
  isPending,
}: LocationGroupFormDialogProps) {
  const isEdit = !!group;
  const t = useTranslations("warehouseLocationsPage.groupForm");
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  const schema = isEdit ? updateLocationGroupSchema.omit({ id: true }) : createLocationGroupSchema;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: { name: "", description: null, color: null },
  });

  useEffect(() => {
    if (open && group) {
      reset({
        name: group.name,
        description: group.description ?? null,
        color: group.color ?? null,
      });
    } else if (open && !group) {
      reset({ name: "", description: null, color: null });
    }
  }, [open, group, reset]);

  function handleFormSubmit(data: FormValues) {
    if (isEdit && group) {
      onSubmit({ ...data, id: group.id } as UpdateLocationGroupInput & { id: string });
    } else {
      onSubmit(data as CreateLocationGroupInput);
    }
  }

  const colorValue = watch("color");
  const colorPickerValue =
    colorValue && /^#[0-9A-Fa-f]{6}$/.test(colorValue) ? colorValue : "#94a3b8";

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[420px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? t("titleEdit") : t("titleCreate")}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="group-name">
              {t("fields.name")} <span className="text-destructive">*</span>
            </Label>
            <Input
              id="group-name"
              {...register("name")}
              placeholder={t("placeholders.name")}
              autoFocus
            />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="group-description">{t("fields.description")}</Label>
            <Textarea
              id="group-description"
              {...register("description", { setValueAs: (v) => (v === "" ? null : v) })}
              placeholder={t("placeholders.description")}
              rows={2}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          {/* Color */}
          <div className="space-y-1">
            <Label htmlFor="group-color">{t("fields.color")}</Label>
            <div className="flex items-center gap-2">
              <input
                ref={colorInputRef}
                id="group-color"
                type="color"
                value={colorPickerValue}
                onChange={(e) => setValue("color", e.target.value)}
                className="sr-only"
                tabIndex={-1}
                aria-hidden="true"
              />
              <button
                type="button"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded border p-0.5 transition-colors hover:border-foreground/30"
                onClick={() => colorInputRef.current?.click()}
                aria-label={t("fields.color")}
              >
                <span
                  className={`flex h-full w-full items-center justify-center rounded-sm ${
                    colorValue ? "" : "border border-dashed border-muted-foreground/40 bg-muted"
                  }`}
                  style={colorValue ? { backgroundColor: colorValue } : undefined}
                >
                  {!colorValue ? (
                    <span className="text-[10px] text-muted-foreground">-</span>
                  ) : null}
                </span>
              </button>
              <span className="text-xs font-mono text-muted-foreground flex-1">
                {colorValue ?? t("fields.noColor")}
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
