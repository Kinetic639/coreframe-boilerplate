"use client";

import * as React from "react";
import {
  DndContext,
  closestCenter,
  DragEndEvent,
  DragOverlay,
  DragStartEvent,
  PointerSensor,
  useSensor,
  useSensors,
  MeasuringStrategy,
} from "@dnd-kit/core";
import { SortableContext, verticalListSortingStrategy, arrayMove } from "@dnd-kit/sortable";
import { restrictToVerticalAxis } from "@dnd-kit/modifiers";
import { CategoryTreeItem } from "../../types/categories";
import { DraggableCategoryNode } from "./draggable-category-node";
import { toast } from "react-toastify";
import { reorderCategories, CategoryReorderItem } from "@/app/actions/warehouse/reorder-categories";
import { useTranslations } from "next-intl";

interface DraggableCategoryTreeProps {
  categories: CategoryTreeItem[];
  onEdit?: (category: CategoryTreeItem) => void;
  onAddChild?: (parentCategory: CategoryTreeItem) => void;
  onDelete?: (category: CategoryTreeItem) => void;
  onReorderComplete?: () => void;
  organizationId: string;
  level?: number;
  parentId?: string | null;
}

const measuring = {
  droppable: {
    strategy: MeasuringStrategy.Always,
  },
};

export function DraggableCategoryTree({
  categories,
  onEdit,
  onAddChild,
  onDelete,
  onReorderComplete,
  organizationId,
  level = 0,
  parentId = null,
}: DraggableCategoryTreeProps) {
  const t = useTranslations("modules.warehouse.items.settings.categories");
  const [activeId, setActiveId] = React.useState<string | null>(null);
  const [isDragging, setIsDragging] = React.useState(false);
  const [isReordering, setIsReordering] = React.useState(false);
  const [localCategories, setLocalCategories] = React.useState(categories);
  const [expandedIds, setExpandedIds] = React.useState<Set<string>>(new Set());

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 8,
      },
    })
  );

  React.useEffect(() => {
    setLocalCategories(categories);
    // Auto-expand categories with children
    const newExpanded = new Set<string>();
    categories.forEach((cat) => {
      if (cat.children && cat.children.length > 0 && level < 2) {
        newExpanded.add(cat.id);
      }
    });
    setExpandedIds(newExpanded);
  }, [categories, level]);

  const categoryIds = localCategories.map((cat) => cat.id);

  const handleDragStart = (event: DragStartEvent) => {
    setActiveId(event.active.id as string);
    setIsDragging(true);
  };

  const handleDragEnd = async (event: DragEndEvent) => {
    const { active, over } = event;

    setIsDragging(false);
    setActiveId(null);

    if (!over || active.id === over.id) {
      return;
    }

    const oldIndex = localCategories.findIndex((cat) => cat.id === active.id);
    const newIndex = localCategories.findIndex((cat) => cat.id === over.id);

    if (oldIndex === -1 || newIndex === -1) {
      return;
    }

    const newCategories = arrayMove(localCategories, oldIndex, newIndex);
    setLocalCategories(newCategories);

    // Update sort_order
    const reorderItems: CategoryReorderItem[] = newCategories.map((cat, index) => ({
      id: cat.id,
      sort_order: index,
    }));

    setIsReordering(true);
    try {
      await reorderCategories(organizationId, parentId, reorderItems);
      toast.success(t("success.reordered"));
      onReorderComplete?.();
    } catch (error) {
      console.error("Failed to reorder categories:", error);
      toast.error(t("errors.reorderFailed"));
      setLocalCategories(categories);
    } finally {
      setIsReordering(false);
    }
  };

  const handleToggleExpand = (categoryId: string) => {
    setExpandedIds((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(categoryId)) {
        newSet.delete(categoryId);
      } else {
        newSet.add(categoryId);
      }
      return newSet;
    });
  };

  const activeCategory = localCategories.find((cat) => cat.id === activeId);

  return (
    <div className="space-y-1">
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragEnd={handleDragEnd}
        modifiers={[restrictToVerticalAxis]}
        measuring={measuring}
      >
        <SortableContext items={categoryIds} strategy={verticalListSortingStrategy}>
          {localCategories.map((category) => {
            const isExpanded = expandedIds.has(category.id);
            const hasChildren = category.children && category.children.length > 0;

            return (
              <div key={category.id}>
                <DraggableCategoryNode
                  category={category}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  level={level}
                  isExpanded={isExpanded}
                  onToggle={() => handleToggleExpand(category.id)}
                  isDragging={isDragging && activeId !== category.id}
                />

                {/* Children */}
                {hasChildren && isExpanded && (
                  <div className="ml-8 mt-1 space-y-1">
                    <DraggableCategoryTree
                      categories={category.children!}
                      onEdit={onEdit}
                      onAddChild={onAddChild}
                      onDelete={onDelete}
                      onReorderComplete={onReorderComplete}
                      organizationId={organizationId}
                      level={level + 1}
                      parentId={category.id}
                    />
                  </div>
                )}
              </div>
            );
          })}
        </SortableContext>

        <DragOverlay>
          {activeCategory && (
            <div className="opacity-90 shadow-lg">
              <DraggableCategoryNode category={activeCategory} level={level} isExpanded={false} />
            </div>
          )}
        </DragOverlay>
      </DndContext>

      {isReordering && (
        <div className="py-2 text-center text-xs text-muted-foreground">{t("saving")}...</div>
      )}
    </div>
  );
}
