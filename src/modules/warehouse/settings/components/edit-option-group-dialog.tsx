"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { X, Plus, Pencil, Check } from "lucide-react";
import type { OptionGroupWithValues, VariantOptionValue } from "../../types/option-groups";

interface EditOptionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: OptionGroupWithValues | null;
  onUpdateGroup: (groupId: string, name: string) => Promise<void>;
  onAddValue: (groupId: string, value: string) => Promise<void>;
  onUpdateValue: (valueId: string, value: string) => Promise<void>;
  onDeleteValue: (valueId: string) => Promise<void>;
}

export function EditOptionGroupDialog({
  open,
  onOpenChange,
  group,
  onUpdateGroup,
  onAddValue,
  onUpdateValue,
  onDeleteValue,
}: EditOptionGroupDialogProps) {
  const [groupName, setGroupName] = React.useState("");
  const [currentValue, setCurrentValue] = React.useState("");
  const [editingValueId, setEditingValueId] = React.useState<string | null>(null);
  const [editingValueText, setEditingValueText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  // Reset form when group changes or dialog opens/closes
  React.useEffect(() => {
    if (group && open) {
      setGroupName(group.name);
    } else {
      setGroupName("");
      setCurrentValue("");
      setEditingValueId(null);
      setEditingValueText("");
      setIsSubmitting(false);
    }
  }, [group, open]);

  const handleUpdateGroupName = async () => {
    if (!group || !groupName.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdateGroup(group.id, groupName.trim());
    } catch (error) {
      console.error("Failed to update group name:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddValue = async () => {
    if (!group || !currentValue.trim()) return;

    // Check for duplicates
    if (group.values.some((v) => v.value.toLowerCase() === currentValue.trim().toLowerCase())) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onAddValue(group.id, currentValue.trim());
      setCurrentValue("");
    } catch (error) {
      console.error("Failed to add value:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleStartEditValue = (value: VariantOptionValue) => {
    setEditingValueId(value.id);
    setEditingValueText(value.value);
  };

  const handleSaveEditValue = async () => {
    if (!editingValueId || !editingValueText.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdateValue(editingValueId, editingValueText.trim());
      setEditingValueId(null);
      setEditingValueText("");
    } catch (error) {
      console.error("Failed to update value:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCancelEditValue = () => {
    setEditingValueId(null);
    setEditingValueText("");
  };

  const handleDeleteValue = async (valueId: string, valueName: string) => {
    if (!confirm(`Are you sure you want to delete "${valueName}"?`)) {
      return;
    }

    setIsSubmitting(true);
    try {
      await onDeleteValue(valueId);
    } catch (error) {
      console.error("Failed to delete value:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddValue();
    }
  };

  if (!group) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Option Group</DialogTitle>
          <DialogDescription>Update the option group name and manage its values.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-group-name">Option Group Name</Label>
            <div className="flex gap-2">
              <Input
                id="edit-group-name"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleUpdateGroupName}
                disabled={!groupName.trim() || groupName === group.name || isSubmitting}
              >
                Update
              </Button>
            </div>
          </div>

          {/* Add New Value */}
          <div className="space-y-2">
            <Label htmlFor="add-value">Add New Value</Label>
            <div className="flex gap-2">
              <Input
                id="add-value"
                placeholder="Add a value"
                value={currentValue}
                onChange={(e) => setCurrentValue(e.target.value)}
                onKeyDown={handleKeyDown}
              />
              <Button
                type="button"
                variant="outline"
                size="icon"
                onClick={handleAddValue}
                disabled={!currentValue.trim() || isSubmitting}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Values List */}
          {group.values.length > 0 && (
            <div className="space-y-2">
              <Label>Current Values ({group.values.length})</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3">
                {group.values.map((value) => (
                  <div
                    key={value.id}
                    className="flex items-center justify-between gap-2 rounded-sm px-2 py-1 hover:bg-muted/50"
                  >
                    {editingValueId === value.id ? (
                      <div className="flex flex-1 items-center gap-2">
                        <Input
                          value={editingValueText}
                          onChange={(e) => setEditingValueText(e.target.value)}
                          className="h-7 text-sm"
                          autoFocus
                        />
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={handleSaveEditValue}
                          disabled={!editingValueText.trim() || isSubmitting}
                        >
                          <Check className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          type="button"
                          size="icon"
                          variant="ghost"
                          className="h-7 w-7"
                          onClick={handleCancelEditValue}
                        >
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    ) : (
                      <>
                        <span className="flex-1 text-sm">{value.value}</span>
                        <div className="flex gap-1">
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7"
                            onClick={() => handleStartEditValue(value)}
                            disabled={isSubmitting}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            type="button"
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => handleDeleteValue(value.id, value.value)}
                            disabled={isSubmitting}
                          >
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      </>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
