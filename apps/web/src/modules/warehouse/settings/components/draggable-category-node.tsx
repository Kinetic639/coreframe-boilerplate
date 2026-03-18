"use client";

import * as React from "react";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { CategoryTreeItem } from "../../types/categories";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  ChevronRight,
  Edit,
  Plus,
  Trash2,
  MoreHorizontal,
  GripVertical,
  Star,
  Move,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useTranslations } from "next-intl";

interface DraggableCategoryNodeProps {
  category: CategoryTreeItem;
  onEdit?: (category: CategoryTreeItem) => void;
  onAddChild?: (parentCategory: CategoryTreeItem) => void;
  onDelete?: (category: CategoryTreeItem) => void;
  onMove?: (category: CategoryTreeItem) => void;
  onTogglePreferred?: (category: CategoryTreeItem) => void;
  level: number;
  isExpanded?: boolean;
  onToggle?: () => void;
  isDragging?: boolean;
  allCategories?: CategoryTreeItem[];
}

export function DraggableCategoryNode({
  category,
  onEdit,
  onAddChild,
  onDelete,
  onMove,
  onTogglePreferred,
  level,
  isExpanded = true,
  onToggle,
  isDragging = false,
}: DraggableCategoryNodeProps) {
  const t = useTranslations("modules.warehouse.items.settings.categories");

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({ id: category.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = category.children && category.children.length > 0;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={cn(
        "flex items-center gap-2 rounded-md border bg-background px-3 py-2 transition-colors",
        isSortableDragging && "z-50 opacity-50 shadow-lg",
        isDragging && "opacity-30"
      )}
    >
      {/* Drag Handle */}
      <div {...attributes} {...listeners} className="cursor-grab touch-none active:cursor-grabbing">
        <GripVertical className="h-4 w-4 text-muted-foreground transition-colors hover:text-foreground" />
      </div>

      {/* Expand/Collapse */}
      {hasChildren ? (
        <Button variant="ghost" size="sm" onClick={onToggle} className="h-6 w-6 p-0">
          <ChevronRight className={cn("h-4 w-4 transition-transform", isExpanded && "rotate-90")} />
        </Button>
      ) : (
        <div className="w-6" />
      )}

      {/* Preferred Star */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => onTogglePreferred?.(category)}
        className="h-6 w-6 p-0"
      >
        <Star
          className={cn(
            "h-4 w-4 transition-colors",
            category.is_preferred ? "fill-yellow-400 text-yellow-400" : "text-muted-foreground"
          )}
        />
      </Button>

      {/* Color Badge */}
      {category.color && (
        <div className="h-3 w-3 rounded-full border" style={{ backgroundColor: category.color }} />
      )}

      {/* Category Name */}
      <div className="flex min-w-0 flex-1 items-center gap-2">
        <span
          className={cn(
            "truncate text-sm font-medium",
            category.is_default && "text-muted-foreground"
          )}
        >
          {category.name}
        </span>
        {category.is_default && (
          <Badge variant="outline" className="text-xs">
            {t("default")}
          </Badge>
        )}
      </div>

      {/* Product Count */}
      {category.productCount !== undefined && category.productCount > 0 && (
        <Badge variant="secondary" className="text-xs">
          {t("productsCount", { count: category.productCount })}
        </Badge>
      )}

      {/* Actions Dropdown */}
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
            <MoreHorizontal className="h-4 w-4" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit?.(category)}>
            <Edit className="mr-2 h-4 w-4" />
            {t("actions.edit")}
          </DropdownMenuItem>
          {!category.is_default && level < 2 && (
            <DropdownMenuItem onClick={() => onAddChild?.(category)}>
              <Plus className="mr-2 h-4 w-4" />
              {t("actions.addSubcategory")}
            </DropdownMenuItem>
          )}
          {!category.is_default && (
            <DropdownMenuItem onClick={() => onMove?.(category)}>
              <Move className="mr-2 h-4 w-4" />
              {t("actions.move")}
            </DropdownMenuItem>
          )}
          <DropdownMenuSeparator />
          {!category.is_default && (
            <DropdownMenuItem onClick={() => onDelete?.(category)} className="text-destructive">
              <Trash2 className="mr-2 h-4 w-4" />
              {t("actions.delete")}
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  );
}
