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
import { GripVertical, X, Plus, Pencil, Check } from "lucide-react";
import type { OptionGroupWithValues, VariantOptionValue } from "../../types/option-groups";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  useSortable,
  verticalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";

interface EditOptionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  group: OptionGroupWithValues | null;
  onUpdateGroup: (groupId: string, name: string) => Promise<void>;
  onAddValue: (groupId: string, value: string) => Promise<void>;
  onUpdateValue: (valueId: string, value: string) => Promise<void>;
  onDeleteValue: (valueId: string) => Promise<void>;
  onReorderValues?: (groupId: string, valueIds: string[]) => Promise<void>;
}

interface SortableValueItemProps {
  value: VariantOptionValue;
  isEditing: boolean;
  editingText: string;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditText: (text: string) => void;
  onDelete: () => void;
  isSubmitting: boolean;
}

function SortableValueItem({
  value,
  isEditing,
  editingText,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditText,
  onDelete,
  isSubmitting,
}: SortableValueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: value.id,
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="flex items-center justify-between gap-2 rounded-sm border bg-background px-2 py-1.5 hover:bg-muted/50"
    >
      {isEditing ? (
        <div className="flex flex-1 items-center gap-2">
          <Input
            value={editingText}
            onChange={(e) => onChangeEditText(e.target.value)}
            className="h-7 text-sm"
            autoFocus
          />
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onSaveEdit}
            disabled={!editingText.trim() || isSubmitting}
          >
            <Check className="h-3.5 w-3.5" />
          </Button>
          <Button
            type="button"
            size="icon"
            variant="ghost"
            className="h-7 w-7"
            onClick={onCancelEdit}
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <>
          <div className="flex flex-1 items-center gap-2">
            <button
              type="button"
              className="cursor-grab touch-none active:cursor-grabbing"
              {...attributes}
              {...listeners}
            >
              <GripVertical className="h-4 w-4 text-muted-foreground" />
            </button>
            <span className="text-sm">{value.value}</span>
          </div>
          <div className="flex gap-1">
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7"
              onClick={onEdit}
              disabled={isSubmitting}
            >
              <Pencil className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-destructive hover:text-destructive"
              onClick={onDelete}
              disabled={isSubmitting}
            >
              <X className="h-3.5 w-3.5" />
            </Button>
          </div>
        </>
      )}
    </div>
  );
}

export function EditOptionGroupDialog({
  open,
  onOpenChange,
  group,
  onUpdateGroup,
  onAddValue,
  onUpdateValue,
  onDeleteValue,
  onReorderValues,
}: EditOptionGroupDialogProps) {
  const [groupName, setGroupName] = React.useState("");
  const [currentValue, setCurrentValue] = React.useState("");
  const [editingValueId, setEditingValueId] = React.useState<string | null>(null);
  const [editingValueText, setEditingValueText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);
  const [localValues, setLocalValues] = React.useState<VariantOptionValue[]>([]);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when group changes or dialog opens/closes
  React.useEffect(() => {
    if (group && open) {
      setGroupName(group.name);
      setLocalValues(group.values);
    } else {
      setGroupName("");
      setCurrentValue("");
      setEditingValueId(null);
      setEditingValueText("");
      setIsSubmitting(false);
      setLocalValues([]);
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
    if (localValues.some((v) => v.value.toLowerCase() === currentValue.trim().toLowerCase())) {
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

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = localValues.findIndex((item) => item.id === active.id);
      const newIndex = localValues.findIndex((item) => item.id === over.id);
      const newValues = arrayMove(localValues, oldIndex, newIndex);

      setLocalValues(newValues);

      // Update display_order in the database if callback provided
      if (group && onReorderValues) {
        try {
          await onReorderValues(
            group.id,
            newValues.map((v) => v.id)
          );
        } catch (error) {
          console.error("Failed to reorder values:", error);
          // Revert on error
          setLocalValues(localValues);
        }
      }
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

          {/* Values List with DND */}
          {localValues.length > 0 && (
            <div className="space-y-2">
              <Label>Current Values ({localValues.length})</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={localValues.map((v) => v.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {localValues.map((value) => (
                      <SortableValueItem
                        key={value.id}
                        value={value}
                        isEditing={editingValueId === value.id}
                        editingText={editingValueText}
                        onEdit={() => handleStartEditValue(value)}
                        onSaveEdit={handleSaveEditValue}
                        onCancelEdit={handleCancelEditValue}
                        onChangeEditText={setEditingValueText}
                        onDelete={() => handleDeleteValue(value.id, value.value)}
                        isSubmitting={isSubmitting}
                      />
                    ))}
                  </SortableContext>
                </DndContext>
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
