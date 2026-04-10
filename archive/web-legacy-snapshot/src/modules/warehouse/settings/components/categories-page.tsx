"use client";

import * as React from "react";
import { Button } from "@/components/ui/button";
import { Plus, GripVertical } from "lucide-react";
import { useTranslations } from "next-intl";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import { categoriesService } from "../../api/categories-service";
import type { CategoryTreeItem, DeleteCategoryInfo } from "../../types/categories";
import { AddCategoryDialog } from "./add-category-dialog";
import { MoveCategoryDialog } from "./move-category-dialog";
import { DraggableCategoryTree } from "./draggable-category-tree";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

export function CategoriesPage() {
  const t = useTranslations("modules.warehouse.items.settings.categories");
  const { activeOrgId } = useAppStore();

  const [categories, setCategories] = React.useState<CategoryTreeItem[]>([]);
  const [isLoading, setIsLoading] = React.useState(true);
  const [addDialogOpen, setAddDialogOpen] = React.useState(false);
  const [editCategory, setEditCategory] = React.useState<CategoryTreeItem | undefined>();
  const [parentForNew, setParentForNew] = React.useState<CategoryTreeItem | undefined>();
  const [deleteDialogOpen, setDeleteDialogOpen] = React.useState(false);
  const [deleteInfo, setDeleteInfo] = React.useState<DeleteCategoryInfo | null>(null);
  const [categoryToDelete, setCategoryToDelete] = React.useState<CategoryTreeItem | null>(null);
  const [moveDialogOpen, setMoveDialogOpen] = React.useState(false);
  const [categoryToMove, setCategoryToMove] = React.useState<CategoryTreeItem | null>(null);

  React.useEffect(() => {
    if (activeOrgId) {
      loadCategories();
    }
  }, [activeOrgId]);

  async function loadCategories() {
    if (!activeOrgId) return;

    setIsLoading(true);
    try {
      const data = await categoriesService.getCategories(activeOrgId);
      setCategories(data);
    } catch (error) {
      console.error("Failed to load categories:", error);
      toast.error(t("errors.loadFailed"));
    } finally {
      setIsLoading(false);
    }
  }

  async function handleCreateCategory(data: {
    name: string;
    description?: string;
    parent_id?: string;
    icon_name?: string;
    color?: string;
  }) {
    if (!activeOrgId) return;

    try {
      await categoriesService.createCategory({
        organization_id: activeOrgId,
        name: data.name,
        description: data.description,
        parent_id: data.parent_id,
        icon_name: data.icon_name,
        color: data.color,
      });
      toast.success(t("success.created"));
      await loadCategories();
      setParentForNew(undefined);
    } catch (error) {
      console.error("Failed to create category:", error);
      toast.error(t("errors.createFailed"));
      throw error;
    }
  }

  async function handleUpdateCategory(data: {
    name: string;
    description?: string;
    icon_name?: string;
    color?: string;
  }) {
    if (!editCategory) return;

    try {
      await categoriesService.updateCategory(editCategory.id, {
        id: editCategory.id,
        name: data.name,
        description: data.description,
        icon_name: data.icon_name,
        color: data.color,
      });
      toast.success(t("success.updated"));
      await loadCategories();
      setEditCategory(undefined);
    } catch (error) {
      console.error("Failed to update category:", error);
      toast.error(t("errors.updateFailed"));
      throw error;
    }
  }

  async function handleDeleteClick(category: CategoryTreeItem) {
    try {
      // Check if it's the default category
      if (category.is_default) {
        toast.error(t("errors.cannotDeleteDefault"));
        return;
      }

      // Get deletion info
      const info = await categoriesService.checkDeletion(category.id);
      setDeleteInfo(info);
      setCategoryToDelete(category);
      setDeleteDialogOpen(true);
    } catch (error: any) {
      console.error("Failed to check category deletion:", error);
      if (error.message === "Cannot delete default category") {
        toast.error(t("errors.cannotDeleteDefault"));
      } else {
        toast.error(t("errors.deleteFailed"));
      }
    }
  }

  async function confirmDelete() {
    if (!categoryToDelete) return;

    try {
      await categoriesService.deleteCategory(categoryToDelete.id);
      toast.success(t("success.deleted"));
      await loadCategories();
      setDeleteDialogOpen(false);
      setCategoryToDelete(null);
      setDeleteInfo(null);
    } catch (error) {
      console.error("Failed to delete category:", error);
      toast.error(t("errors.deleteFailed"));
    }
  }

  function handleEdit(category: CategoryTreeItem) {
    setEditCategory(category);
    setParentForNew(undefined);
    setAddDialogOpen(true);
  }

  function handleAddChild(parentCategory: CategoryTreeItem) {
    setParentForNew(parentCategory);
    setEditCategory(undefined);
    setAddDialogOpen(true);
  }

  function handleAddRoot() {
    setParentForNew(undefined);
    setEditCategory(undefined);
    setAddDialogOpen(true);
  }

  function handleDialogClose() {
    setAddDialogOpen(false);
    setEditCategory(undefined);
    setParentForNew(undefined);
  }

  function handleMove(category: CategoryTreeItem) {
    setCategoryToMove(category);
    setMoveDialogOpen(true);
  }

  async function handleMoveSubmit(targetParentId: string | null) {
    if (!categoryToMove) return;

    try {
      await categoriesService.moveCategory(categoryToMove.id, targetParentId);
      toast.success(t("success.moved"));
      await loadCategories();
    } catch (error: any) {
      console.error("Failed to move category:", error);
      if (error.message?.includes("descendant")) {
        toast.error(t("errors.cannotMoveToDescendant"));
      } else {
        toast.error(t("errors.moveFailed"));
      }
      throw error;
    }
  }

  async function handleTogglePreferred(category: CategoryTreeItem) {
    try {
      const newStatus = await categoriesService.togglePreferred(category.id);
      toast.success(newStatus ? t("success.markedPreferred") : t("success.unmarkedPreferred"));
      await loadCategories();
    } catch (error) {
      console.error("Failed to toggle preferred:", error);
      toast.error(t("errors.togglePreferredFailed"));
    }
  }

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="text-sm text-muted-foreground">{t("loading")}</div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">{t("title")}</h2>
          <p className="mt-1 text-sm text-muted-foreground">{t("description")}</p>
          <p className="mt-1 flex items-center gap-1 text-xs text-muted-foreground">
            <GripVertical className="h-3 w-3" />
            {t("dragToReorder")}
          </p>
        </div>
        <Button onClick={handleAddRoot}>
          <Plus className="mr-2 h-4 w-4" />
          {t("addCategory")}
        </Button>
      </div>

      {/* Categories Tree */}
      {categories.length === 0 ? (
        <div className="rounded-lg border-2 border-dashed p-12 text-center">
          <p className="mb-2 text-sm text-muted-foreground">{t("empty")}</p>
          <p className="mb-4 text-xs text-muted-foreground">{t("emptyDescription")}</p>
          <Button onClick={handleAddRoot} variant="outline">
            <Plus className="mr-2 h-4 w-4" />
            {t("addCategory")}
          </Button>
        </div>
      ) : (
        <div className="space-y-2">
          {activeOrgId && (
            <DraggableCategoryTree
              categories={categories}
              onEdit={handleEdit}
              onAddChild={handleAddChild}
              onDelete={handleDeleteClick}
              onMove={handleMove}
              onTogglePreferred={handleTogglePreferred}
              onReorderComplete={loadCategories}
              organizationId={activeOrgId}
              allCategories={categories}
            />
          )}
        </div>
      )}

      {/* Add/Edit Dialog */}
      <AddCategoryDialog
        open={addDialogOpen}
        onOpenChange={handleDialogClose}
        onSubmit={editCategory ? handleUpdateCategory : handleCreateCategory}
        categories={categories}
        parentCategory={parentForNew}
        editCategory={editCategory}
      />

      {/* Move Category Dialog */}
      <MoveCategoryDialog
        open={moveDialogOpen}
        onOpenChange={setMoveDialogOpen}
        onSubmit={handleMoveSubmit}
        category={categoryToMove}
        allCategories={categories}
      />

      {/* Delete Confirmation Dialog */}
      <AlertDialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {t("confirmDelete.title", { name: categoryToDelete?.name || "" })}
            </AlertDialogTitle>
            <AlertDialogDescription className="space-y-2">
              {deleteInfo && (
                <>
                  <p className="font-medium text-foreground">{deleteInfo.message}</p>
                  {deleteInfo.productCount > 0 && (
                    <p className="text-sm">
                      {t("deleteWarning.subcategory", {
                        count: deleteInfo.productCount,
                        name: categoryToDelete?.name || "",
                        target: deleteInfo.targetCategory,
                      })}
                    </p>
                  )}
                  {deleteInfo.childCount && deleteInfo.childCount > 0 && (
                    <p className="text-sm">
                      {t("deleteWarning.mainCategory", {
                        productCount: deleteInfo.productCount,
                        childCount: deleteInfo.childCount,
                        target: deleteInfo.targetCategory,
                      })}
                    </p>
                  )}
                </>
              )}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{t("form.cancel")}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive hover:bg-destructive/90"
            >
              {t("actions.delete")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
