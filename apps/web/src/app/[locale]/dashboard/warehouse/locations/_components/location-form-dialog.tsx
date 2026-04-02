"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { createLocationSchema, updateLocationSchema } from "@/app/actions/warehouse/schemas";
import type { CreateLocationInput, UpdateLocationInput } from "@/app/actions/warehouse/schemas";
import type { WarehouseLocation } from "@/server/services/warehouse-locations.service";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, renders in edit mode with prefilled values */
  location?: WarehouseLocation | null;
  /** Flat list of locations available as parents (excludes the location being edited) */
  availableParents: WarehouseLocation[];
  onSubmit: (data: CreateLocationInput | (UpdateLocationInput & { id: string })) => void;
  isPending: boolean;
}

// ─── Component ────────────────────────────────────────────────────────────────

export function LocationFormDialog({
  open,
  onOpenChange,
  location,
  availableParents,
  onSubmit,
  isPending,
}: LocationFormDialogProps) {
  const isEdit = !!location;

  const schema = isEdit ? updateLocationSchema : createLocationSchema;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    formState: { errors },
  } = useForm<CreateLocationInput>({
    resolver: zodResolver(schema),
    defaultValues: {
      name: "",
      code: null,
      description: null,
      icon_name: null,
      color: null,
      parent_id: null,
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
        sort_order: 0,
      });
    }
  }, [open, location, reset]);

  function handleFormSubmit(data: CreateLocationInput) {
    if (isEdit && location) {
      onSubmit({ ...data, id: location.id });
    } else {
      onSubmit(data);
    }
  }

  const selectedParentId = watch("parent_id");

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[480px]">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Edit Location" : "Create Location"}</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit(handleFormSubmit)} className="space-y-4">
          {/* Name */}
          <div className="space-y-1">
            <Label htmlFor="name">
              Name <span className="text-destructive">*</span>
            </Label>
            <Input id="name" {...register("name")} placeholder="e.g. Aisle A, Shelf 1" />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Code */}
          <div className="space-y-1">
            <Label htmlFor="code">Code</Label>
            <Input
              id="code"
              {...register("code", { setValueAs: (v) => (v === "" ? null : v) })}
              placeholder="e.g. A-01 (optional)"
            />
            {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
          </div>

          {/* Parent */}
          <div className="space-y-1">
            <Label>Parent Location</Label>
            <Select
              value={selectedParentId ?? "__none__"}
              onValueChange={(val) => setValue("parent_id", val === "__none__" ? null : val)}
            >
              <SelectTrigger>
                <SelectValue placeholder="None (root location)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="__none__">None (root location)</SelectItem>
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

          {/* Color */}
          <div className="space-y-1">
            <Label htmlFor="color">Color</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                {...register("color", { setValueAs: (v) => (v === "" ? null : v) })}
                placeholder="#FF5733 (optional)"
                className="flex-1"
              />
              {watch("color") && /^#[0-9A-Fa-f]{6}$/.test(watch("color") ?? "") && (
                <div
                  className="h-9 w-9 shrink-0 rounded border"
                  style={{ backgroundColor: watch("color") ?? undefined }}
                />
              )}
            </div>
            {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1">
            <Label htmlFor="description">Description</Label>
            <Textarea
              id="description"
              {...register("description", { setValueAs: (v) => (v === "" ? null : v) })}
              placeholder="Optional description"
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
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending ? "Saving..." : isEdit ? "Save Changes" : "Create"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
