"use client";

import * as React from "react";
import { useAppStore } from "@/lib/stores/app-store";
import { optionGroupsService } from "../../api/option-groups-service";
import { Button } from "@/components/ui/button";
import { Plus, Pencil, Trash2, ChevronDown, ChevronRight } from "lucide-react";
import { CreateOptionGroupDialog } from "./create-option-group-dialog";
import { EditOptionGroupDialog } from "./edit-option-group-dialog";
import { toast } from "react-toastify";
import type { OptionGroupWithValues } from "../../types/option-groups";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";

export function VariantOptionsPage() {
  const { activeOrgId } = useAppStore();
  const [groups, setGroups] = React.useState<OptionGroupWithValues[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [showCreateDialog, setShowCreateDialog] = React.useState(false);
  const [editingGroup, setEditingGroup] = React.useState<OptionGroupWithValues | null>(null);
  const [expandedGroups, setExpandedGroups] = React.useState<Set<string>>(new Set());

  React.useEffect(() => {
    if (activeOrgId) {
      loadGroups();
    }
  }, [activeOrgId]);

  async function loadGroups() {
    if (!activeOrgId) return;

    try {
      setIsLoading(true);
      const data = await optionGroupsService.getOptionGroups(activeOrgId);
      setGroups(data);
      // Auto-expand all groups on initial load
      setExpandedGroups(new Set(data.map((g) => g.id)));
    } catch (error) {
      console.error("Failed to load option groups:", error);
      toast.error("Failed to load variant option groups");
    } finally {
      setIsLoading(false);
    }
  }

  const toggleGroupExpanded = (groupId: string) => {
    setExpandedGroups((prev) => {
      const next = new Set(prev);
      if (next.has(groupId)) {
        next.delete(groupId);
      } else {
        next.add(groupId);
      }
      return next;
    });
  };

  async function handleCreateGroup(data: { name: string; values: string[] }) {
    if (!activeOrgId) return;

    try {
      const newGroup = await optionGroupsService.createOptionGroup({
        organization_id: activeOrgId,
        name: data.name,
        values: data.values.map((v, index) => ({ value: v, display_order: index })),
      });

      setGroups((prev) => [...prev, newGroup]);
      setExpandedGroups((prev) => new Set([...prev, newGroup.id]));
      toast.success("Option group created successfully");
    } catch (error) {
      console.error("Failed to create option group:", error);
      toast.error("Failed to create option group");
      throw error;
    }
  }

  async function handleUpdateGroup(groupId: string, name: string) {
    try {
      const updatedGroup = await optionGroupsService.updateOptionGroup({
        id: groupId,
        name,
      });

      setGroups((prev) => prev.map((g) => (g.id === groupId ? updatedGroup : g)));
      toast.success("Option group updated");
    } catch (error) {
      console.error("Failed to update option group:", error);
      toast.error("Failed to update option group");
      throw error;
    }
  }

  async function handleAddValue(groupId: string, value: string) {
    try {
      await optionGroupsService.createOptionValue({
        option_group_id: groupId,
        value,
        display_order: 0,
      });

      // Reload the specific group
      const updatedGroup = await optionGroupsService.getOptionGroup(groupId);
      if (updatedGroup) {
        setGroups((prev) => prev.map((g) => (g.id === groupId ? updatedGroup : g)));
      }
      toast.success("Value added");
    } catch (error) {
      console.error("Failed to add value:", error);
      toast.error("Failed to add value");
      throw error;
    }
  }

  async function handleUpdateValue(valueId: string, value: string) {
    try {
      await optionGroupsService.updateOptionValue({
        id: valueId,
        value,
      });

      // Reload groups to get updated data
      await loadGroups();
      toast.success("Value updated");
    } catch (error) {
      console.error("Failed to update value:", error);
      toast.error("Failed to update value");
      throw error;
    }
  }

  async function handleDeleteValue(valueId: string) {
    try {
      await optionGroupsService.deleteOptionValue(valueId);

      // Reload groups to get updated data
      await loadGroups();
      toast.success("Value deleted");
    } catch (error) {
      console.error("Failed to delete value:", error);
      toast.error("Failed to delete value");
      throw error;
    }
  }

  async function handleDeleteGroup(groupId: string, groupName: string) {
    if (!confirm(`Are you sure you want to delete "${groupName}"?`)) {
      return;
    }

    try {
      await optionGroupsService.deleteOptionGroup(groupId);
      setGroups((prev) => prev.filter((g) => g.id !== groupId));
      toast.success("Option group deleted");
    } catch (error) {
      console.error("Failed to delete option group:", error);
      toast.error("Failed to delete option group");
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="flex h-32 items-center justify-center">
          <p className="text-sm text-muted-foreground">Loading...</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-semibold">Variant Option Groups</h1>
          <p className="text-sm text-muted-foreground">
            Manage option groups for product variants (color, size, material, etc.)
          </p>
        </div>
        <Button onClick={() => setShowCreateDialog(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Add Option Group
        </Button>
      </div>

      {/* Option Groups List */}
      {groups.length === 0 ? (
        <Card className="flex flex-col items-center justify-center py-12">
          <p className="mb-3 text-center text-sm text-muted-foreground">
            No option groups yet. Create your first option group to manage product variants.
          </p>
          <Button variant="outline" onClick={() => setShowCreateDialog(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Create First Option Group
          </Button>
        </Card>
      ) : (
        <div className="space-y-3">
          {groups.map((group) => {
            const isExpanded = expandedGroups.has(group.id);

            return (
              <Card key={group.id} className="overflow-hidden">
                <div className="flex items-center gap-3 p-4">
                  {/* Expand/Collapse Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => toggleGroupExpanded(group.id)}
                  >
                    {isExpanded ? (
                      <ChevronDown className="h-4 w-4" />
                    ) : (
                      <ChevronRight className="h-4 w-4" />
                    )}
                  </Button>

                  {/* Group Info */}
                  <div className="flex-1">
                    <div className="flex items-center gap-2">
                      <h3 className="font-medium">{group.name}</h3>
                      <Badge variant="secondary" className="text-xs">
                        {group.values.length} {group.values.length === 1 ? "value" : "values"}
                      </Badge>
                    </div>

                    {/* Values Preview (when collapsed) */}
                    {!isExpanded && group.values.length > 0 && (
                      <div className="mt-1 flex flex-wrap gap-1">
                        {group.values.slice(0, 5).map((value) => (
                          <Badge key={value.id} variant="outline" className="text-xs">
                            {value.value}
                          </Badge>
                        ))}
                        {group.values.length > 5 && (
                          <Badge variant="outline" className="text-xs">
                            +{group.values.length - 5} more
                          </Badge>
                        )}
                      </div>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-1">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8"
                      onClick={() => setEditingGroup(group)}
                    >
                      <Pencil className="h-3.5 w-3.5" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive"
                      onClick={() => handleDeleteGroup(group.id, group.name)}
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </Button>
                  </div>
                </div>

                {/* Expanded Values List */}
                {isExpanded && group.values.length > 0 && (
                  <div className="border-t bg-muted/20 px-4 py-3">
                    <div className="flex flex-wrap gap-2">
                      {group.values.map((value) => (
                        <Badge key={value.id} variant="secondary">
                          {value.value}
                        </Badge>
                      ))}
                    </div>
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      )}

      {/* Create Dialog */}
      <CreateOptionGroupDialog
        open={showCreateDialog}
        onOpenChange={setShowCreateDialog}
        onSubmit={handleCreateGroup}
      />

      {/* Edit Dialog */}
      <EditOptionGroupDialog
        open={!!editingGroup}
        onOpenChange={(open) => !open && setEditingGroup(null)}
        group={editingGroup}
        onUpdateGroup={handleUpdateGroup}
        onAddValue={handleAddValue}
        onUpdateValue={handleUpdateValue}
        onDeleteValue={handleDeleteValue}
      />
    </div>
  );
}
