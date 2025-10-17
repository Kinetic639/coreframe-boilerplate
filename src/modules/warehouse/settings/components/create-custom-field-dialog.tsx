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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
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

interface CreateCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    field_name: string;
    field_type: string;
    dropdown_options?: string[];
  }) => Promise<void>;
}

interface SortableOptionItemProps {
  id: string;
  value: string;
  onRemove: () => void;
}

function SortableOptionItem({ id, value, onRemove }: SortableOptionItemProps) {
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

export function CreateCustomFieldDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateCustomFieldDialogProps) {
  const [fieldName, setFieldName] = React.useState("");
  const [fieldType, setFieldType] = React.useState<string>("text");
  const [currentOption, setCurrentOption] = React.useState("");
  const [dropdownOptions, setDropdownOptions] = React.useState<
    Array<{ id: string; value: string }>
  >([]);
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
      setFieldName("");
      setFieldType("text");
      setCurrentOption("");
      setDropdownOptions([]);
      setIsSubmitting(false);
    }
  }, [open]);

  const handleAddOption = () => {
    const trimmedOption = currentOption.trim();
    if (!trimmedOption) return;

    // Check for duplicates
    if (dropdownOptions.some((o) => o.value.toLowerCase() === trimmedOption.toLowerCase())) {
      return;
    }

    setDropdownOptions([...dropdownOptions, { id: Date.now().toString(), value: trimmedOption }]);
    setCurrentOption("");
  };

  const handleRemoveOption = (id: string) => {
    setDropdownOptions(dropdownOptions.filter((o) => o.id !== id));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddOption();
    }
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setDropdownOptions((items) => {
        const oldIndex = items.findIndex((item) => item.id === active.id);
        const newIndex = items.findIndex((item) => item.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!fieldName.trim()) return;
    if (fieldType === "dropdown" && dropdownOptions.length === 0) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        field_name: fieldName.trim(),
        field_type: fieldType,
        dropdown_options:
          fieldType === "dropdown" ? dropdownOptions.map((o) => o.value) : undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to create custom field:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const canSubmit =
    fieldName.trim().length > 0 &&
    (fieldType !== "dropdown" || dropdownOptions.length > 0) &&
    !isSubmitting;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Add Custom Field</DialogTitle>
          <DialogDescription>
            Create a custom field to store additional product information.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="field-name">Field Name</Label>
            <Input
              id="field-name"
              placeholder="e.g., Brand, Country of Origin, Material"
              value={fieldName}
              onChange={(e) => setFieldName(e.target.value)}
              autoFocus
            />
          </div>

          {/* Field Type */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select value={fieldType} onValueChange={setFieldType}>
              <SelectTrigger id="field-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="text">Text field</SelectItem>
                <SelectItem value="dropdown">Drop-down</SelectItem>
                <SelectItem value="date">Date field</SelectItem>
                <SelectItem value="checkbox">Checkbox</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Dropdown Options (only show for dropdown type) */}
          {fieldType === "dropdown" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="add-option">Manage drop-down options</Label>
                <div className="flex gap-2">
                  <Input
                    id="add-option"
                    placeholder="Add an option"
                    value={currentOption}
                    onChange={(e) => setCurrentOption(e.target.value)}
                    onKeyDown={handleKeyDown}
                  />
                  <Button
                    type="button"
                    variant="outline"
                    size="icon"
                    onClick={handleAddOption}
                    disabled={!currentOption.trim()}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              {dropdownOptions.length > 0 && (
                <div className="space-y-2">
                  <Label>Options ({dropdownOptions.length})</Label>
                  <div className="max-h-64 space-y-1 overflow-y-auto rounded-md border p-3">
                    <DndContext
                      sensors={sensors}
                      collisionDetection={closestCenter}
                      onDragEnd={handleDragEnd}
                    >
                      <SortableContext
                        items={dropdownOptions.map((o) => o.id)}
                        strategy={verticalListSortingStrategy}
                      >
                        {dropdownOptions.map((option) => (
                          <SortableOptionItem
                            key={option.id}
                            id={option.id}
                            value={option.value}
                            onRemove={() => handleRemoveOption(option.id)}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                </div>
              )}
            </>
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleSubmit} disabled={!canSubmit}>
            {isSubmitting ? "Creating..." : "Create Field"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
