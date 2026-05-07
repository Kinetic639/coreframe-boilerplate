"use client";

import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Loader2 } from "lucide-react";
import type { LocationCategory } from "@/lib/types/warehouse/locations-v2";

const CATEGORIES: { value: LocationCategory; label: string }[] = [
  { value: "area", label: "Area" },
  { value: "zone", label: "Zone" },
  { value: "room", label: "Room" },
  { value: "cabinet", label: "Cabinet" },
  { value: "rack", label: "Rack" },
  { value: "shelf_unit", label: "Shelf Unit" },
  { value: "workbench", label: "Workbench" },
  { value: "shelf", label: "Shelf" },
  { value: "drawer", label: "Drawer" },
  { value: "bin", label: "Bin" },
  { value: "box", label: "Box" },
  { value: "pallet_position", label: "Pallet Position" },
  { value: "wall_storage", label: "Wall Storage" },
  { value: "receiving", label: "Receiving Area" },
  { value: "dispatch", label: "Dispatch Area" },
  { value: "quarantine", label: "Quarantine" },
  { value: "temporary", label: "Temporary" },
  { value: "custom", label: "Custom" },
];

const positiveMm = z.coerce
  .number()
  .int()
  .positive()
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const locationFormV2Schema = z.object({
  name: z.string().min(1, "Name is required").max(200),
  code: z
    .string()
    .max(20)
    .regex(/^[A-Za-z0-9_/-]*$/, "Letters, numbers, /, -, _ only")
    .optional()
    .or(z.literal("")),
  location_category: z.string().default("custom"),
  can_store_inventory: z.boolean().default(false),
  width_mm: positiveMm,
  height_mm: positiveMm,
  depth_mm: positiveMm,
  parent_id: z.string().uuid().nullable().optional(),
  color: z
    .string()
    .regex(/^#[0-9A-Fa-f]{6}$/)
    .nullable()
    .optional()
    .or(z.literal("")),
});

export type LocationFormV2Values = z.infer<typeof locationFormV2Schema>;

interface LocationFormV2Props {
  defaultValues?: Partial<LocationFormV2Values>;
  onSubmit: (values: LocationFormV2Values) => void;
  isPending?: boolean;
  submitLabel?: string;
  showDimensions?: boolean;
}

export function LocationFormV2({
  defaultValues,
  onSubmit,
  isPending,
  submitLabel = "Save",
  showDimensions = true,
}: LocationFormV2Props) {
  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors },
  } = useForm<LocationFormV2Values>({
    resolver: zodResolver(locationFormV2Schema),
    defaultValues: {
      location_category: "custom",
      can_store_inventory: false,
      ...defaultValues,
    },
  });

  const canStore = watch("can_store_inventory");

  return (
    <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
      <div className="space-y-1">
        <Label htmlFor="name">Name *</Label>
        <Input id="name" {...register("name")} placeholder="e.g. Cabinet A" />
        {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
      </div>

      <div className="space-y-1">
        <Label htmlFor="code">Code</Label>
        <Input id="code" {...register("code")} placeholder="e.g. C1" />
        {errors.code && <p className="text-xs text-destructive">{errors.code.message}</p>}
      </div>

      <div className="space-y-1">
        <Label>Category</Label>
        <Select
          defaultValue={defaultValues?.location_category ?? "custom"}
          onValueChange={(v) => setValue("location_category", v as LocationCategory)}
        >
          <SelectTrigger>
            <SelectValue placeholder="Select category" />
          </SelectTrigger>
          <SelectContent>
            {CATEGORIES.map((c) => (
              <SelectItem key={c.value} value={c.value}>
                {c.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="flex items-center justify-between rounded-lg border p-3">
        <div>
          <p className="text-sm font-medium">Can store inventory</p>
          <p className="text-xs text-muted-foreground">
            Enable if items can be assigned directly to this location
          </p>
        </div>
        <Switch checked={canStore} onCheckedChange={(v) => setValue("can_store_inventory", v)} />
      </div>

      {showDimensions && (
        <div className="space-y-2">
          <Label className="text-sm">Dimensions (mm)</Label>
          <div className="grid grid-cols-3 gap-2">
            <div className="space-y-1">
              <Label htmlFor="width_mm" className="text-xs text-muted-foreground">
                Width
              </Label>
              <Input
                id="width_mm"
                type="number"
                min={1}
                {...register("width_mm")}
                placeholder="e.g. 1200"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="depth_mm" className="text-xs text-muted-foreground">
                Depth
              </Label>
              <Input
                id="depth_mm"
                type="number"
                min={1}
                {...register("depth_mm")}
                placeholder="e.g. 600"
              />
            </div>
            <div className="space-y-1">
              <Label htmlFor="height_mm" className="text-xs text-muted-foreground">
                Height
              </Label>
              <Input
                id="height_mm"
                type="number"
                min={1}
                {...register("height_mm")}
                placeholder="e.g. 2000"
              />
            </div>
          </div>
        </div>
      )}

      <Button type="submit" disabled={isPending} className="w-full">
        {isPending ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Saving…
          </>
        ) : (
          submitLabel
        )}
      </Button>
    </form>
  );
}
