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
import { GripVertical, X, Plus, Pencil, Check } from "lucide-react";
import type { CustomFieldDefinition } from "../../types/custom-fields";
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

interface EditCustomFieldDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  field: CustomFieldDefinition | null;
  onUpdate: (
    fieldId: string,
    updates: { field_name?: string; dropdown_options?: string[] }
  ) => Promise<void>;
}

interface SortableOptionItemProps {
  option: { id: string; value: string };
  isEditing: boolean;
  editingText: string;
  onEdit: () => void;
  onSaveEdit: () => void;
  onCancelEdit: () => void;
  onChangeEditText: (text: string) => void;
  onDelete: () => void;
  isSubmitting: boolean;
}

function SortableOptionItem({
  option,
  isEditing,
  editingText,
  onEdit,
  onSaveEdit,
  onCancelEdit,
  onChangeEditText,
  onDelete,
  isSubmitting,
}: SortableOptionItemProps) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: option.id,
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
            <span className="text-sm">{option.value}</span>
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

export function EditCustomFieldDialog({
  open,
  onOpenChange,
  field,
  onUpdate,
}: EditCustomFieldDialogProps) {
  const [fieldName, setFieldName] = React.useState("");
  const [currentOption, setCurrentOption] = React.useState("");
  const [dropdownOptions, setDropdownOptions] = React.useState<
    Array<{ id: string; value: string }>
  >([]);
  const [editingOptionId, setEditingOptionId] = React.useState<string | null>(null);
  const [editingOptionText, setEditingOptionText] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  // Reset form when field changes or dialog opens/closes
  React.useEffect(() => {
    if (field && open) {
      setFieldName(field.field_name);
      if (field.field_type === "dropdown" && field.dropdown_options) {
        const options =
          typeof field.dropdown_options === "string"
            ? JSON.parse(field.dropdown_options)
            : field.dropdown_options;
        setDropdownOptions(
          (options as string[]).map((opt, index) => ({
            id: `${index}-${opt}`,
            value: opt,
          }))
        );
      }
    } else {
      setFieldName("");
      setCurrentOption("");
      setDropdownOptions([]);
      setEditingOptionId(null);
      setEditingOptionText("");
      setIsSubmitting(false);
    }
  }, [field, open]);

  const handleUpdateFieldName = async () => {
    if (!field || !fieldName.trim()) return;

    setIsSubmitting(true);
    try {
      await onUpdate(field.id, { field_name: fieldName.trim() });
    } catch (error) {
      console.error("Failed to update field name:", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddOption = () => {
    const trimmedOption = currentOption.trim();
    if (!trimmedOption) return;

    if (dropdownOptions.some((o) => o.value.toLowerCase() === trimmedOption.toLowerCase())) {
      return;
    }

    setDropdownOptions([...dropdownOptions, { id: Date.now().toString(), value: trimmedOption }]);
    setCurrentOption("");
  };

  const handleStartEditOption = (option: { id: string; value: string }) => {
    setEditingOptionId(option.id);
    setEditingOptionText(option.value);
  };

  const handleSaveEditOption = () => {
    if (!editingOptionId || !editingOptionText.trim()) return;

    setDropdownOptions(
      dropdownOptions.map((o) =>
        o.id === editingOptionId ? { ...o, value: editingOptionText.trim() } : o
      )
    );
    setEditingOptionId(null);
    setEditingOptionText("");
  };

  const handleCancelEditOption = () => {
    setEditingOptionId(null);
    setEditingOptionText("");
  };

  const handleRemoveOption = (id: string) => {
    setDropdownOptions(dropdownOptions.filter((o) => o.id !== id));
  };

  const handleSaveOptions = async () => {
    if (!field) return;

    setIsSubmitting(true);
    try {
      await onUpdate(field.id, {
        dropdown_options: dropdownOptions.map((o) => o.value),
      });
    } catch (error) {
      console.error("Failed to update options:", error);
    } finally {
      setIsSubmitting(false);
    }
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
      const oldIndex = dropdownOptions.findIndex((item) => item.id === active.id);
      const newIndex = dropdownOptions.findIndex((item) => item.id === over.id);
      setDropdownOptions(arrayMove(dropdownOptions, oldIndex, newIndex));
    }
  };

  if (!field) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-lg">
        <DialogHeader>
          <DialogTitle>Edit Custom Field</DialogTitle>
          <DialogDescription>Update the field name and manage its options.</DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-4">
          {/* Field Name */}
          <div className="space-y-2">
            <Label htmlFor="edit-field-name">Field Name</Label>
            <div className="flex gap-2">
              <Input
                id="edit-field-name"
                value={fieldName}
                onChange={(e) => setFieldName(e.target.value)}
              />
              <Button
                type="button"
                variant="outline"
                onClick={handleUpdateFieldName}
                disabled={!fieldName.trim() || fieldName === field.field_name || isSubmitting}
              >
                Update
              </Button>
            </div>
          </div>

          {/* Field Type (read-only) */}
          <div className="space-y-2">
            <Label htmlFor="field-type">Field Type</Label>
            <Select value={field.field_type} disabled>
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
            <p className="text-xs text-muted-foreground">Field type cannot be changed</p>
          </div>

          {/* Dropdown Options Management */}
          {field.field_type === "dropdown" && (
            <>
              <div className="space-y-2">
                <Label htmlFor="add-option">Add New Option</Label>
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
                  <Label>Current Options ({dropdownOptions.length})</Label>
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
                            option={option}
                            isEditing={editingOptionId === option.id}
                            editingText={editingOptionText}
                            onEdit={() => handleStartEditOption(option)}
                            onSaveEdit={handleSaveEditOption}
                            onCancelEdit={handleCancelEditOption}
                            onChangeEditText={setEditingOptionText}
                            onDelete={() => handleRemoveOption(option.id)}
                            isSubmitting={isSubmitting}
                          />
                        ))}
                      </SortableContext>
                    </DndContext>
                  </div>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={handleSaveOptions}
                    disabled={isSubmitting}
                    className="w-full"
                  >
                    Save Options
                  </Button>
                </div>
              )}
            </>
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
