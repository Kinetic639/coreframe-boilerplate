"use client";

import { useEffect, useRef } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useTranslations } from "next-intl";
import { Eraser } from "lucide-react";
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
import {
  getEffectiveLocationColor,
  type WarehouseLocationGroup,
} from "@/lib/warehouse/location-tree";
import { resolveLocationMapContext } from "@/lib/warehouse/map-context";

// ─── Props ────────────────────────────────────────────────────────────────────

interface LocationFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** If provided, renders in edit mode with prefilled values */
  location?: WarehouseLocation | null;
  /** Optional template used to prefill a new cloned location */
  templateLocation?: WarehouseLocation | null;
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
  templateLocation,
  availableParents: _availableParents,
  availableGroups = [],
  onSubmit,
  isPending,
}: LocationFormDialogProps) {
  const isEdit = !!location;
  const t = useTranslations("warehouseLocationsPage.form");
  const colorInputRef = useRef<HTMLInputElement | null>(null);

  function getFieldErrorMessage(message: string | undefined, field: "name" | "code") {
    if (!message) return message;

    if (field === "name" && message === "Name is required") {
      return t("validation.nameRequired");
    }

    if (field === "code") {
      if (message === "Code must be 20 characters or fewer") {
        return t("validation.codeTooLong");
      }
      if (
        message ===
        "Code may only contain letters, numbers, forward slashes, hyphens, and underscores"
      ) {
        return t("validation.codeInvalid");
      }
    }

    return message;
  }

  // For edit mode, omit `id` from the resolver — it's added manually on submit.
  const schema = isEdit ? updateLocationSchema.omit({ id: true }) : createLocationSchema;

  const {
    register,
    handleSubmit,
    setValue,
    watch,
    reset,
    setError,
    clearErrors,
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
      inherit_parent_color: false,
      physical_width_m: null,
      physical_depth_m: null,
      physical_height_m: null,
      physical_elevation_start_m: null,
      map_role: "logical",
      storage_mode: "standard",
      allow_top_storage: false,
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
        inherit_parent_color: location.inherit_parent_color ?? false,
        physical_width_m: location.physical_width_m ?? null,
        physical_depth_m: location.physical_depth_m ?? null,
        physical_height_m: location.physical_height_m ?? null,
        physical_elevation_start_m: location.physical_elevation_start_m ?? null,
        map_role: location.map_role ?? "logical",
        storage_mode: location.storage_mode ?? "standard",
        allow_top_storage: location.allow_top_storage ?? false,
        sort_order: location.sort_order,
      });
    } else if (open && templateLocation) {
      reset({
        name: templateLocation.name,
        code: null,
        description: templateLocation.description ?? null,
        icon_name: templateLocation.icon_name ?? null,
        color: templateLocation.color ?? null,
        parent_id: templateLocation.parent_id ?? null,
        group_id: templateLocation.group_id ?? null,
        inherit_group_color: templateLocation.inherit_group_color ?? false,
        inherit_parent_color: templateLocation.inherit_parent_color ?? false,
        physical_width_m: templateLocation.physical_width_m ?? null,
        physical_depth_m: templateLocation.physical_depth_m ?? null,
        physical_height_m: templateLocation.physical_height_m ?? null,
        physical_elevation_start_m: templateLocation.physical_elevation_start_m ?? null,
        map_role: templateLocation.map_role ?? "logical",
        storage_mode: templateLocation.storage_mode ?? "standard",
        allow_top_storage: templateLocation.allow_top_storage ?? false,
        sort_order: templateLocation.sort_order,
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
        inherit_parent_color: false,
        physical_width_m: null,
        physical_depth_m: null,
        physical_height_m: null,
        physical_elevation_start_m: null,
        map_role: "logical",
        storage_mode: "standard",
        allow_top_storage: false,
        sort_order: 0,
      });
    }
  }, [open, location, reset, templateLocation]);

  function handleFormSubmit(data: FormValues) {
    const normalizedData: FormValues = { ...data };

    if (
      normalizedData.map_role === "front_segment" ||
      normalizedData.map_role === "top_storage_segment"
    ) {
      const isTopStorage = normalizedData.map_role === "top_storage_segment";
      if (normalizedData.physical_height_m == null) {
        setError("physical_height_m", {
          type: "manual",
          message: isTopStorage
            ? t("help.topStorageHeightRequired")
            : t("help.frontSegmentHeightRequired"),
        });
        return;
      }
      if (
        !isTopStorage &&
        frontSegmentAvailableHeight !== null &&
        normalizedData.physical_height_m > frontSegmentAvailableHeight
      ) {
        setError("physical_height_m", {
          type: "manual",
          message: t("help.frontSegmentHeightExceeded", {
            available: String(frontSegmentAvailableHeight),
            max: String(frontSegmentMaxHeight ?? 0),
          }),
        });
        return;
      }
      normalizedData.physical_width_m = null;
      normalizedData.physical_depth_m = null;
      normalizedData.physical_elevation_start_m = null;
      normalizedData.allow_top_storage = false;
    }

    if (normalizedData.map_role === "layout_root") {
      normalizedData.parent_id = null;
      normalizedData.inherit_parent_color = false;
      normalizedData.physical_elevation_start_m = null;
      normalizedData.allow_top_storage = false;
    }

    if (normalizedData.map_role !== "top_down_unit") {
      normalizedData.allow_top_storage = false;
    }

    if (isEdit && location) {
      onSubmit({ ...normalizedData, id: location.id } as UpdateLocationInput & { id: string });
    } else {
      onSubmit(normalizedData as CreateLocationInput);
    }
  }

  const selectedGroupId = watch("group_id");
  const selectedParentId = watch("parent_id");
  const colorValue = watch("color");
  const inheritGroupColor = watch("inherit_group_color");
  const inheritParentColor = watch("inherit_parent_color");
  const selectedMapRole = watch("map_role");
  const shouldShowRootDimensions = selectedMapRole === "layout_root";
  const shouldShowTopDownDimensions = selectedMapRole === "top_down_unit";
  const shouldShowFrontSegmentDimensions =
    selectedMapRole === "front_segment" || selectedMapRole === "top_storage_segment";
  const isTopStorageSegment = selectedMapRole === "top_storage_segment";
  const effectiveGroupScopeParentId = selectedParentId ?? null;
  const scopedAvailableGroups = availableGroups.filter(
    (group) => (group.parent_location_id ?? null) === effectiveGroupScopeParentId
  );
  const isColorInherited = !!selectedGroupId && inheritGroupColor;
  const selectedGroup = selectedGroupId
    ? (scopedAvailableGroups.find((group) => group.id === selectedGroupId) ?? null)
    : null;
  const selectedParentLocation =
    _availableParents.find((candidate) => candidate.id === selectedParentId) ?? null;
  const currentHeightValue = watch("physical_height_m");
  const frontSegmentSiblingHeight =
    shouldShowFrontSegmentDimensions && selectedParentId && !isTopStorageSegment
      ? _availableParents
          .filter((candidate) => candidate.parent_id === selectedParentId)
          .filter((candidate) => (candidate.map_role ?? "logical") === "front_segment")
          .reduce((sum, candidate) => sum + (candidate.physical_height_m ?? 0), 0)
      : 0;
  const frontSegmentMaxHeight = selectedParentLocation?.physical_height_m ?? null;
  const frontSegmentAvailableHeight =
    frontSegmentMaxHeight === null
      ? null
      : Math.max(0, frontSegmentMaxHeight - frontSegmentSiblingHeight);
  const selectedParentColor = selectedParentLocation
    ? getEffectiveLocationColor(selectedParentLocation, availableGroups, _availableParents)
    : null;
  const isParentColorInherited = !!selectedParentId && inheritParentColor;
  const displayedColorValue = isColorInherited
    ? (selectedGroup?.color ?? null)
    : isParentColorInherited
      ? selectedParentColor
      : colorValue;
  const colorPickerValue =
    displayedColorValue && /^#[0-9A-Fa-f]{6}$/.test(displayedColorValue)
      ? displayedColorValue
      : "#94a3b8";
  const logicalParentOptions = _availableParents.filter(
    (candidate) =>
      !["front_segment", "top_storage_segment"].includes(candidate.map_role ?? "logical")
  );
  const topDownParentOptions = _availableParents.filter((candidate) => {
    const role = candidate.map_role ?? "logical";
    if (role === "layout_root") return true;
    if (role === "logical") return true;
    return false;
  });
  const topStorageParentOptions = topDownParentOptions.filter((candidate) => {
    if (!candidate.allow_top_storage) return false;

    const hasAnotherTopStorageChild = _availableParents.some(
      (child) =>
        child.parent_id === candidate.id &&
        child.id !== location?.id &&
        (child.map_role ?? "logical") === "top_storage_segment"
    );

    return !hasAnotherTopStorageChild;
  });

  useEffect(() => {
    if (!selectedGroupId) return;
    const isGroupStillValid = scopedAvailableGroups.some((group) => group.id === selectedGroupId);
    if (!isGroupStillValid) {
      setValue("group_id", null);
      setValue("inherit_group_color", false);
    }
  }, [scopedAvailableGroups, selectedGroupId, setValue]);

  useEffect(() => {
    if (!shouldShowFrontSegmentDimensions) {
      clearErrors("physical_height_m");
      return;
    }

    if (isTopStorageSegment) {
      clearErrors("physical_height_m");
      return;
    }

    if (frontSegmentAvailableHeight === null || currentHeightValue == null) {
      clearErrors("physical_height_m");
      return;
    }

    if (currentHeightValue > frontSegmentAvailableHeight) {
      setError("physical_height_m", {
        type: "manual",
        message: t("help.frontSegmentHeightExceeded", {
          available: String(frontSegmentAvailableHeight),
          max: String(frontSegmentMaxHeight ?? 0),
        }),
      });
      return;
    }

    clearErrors("physical_height_m");
  }, [
    clearErrors,
    currentHeightValue,
    frontSegmentAvailableHeight,
    frontSegmentMaxHeight,
    setError,
    shouldShowFrontSegmentDimensions,
    t,
  ]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="flex max-h-[85vh] flex-col overflow-hidden sm:max-w-[480px]">
        <DialogHeader className="shrink-0">
          <DialogTitle>{isEdit ? t("titleEdit") : t("titleCreate")}</DialogTitle>
        </DialogHeader>

        <form
          onSubmit={handleSubmit(handleFormSubmit)}
          className="flex min-h-0 flex-1 flex-col overflow-hidden"
        >
          <div className="min-h-0 flex-1 space-y-4 overflow-y-auto px-1 pb-1">
            {/* Name */}
            <div className="space-y-1">
              <Label htmlFor="name">
                {t("fields.name")} <span className="text-destructive">*</span>
              </Label>
              <Input id="name" {...register("name")} placeholder={t("placeholders.name")} />
              {errors.name && (
                <p className="text-xs text-destructive">
                  {getFieldErrorMessage(errors.name.message, "name")}
                </p>
              )}
            </div>

            <input type="hidden" {...register("parent_id")} />

            {/* Code + Color */}
            <div className="grid grid-cols-[minmax(0,1fr)_auto] gap-3 items-start">
              <div className="space-y-1">
                <Label htmlFor="code">{t("fields.code")}</Label>
                <Input
                  id="code"
                  {...register("code", { setValueAs: (v) => (v === "" ? null : v) })}
                  placeholder={t("placeholders.code")}
                />
                {errors.code && (
                  <p className="text-xs text-destructive">
                    {getFieldErrorMessage(errors.code.message, "code")}
                  </p>
                )}
              </div>

              <div className="space-y-1">
                <Label htmlFor="color">{t("fields.color")}</Label>
                <div className="flex items-center gap-1.5">
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
                    disabled={isColorInherited || isParentColorInherited}
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
                              opacity: isColorInherited || isParentColorInherited ? 0.38 : 1,
                              filter:
                                isColorInherited || isParentColorInherited
                                  ? "grayscale(0.45)"
                                  : "none",
                            }
                          : undefined
                      }
                    >
                      {!displayedColorValue ? (
                        <span className="text-[10px] text-muted-foreground">-</span>
                      ) : null}
                    </span>
                  </button>
                  {!isColorInherited && !isParentColorInherited && colorValue && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      className="h-9 w-9 shrink-0 text-muted-foreground"
                      onClick={() => setValue("color", null)}
                      aria-label={t("actions.clearColor")}
                      title={t("actions.clearColor")}
                    >
                      <Eraser className="h-4 w-4" />
                    </Button>
                  )}
                </div>
                {isColorInherited && (
                  <p className="text-xs text-muted-foreground">{t("fields.groupColorInherited")}</p>
                )}
                {isParentColorInherited && (
                  <p className="text-xs text-muted-foreground">
                    {t("fields.parentColorInherited")}
                  </p>
                )}
                {errors.color && <p className="text-xs text-destructive">{errors.color.message}</p>}
              </div>
            </div>

            {/* Group */}
            {scopedAvailableGroups.length > 0 && (
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
                    {scopedAvailableGroups.map((g) => (
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

            {/* Mapping */}
            <div className="space-y-3 rounded-lg border bg-muted/30 p-3">
              <div>
                <Label className="text-xs font-semibold">{t("sections.mapping")}</Label>
                <p className="text-xs text-muted-foreground">{t("help.mapping")}</p>
              </div>

              <div className="space-y-1">
                <Label>{t("fields.mapRole")}</Label>
                <Select
                  value={selectedMapRole ?? "logical"}
                  onValueChange={(value) =>
                    setValue(
                      "map_role",
                      value as
                        | "logical"
                        | "layout_root"
                        | "top_down_unit"
                        | "front_segment"
                        | "top_storage_segment"
                    )
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="logical">{t("roles.logical")}</SelectItem>
                    <SelectItem value="layout_root">{t("roles.layoutRoot")}</SelectItem>
                    <SelectItem value="top_down_unit">{t("roles.topDownUnit")}</SelectItem>
                    <SelectItem value="front_segment">{t("roles.frontSegment")}</SelectItem>
                    <SelectItem value="top_storage_segment">
                      {t("roles.topStorageSegment")}
                    </SelectItem>
                  </SelectContent>
                </Select>
                {selectedMapRole === "layout_root" && (
                  <p className="text-xs text-muted-foreground">{t("help.layoutRoot")}</p>
                )}
                {selectedMapRole === "logical" && (
                  <p className="text-xs text-muted-foreground">{t("help.logicalRole")}</p>
                )}
              </div>

              {(selectedMapRole === "logical" || shouldShowTopDownDimensions) && (
                <div className="space-y-1">
                  <Label>{t("fields.parentLocation")}</Label>
                  <Select
                    value={selectedParentId ?? "__none__"}
                    onValueChange={(val) => {
                      const nextParentId = val === "__none__" ? null : val;
                      setValue("parent_id", nextParentId);
                      if (!nextParentId) {
                        setValue("inherit_parent_color", false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue
                        placeholder={
                          selectedMapRole === "logical"
                            ? t("placeholders.noParent")
                            : t("placeholders.selectRootLocation")
                        }
                      />
                    </SelectTrigger>
                    <SelectContent>
                      {(selectedMapRole === "logical"
                        ? logicalParentOptions
                        : topDownParentOptions
                      ).map((loc) => (
                        <SelectItem key={loc.id} value={loc.id}>
                          {loc.name}
                          {loc.code ? ` (${loc.code})` : ""}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  {shouldShowTopDownDimensions && (
                    <p className="text-xs text-muted-foreground">{t("help.topDownParent")}</p>
                  )}
                </div>
              )}

              {shouldShowFrontSegmentDimensions && (
                <div className="space-y-1">
                  <Label>{t("fields.parentLocation")}</Label>
                  <Select
                    value={selectedParentId ?? "__none__"}
                    onValueChange={(val) => {
                      const nextParentId = val === "__none__" ? null : val;
                      setValue("parent_id", nextParentId);
                      if (!nextParentId) {
                        setValue("inherit_parent_color", false);
                      }
                    }}
                  >
                    <SelectTrigger>
                      <SelectValue placeholder={t("placeholders.selectTopDownUnit")} />
                    </SelectTrigger>
                    <SelectContent>
                      {(isTopStorageSegment ? topStorageParentOptions : topDownParentOptions).map(
                        (loc) => (
                          <SelectItem key={loc.id} value={loc.id}>
                            {loc.name}
                            {loc.code ? ` (${loc.code})` : ""}
                          </SelectItem>
                        )
                      )}
                    </SelectContent>
                  </Select>
                  <p className="text-xs text-muted-foreground">
                    {isTopStorageSegment
                      ? t("help.topStorageParent")
                      : t("help.frontSegmentParent")}
                  </p>
                </div>
              )}

              {(shouldShowRootDimensions || shouldShowTopDownDimensions) && (
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <Label htmlFor="physical_width_m">
                      {shouldShowRootDimensions ? t("fields.roomWidth") : t("fields.physicalWidth")}
                    </Label>
                    <Input
                      id="physical_width_m"
                      type="number"
                      step="0.1"
                      {...register("physical_width_m", {
                        setValueAs: (value) => (value === "" ? null : parseFloat(value)),
                      })}
                    />
                  </div>
                  <div className="space-y-1">
                    <Label htmlFor="physical_depth_m">
                      {shouldShowRootDimensions
                        ? t("fields.roomLength")
                        : t("fields.physicalDepth")}
                    </Label>
                    <Input
                      id="physical_depth_m"
                      type="number"
                      step="0.1"
                      {...register("physical_depth_m", {
                        setValueAs: (value) => (value === "" ? null : parseFloat(value)),
                      })}
                    />
                  </div>
                  <div className="space-y-1 col-span-2">
                    <Label htmlFor="physical_height_m">{t("fields.physicalHeightOptional")}</Label>
                    <Input
                      id="physical_height_m"
                      type="number"
                      step="0.1"
                      {...register("physical_height_m", {
                        setValueAs: (value) => (value === "" ? null : parseFloat(value)),
                      })}
                    />
                  </div>
                </div>
              )}

              {shouldShowTopDownDimensions && (
                <div className="flex items-center justify-between rounded-md border px-3 py-2">
                  <div className="space-y-0.5">
                    <Label htmlFor="allow-top-storage">{t("fields.allowTopStorage")}</Label>
                    <p className="text-xs text-muted-foreground">
                      {t("help.allowTopStorageTopDown")}
                    </p>
                  </div>
                  <Switch
                    id="allow-top-storage"
                    checked={watch("allow_top_storage") ?? false}
                    onCheckedChange={(checked) => setValue("allow_top_storage", checked)}
                  />
                </div>
              )}

              {(shouldShowTopDownDimensions || shouldShowFrontSegmentDimensions) && (
                <div className="space-y-3">
                  {selectedParentId && (
                    <div className="flex items-center justify-between rounded-md border px-3 py-2">
                      <div className="space-y-0.5">
                        <Label htmlFor="inherit-parent-color">
                          {t("fields.inheritParentColor")}
                        </Label>
                        <p className="text-xs text-muted-foreground">
                          {shouldShowTopDownDimensions
                            ? t("help.inheritTopDownParentColor")
                            : isTopStorageSegment
                              ? t("help.inheritTopStorageParentColor")
                              : t("help.inheritParentColor")}
                        </p>
                      </div>
                      <Switch
                        id="inherit-parent-color"
                        checked={inheritParentColor}
                        onCheckedChange={(checked) => setValue("inherit_parent_color", checked)}
                      />
                    </div>
                  )}

                  {shouldShowFrontSegmentDimensions && (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between gap-3">
                        <Label htmlFor="physical_height_m">{t("fields.physicalHeight")}</Label>
                        {!isTopStorageSegment && frontSegmentMaxHeight !== null ? (
                          <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                            <span>
                              {t("help.frontSegmentMaxHeight", {
                                value: String(frontSegmentMaxHeight),
                              })}
                            </span>
                            <span className="text-muted-foreground/50">•</span>
                            <span>
                              {t("help.frontSegmentAvailableHeight", {
                                value: String(frontSegmentAvailableHeight ?? 0),
                              })}
                            </span>
                          </div>
                        ) : !isTopStorageSegment ? (
                          <span className="text-[11px] text-muted-foreground">
                            {t("help.parentHeightUnknown")}
                          </span>
                        ) : null}
                      </div>
                      <Input
                        id="physical_height_m"
                        type="number"
                        step="0.1"
                        max={
                          !isTopStorageSegment
                            ? (frontSegmentAvailableHeight ?? undefined)
                            : undefined
                        }
                        {...register("physical_height_m", {
                          setValueAs: (value) => (value === "" ? null : parseFloat(value)),
                        })}
                      />
                      {!isTopStorageSegment && frontSegmentMaxHeight !== null && (
                        <p className="text-xs text-muted-foreground">
                          {t("help.frontSegmentHeightHint", {
                            available: String(frontSegmentAvailableHeight ?? 0),
                            max: String(frontSegmentMaxHeight),
                          })}
                        </p>
                      )}
                      {isTopStorageSegment && (
                        <p className="text-xs text-muted-foreground">
                          {t("help.topStorageHeightHint")}
                        </p>
                      )}
                      {errors.physical_height_m && (
                        <p className="text-xs text-destructive">
                          {errors.physical_height_m.message}
                        </p>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>

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
          </div>

          <DialogFooter className="mt-4 shrink-0 border-t pt-4">
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
