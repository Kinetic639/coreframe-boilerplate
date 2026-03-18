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
import { GripVertical, X, Plus } from "lucide-react";
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

interface CreateOptionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; values: string[] }) => Promise<void>;
}

interface SortableValueItemProps {
  id: string;
  value: string;
  onRemove: () => void;
}

function SortableValueItem({ id, value, onRemove }: SortableValueItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id,
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
      <div className="flex flex-1 items-center gap-2">
        <button
          type="button"
          className="cursor-grab touch-none active:cursor-grabbing"
          {...attributes}
          {...listeners}
        >
          <GripVertical className="h-4 w-4 text-muted-foreground" />
        </button>
        <span className="text-sm">{value}</span>
      </div>
      <Button
        type="button"
        size="icon"
        variant="ghost"
        className="h-7 w-7 text-destructive hover:text-destructive"
        onClick={onRemove}
      >
        <X className="h-3.5 w-3.5" />
      </Button>
    </div>
  );
}

export function CreateOptionGroupDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateOptionGroupDialogProps) {
  const [groupName, setGroupName] = React.useState("");
  const [currentValue, setCurrentValue] = React.useState("");
  const [values, setValues] = React.useState<Array<{ id: string; value: string }>>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when dialog opens/closes
  React.useEffect(() => {
    if (!open) {
      setGroupName("");
      setCurrentValue("");
      setValues([]);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleAddValue = () => {
    const trimmedValue = currentValue.trim();
    if (!trimmedValue) return;

    // Check for duplicates (case-insensitive)
    if (values.some((v) => v.value.toLowerCase() === trimmedValue.toLowerCase())) {
      return;
    }

    setValues([...values, { id: Date.now().toString(), value: trimmedValue }]);
    setCurrentValue("");
  };

  const handleRemoveValue = (id: string) => {
    setValues(values.filter((v) => v.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddValue();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setValues((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: groupName.trim(),
        values: values.map((v) => v.value),
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create option group:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit = groupName.trim().length > 0 && !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Variant Option Group</DialogTitle>
          <DialogDescription>
            Create a new option group (e.g., Color, Size) and add values to it.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Group Name */}
          <div className="space-y-2">
            <Label htmlFor="group-name">Option Group Name</Label>
            <Input
              id="group-name"
              placeholder="e.g., Color, Size, Material"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              autoFocus
            />
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
                disabled={!currentValue.trim()}
              >
                <Plus className="h-4 w-4" />
              </Button>
            </div>
          </div>

          {/* Values List with DND */}
          {values.length > 0 && (
            <div className="space-y-2">
              <Label>Current Values ({values.length})</Label>
              <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3">
                <DndContext
                  sensors={sensors}
                  collisionDetection={closestCenter}
                  onDragEnd={handleDragEnd}
                >
                  <SortableContext
                    items={values.map((v) => v.id)}
                    strategy={verticalListSortingStrategy}
                  >
                    {values.map((valueItem) => (
                      <SortableValueItem
                        key={valueItem.id}
                        id={valueItem.id}
                        value={valueItem.value}
                        onRemove={() => handleRemoveValue(valueItem.id)}
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
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create Option Group"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
