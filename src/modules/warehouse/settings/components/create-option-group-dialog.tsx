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
import { X, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

interface CreateOptionGroupDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: { name: string; values: string[] }) => Promise<void>;
}

export function CreateOptionGroupDialog({
  open,
  onOpenChange,
  onSubmit,
}: CreateOptionGroupDialogProps) {
  const [groupName, setGroupName] = React.useState("");
  const [currentValue, setCurrentValue] = React.useState("");
  const [values, setValues] = React.useState<string[]>([]);
  const [isSubmitting, setIsSubmitting] = React.useState(false);

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
    if (values.some((v) => v.toLowerCase() === trimmedValue.toLowerCase())) {
      return;
    }

    setValues([...values, trimmedValue]);
    setCurrentValue("");
  };

  const handleRemoveValue = (index: number) => {
    setValues(values.filter((_, i) => i !== index));
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      handleAddValue();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!groupName.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: groupName.trim(),
        values,
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
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Add Variant Option Group</DialogTitle>
            <DialogDescription>
              Create a new option group (e.g., Color, Size) and add values to it.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            {/* Group Name */}
            <div className="space-y-2">
              <Label htmlFor="group-name">
                Option Group Name <span className="text-destructive">*</span>
              </Label>
              <Input
                id="group-name"
                placeholder="e.g., Color, Size, Material"
                value={groupName}
                onChange={(e) => setGroupName(e.target.value)}
                autoFocus
              />
              <p className="text-xs text-muted-foreground">
                Examples: Color, Size, Material, Style, Finish
              </p>
            </div>

            {/* Option Values */}
            <div className="space-y-2">
              <Label htmlFor="option-value">Option Values</Label>
              <div className="flex gap-2">
                <Input
                  id="option-value"
                  placeholder="Add a value (e.g., Red, Small)"
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
              <p className="text-xs text-muted-foreground">Press Enter or click + to add a value</p>
            </div>

            {/* Values List */}
            {values.length > 0 && (
              <div className="space-y-2">
                <Label>Added Values ({values.length})</Label>
                <div className="flex flex-wrap gap-2 rounded-md border p-3">
                  {values.map((value, index) => (
                    <Badge key={index} variant="secondary" className="gap-1 pl-2 pr-1">
                      {value}
                      <button
                        type="button"
                        onClick={() => handleRemoveValue(index)}
                        className="ml-1 rounded-sm hover:bg-muted"
                      >
                        <X className="h-3 w-3" />
                      </button>
                    </Badge>
                  ))}
                </div>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {isSubmitting ? "Creating..." : "Create Option Group"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
