"use client";

import * as React from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { variantOptionsService } from "../../api/variant-options-service";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2 } from "lucide-react";
import { AddVariantOptionDialog } from "./add-variant-option-dialog";
import { toast } from "react-toastify";
import type { VariantOptionGroupWithValues } from "../../types/variant-options";
import { useTranslations } from "next-intl";

export function VariantOptionsPage() {
  const t = useTranslations("modules.warehouse.items.settings.variantOptions");
  const { activeOrgId } = useAppStore();
  const [groups, setGroups] = React.useState<VariantOptionGroupWithValues[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showAddDialog, setShowAddDialog] = React.useState(false);
  const [selectedGroup, setSelectedGroup] = React.useState<string | null>(null);
  const [customName, setCustomName] = React.useState("");
  const [customDescription, setCustomDescription] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [newValue, setNewValue] = React.useState<Record<string, string>>({});

  React.useEffect(() => {
    if (activeOrgId) {
      loadGroups();
    }
  }, [activeOrgId]);

  async function loadGroups() {
    if (!activeOrgId) return;

    try {
      setIsLoading(true);
      const data = await variantOptionsService.getTemplateGroups(activeOrgId);
      setGroups(data);
    } catch (error) {
      console.error("Failed to load variant option groups:", error);
      toast.error(t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateGroup(data: {
    name: string;
    description?: string;
    values?: string[];
  }) {
    if (!activeOrgId) return;

    try {
      const newGroup = await variantOptionsService.createTemplateGroup({
        organization_id: activeOrgId,
        name: data.name,
        description: data.description,
      });

      // Add values if provided
      const createdValues = [];
      if (data.values && data.values.length > 0) {
        for (let i = 0; i < data.values.length; i++) {
          const value = await variantOptionsService.addValueToTemplate({
            option_group_id: newGroup.id,
            value: data.values[i],
            display_order: i,
          });
          createdValues.push(value);
        }
      }

      setGroups((prev) => [
        ...prev,
        { group: newGroup, values: createdValues, valueCount: createdValues.length },
      ]);
      toast.success(t("success.groupCreated"));
    } catch (error) {
      console.error("Failed to create variant option group:", error);
      toast.error(t("errors.createFailed"));
      throw error;
    }
  }

  async function handleAddCustomGroup() {
    if (!customName.trim()) return;

    setIsSubmitting(true);
    try {
      await handleCreateGroup({
        name: customName.trim(),
        description: customDescription.trim() || undefined,
      });

      setCustomName("");
      setCustomDescription("");
    } catch (error) {
      console.error("Failed to add custom group:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!confirm(t("confirmDelete", { name: groupName }))) {
      return;
    }

    try {
      await variantOptionsService.deleteTemplateGroup(groupId);
      toast.success(t("success.groupDeleted"));
      loadGroups();
    } catch (error) {
      console.error("Failed to delete group:", error);
      toast.error(t("errors.deleteFailed"));
    }
  }

  function handleRowClick(group: VariantOptionGroupWithValues) {
    setSelectedGroup(selectedGroup === group.group.id ? null : group.group.id);
  }

  async function handleAddValue(groupId: string) {
    const value = newValue[groupId]?.trim();
    if (!value) return;

    try {
      const currentGroup = groups.find((g) => g.group.id === groupId);
      const createdValue = await variantOptionsService.addValueToTemplate({
        option_group_id: groupId,
        value: value,
        display_order: currentGroup?.values.length || 0,
      });

      setGroups((prev) =>
        prev.map((g) =>
          g.group.id === groupId
            ? { ...g, values: [...g.values, createdValue], valueCount: g.valueCount + 1 }
            : g
        )
      );

      setNewValue((prev) => ({ ...prev, [groupId]: "" }));
      toast.success(t("success.valueAdded"));
    } catch (error) {
      console.error("Failed to add value:", error);
      toast.error(t("errors.addValueFailed"));
    }
  }

  async function handleDeleteValue(groupId: string, valueId: string) {
    try {
      await variantOptionsService.deleteTemplateValue(valueId);

      setGroups((prev) =>
        prev.map((g) =>
          g.group.id === groupId
            ? {
                ...g,
                values: g.values.filter((v) => v.id !== valueId),
                valueCount: g.valueCount - 1,
              }
            : g
        )
      );

      toast.success(t("success.valueDeleted"));
    } catch (error) {
      console.error("Failed to delete value:", error);
      toast.error(t("errors.deleteValueFailed"));
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">{t("loading")}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </div>
      </div>

      {/* Groups Table */}
      {groups.length === 0 ? (
        <div className="flex flex-col items-center justify-center rounded-lg border border-dashed py-12">
          <p className="mb-3 text-center text-sm text-muted-foreground">{t("empty")}</p>
        </div>
      ) : (
        <div className="overflow-hidden rounded-lg border">
          <table className="w-full text-sm">
            <thead className="border-b bg-muted/50">
              <tr>
                <th className="px-4 py-2 text-left font-medium">{t("table.name")}</th>
                <th className="px-4 py-2 text-left font-medium">{t("table.description")}</th>
                <th className="w-24 px-4 py-2 text-left font-medium">{t("table.values")}</th>
                <th className="w-24 px-4 py-2 text-right font-medium">{t("table.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {groups.map((item) => (
                <React.Fragment key={item.group.id}>
                  <tr
                    className="cursor-pointer transition-colors hover:bg-muted/30"
                    onClick={() => handleRowClick(item)}
                  >
                    <td className="px-4 py-2 font-medium">{item.group.name}</td>
                    <td className="px-4 py-2 text-muted-foreground">
                      {item.group.description || "—"}
                    </td>
                    <td className="px-4 py-2 text-muted-foreground">{item.valueCount}</td>
                    <td className="px-4 py-2">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7"
                          disabled
                          title={t("actions.edit")}
                          onClick={(e) => e.stopPropagation()}
                        >
                          <Pencil className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="h-7 w-7 text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDeleteGroup(item.group.id, item.group.name);
                          }}
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </td>
                  </tr>
                  {selectedGroup === item.group.id && (
                    <tr>
                      <td colSpan={4} className="bg-muted/20 px-4 py-3">
                        <div className="space-y-3">
                          <div className="flex items-center justify-between">
                            <h4 className="text-xs font-medium uppercase text-muted-foreground">
                              {t("values.title")}
                            </h4>
                          </div>

                          {/* Values display */}
                          {item.values.length === 0 ? (
                            <p className="text-sm text-muted-foreground">{t("values.empty")}</p>
                          ) : (
                            <div className="flex flex-wrap gap-1.5">
                              {item.values.map((value) => (
                                <div
                                  key={value.id}
                                  className="inline-flex items-center gap-1 rounded border bg-background px-2 py-1 text-xs"
                                >
                                  <span>{value.value}</span>
                                  <button
                                    onClick={() => handleDeleteValue(item.group.id, value.id)}
                                    className="ml-1 text-muted-foreground transition-colors hover:text-destructive"
                                    title={t("actions.delete")}
                                  >
                                    <Plus className="h-3 w-3 rotate-45" />
                                  </button>
                                </div>
                              ))}
                            </div>
                          )}

                          {/* Add value input */}
                          <div className="flex gap-2 border-t pt-2">
                            <input
                              type="text"
                              placeholder={t("values.valuePlaceholder")}
                              value={newValue[item.group.id] || ""}
                              onChange={(e) =>
                                setNewValue((prev) => ({
                                  ...prev,
                                  [item.group.id]: e.target.value,
                                }))
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter" && newValue[item.group.id]?.trim()) {
                                  handleAddValue(item.group.id);
                                }
                              }}
                              className="h-8 flex-1 rounded-md border bg-background px-2 text-xs"
                            />
                            <Button
                              size="sm"
                              onClick={() => handleAddValue(item.group.id)}
                              disabled={!newValue[item.group.id]?.trim()}
                              className="h-8 px-3"
                            >
                              <Plus className="mr-1 h-3 w-3" />
                              {t("values.addValue")}
                            </Button>
                          </div>
                        </div>
                      </td>
                    </tr>
                  )}
                </React.Fragment>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Add Custom Group Form */}
      <div className="rounded-lg border bg-muted/20 p-4">
        <div className="space-y-3">
          <div className="flex items-end gap-3">
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("form.groupName")}
              </label>
              <input
                type="text"
                placeholder={t("form.groupNamePlaceholder")}
                value={customName}
                onChange={(e) => setCustomName(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim()) {
                    handleAddCustomGroup();
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <div className="flex-1 space-y-1">
              <label className="text-xs font-medium text-muted-foreground">
                {t("form.description")}
              </label>
              <input
                type="text"
                placeholder={t("form.descriptionPlaceholder")}
                value={customDescription}
                onChange={(e) => setCustomDescription(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && customName.trim()) {
                    handleAddCustomGroup();
                  }
                }}
                className="h-9 w-full rounded-md border bg-background px-3 text-sm"
              />
            </div>
            <Button
              size="sm"
              onClick={handleAddCustomGroup}
              disabled={!customName.trim() || isSubmitting}
              className="h-9"
            >
              <Plus className="mr-1 h-4 w-4" />
              {t("form.add")}
            </Button>
            <Button
              size="sm"
              variant="outline"
              onClick={() => setShowAddDialog(true)}
              className="h-9"
            >
              {t("form.quickPick")}
            </Button>
          </div>
        </div>
      </div>

      {/* Add Group Dialog */}
      <AddVariantOptionDialog
        open={showAddDialog}
        onOpenChange={setShowAddDialog}
        onSubmit={handleCreateGroup}
        existingGroups={groups.map((g) => g.group)}
      />
    </div>
  );
}
