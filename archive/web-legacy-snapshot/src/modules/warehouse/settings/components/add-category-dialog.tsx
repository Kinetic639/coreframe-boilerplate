"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryTreeItem } from "../../types/categories";
import { useTranslations } from "next-intl";

interface AddCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (data: {
    name: string;
    description?: string;
    parent_id?: string;
    icon_name?: string;
    color?: string;
  }) => Promise<void>;
  categories: CategoryTreeItem[];
  parentCategory?: CategoryTreeItem;
  editCategory?: CategoryTreeItem;
}

export function AddCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  categories,
  parentCategory,
  editCategory,
}: AddCategoryDialogProps) {
  const t = useTranslations("modules.warehouse.items.settings.categories");
  const [name, setName] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [selectedParentId, setSelectedParentId] = React.useState<string>("");
  const [color, setColor] = React.useState("");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open) {
      if (editCategory) {
        setName(editCategory.name);
        setDescription(editCategory.description || "");
        setSelectedParentId(editCategory.parent_id || "");
        setColor(editCategory.color || "");
      } else {
        setName("");
        setDescription("");
        setSelectedParentId(parentCategory?.id || "");
        setColor("");
      }
    }
  }, [open, editCategory, parentCategory]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!name.trim()) return;

    setIsSubmitting(true);
    try {
      await onSubmit({
        name: name.trim(),
        description: description.trim() || undefined,
        parent_id: selectedParentId || undefined,
        color: color || undefined,
      });
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to save category:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Flatten categories for parent selection
  const flattenCategories = (
    cats: CategoryTreeItem[],
    prefix = ""
  ): Array<{
    id: string;
    name: string;
    level: number;
  }> => {
    const result: Array<{ id: string; name: string; level: number }> = [];

    cats.forEach((cat) => {
      // Don't show current category or its children as parent options when editing
      if (editCategory && cat.id === editCategory.id) return;

      const displayName = prefix + cat.name;
      result.push({ id: cat.id, name: displayName, level: cat.level });

      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, displayName + " > "));
      }
    });

    return result;
  };

  const flatCategories = flattenCategories(categories.filter((c) => !c.is_default));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>
            {editCategory
              ? t("form.editCategory")
              : parentCategory
                ? t("addSubcategory")
                : t("addCategory")}
          </DialogTitle>
          <DialogDescription>
            {editCategory ? t("form.editDescription") : t("form.addDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="name">{t("form.name")}</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("form.namePlaceholder")}
              required
              disabled={isSubmitting}
            />
          </div>

          <div className="space-y-2">
            <Label htmlFor="description">{t("form.description")}</Label>
            <Textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={t("form.descriptionPlaceholder")}
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {!parentCategory && !editCategory && (
            <div className="space-y-2">
              <Label htmlFor="parent">{t("form.parentCategory")}</Label>
              <Select
                value={selectedParentId || "none"}
                onValueChange={(value) => setSelectedParentId(value === "none" ? "" : value)}
              >
                <SelectTrigger className="w-full">
                  <SelectValue placeholder={t("form.parentCategoryPlaceholder")} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">{t("rootCategory")}</SelectItem>
                  {flatCategories.map((cat) => (
                    <SelectItem key={cat.id} value={cat.id}>
                      {cat.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="space-y-2">
            <Label htmlFor="color">{t("form.color")}</Label>
            <div className="flex gap-2">
              <Input
                id="color"
                type="color"
                value={color || "#6366f1"}
                onChange={(e) => setColor(e.target.value)}
                className="h-10 w-20 cursor-pointer p-1"
                disabled={isSubmitting}
              />
              <Input
                value={color}
                onChange={(e) => setColor(e.target.value)}
                placeholder={t("form.colorPlaceholder")}
                disabled={isSubmitting}
              />
            </div>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting || !name.trim()}>
              {isSubmitting ? t("form.saving") : editCategory ? t("form.save") : t("form.add")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
