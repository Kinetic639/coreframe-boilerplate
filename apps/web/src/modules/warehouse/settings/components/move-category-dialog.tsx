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
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { CategoryTreeItem } from "../../types/categories";
import { useTranslations } from "next-intl";

interface MoveCategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (targetParentId: string | null) => Promise<void>;
  category: CategoryTreeItem | null;
  allCategories: CategoryTreeItem[];
}

export function MoveCategoryDialog({
  open,
  onOpenChange,
  onSubmit,
  category,
  allCategories,
}: MoveCategoryDialogProps) {
  const t = useTranslations("modules.warehouse.items.settings.categories");
  const [selectedParentId, setSelectedParentId] = React.useState<string>("none");
  const [isSubmitting, setIsSubmitting] = React.useState(false);

  React.useEffect(() => {
    if (open && category) {
      setSelectedParentId(category.parent_id || "none");
    }
  }, [open, category]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();

    setIsSubmitting(true);
    try {
      await onSubmit(selectedParentId === "none" ? null : selectedParentId);
      onOpenChange(false);
    } catch (error) {
      console.error("Failed to move category:", error);
    } finally {
      setIsSubmitting(false);
    }
  }

  // Flatten categories for selection, excluding current category and its children
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
      // Don't show current category or its children as options
      if (category && (cat.id === category.id || isDescendant(cat, category.id))) {
        return;
      }

      const displayName = prefix + cat.name;
      result.push({ id: cat.id, name: displayName, level: cat.level });

      if (cat.children && cat.children.length > 0) {
        result.push(...flattenCategories(cat.children, displayName + " > "));
      }
    });

    return result;
  };

  // Check if a category is a descendant of the given categoryId
  const isDescendant = (cat: CategoryTreeItem, categoryId: string): boolean => {
    if (cat.parent_id === categoryId) return true;
    if (!cat.parent_id) return false;

    // Find parent and check recursively
    const findAndCheck = (categories: CategoryTreeItem[]): boolean => {
      for (const c of categories) {
        if (c.id === cat.parent_id) {
          return isDescendant(c, categoryId);
        }
        if (c.children && c.children.length > 0) {
          if (findAndCheck(c.children)) return true;
        }
      }
      return false;
    };

    return findAndCheck(allCategories);
  };

  const flatCategories = flattenCategories(allCategories);

  if (!category) return null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{t("moveCategory")}</DialogTitle>
          <DialogDescription>
            {t("moveCategoryDescription", { name: category.name })}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="target">{t("form.targetParent")}</Label>
            <Select
              value={selectedParentId}
              onValueChange={setSelectedParentId}
              disabled={isSubmitting}
            >
              <SelectTrigger className="w-full">
                <SelectValue placeholder={t("form.selectTarget")} />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="none">{t("topLevel")}</SelectItem>
                {flatCategories.map((cat) => (
                  <SelectItem key={cat.id} value={cat.id}>
                    {cat.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting ? t("form.moving") : t("form.move")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
