"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as Icons from "lucide-react";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ChevronDown, ChevronRight, Eye, Edit, Plus, Trash2, MoreHorizontal } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";

interface LocationTreeMobileProps {
  locations: LocationTreeItem[];
  onEdit?: (location: LocationTreeItem) => void;
  onAddChild?: (parentLocation: LocationTreeItem) => void;
  onDelete?: (location: LocationTreeItem) => void;
}

interface LocationItemMobileProps {
  location: LocationTreeItem;
  onEdit?: (location: LocationTreeItem) => void;
  onAddChild?: (parentLocation: LocationTreeItem) => void;
  onDelete?: (location: LocationTreeItem) => void;
  level: number;
}

function LocationItemMobile({
  location,
  onEdit,
  onAddChild,
  onDelete,
  level,
}: LocationItemMobileProps) {
  const router = useRouter();
  const [isExpanded, setIsExpanded] = React.useState(level === 0);

  const hasChildren = location.children && location.children.length > 0;
  const Icon = location.icon_name
    ? (Icons[location.icon_name as keyof typeof Icons] as React.ComponentType<{
        className?: string;
      }>)
    : Icons.MapPin;

  const handleViewDetails = () => {
    router.push(`/dashboard/warehouse/locations/${location.id}`);
  };

  const handleEdit = (e: React.MouseEvent) => {
    e.stopPropagation();
    onEdit?.(location);
  };

  const handleAddChild = (e: React.MouseEvent) => {
    e.stopPropagation();
    onAddChild?.(location);
  };

  const handleDelete = (e: React.MouseEvent) => {
    e.stopPropagation();
    onDelete?.(location);
  };

  const canDelete = (location.productCount || 0) === 0;

  return (
    <motion.div
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="w-full"
    >
      {/* Main Location Row */}
      <div
        className={cn(
          "mb-2 flex items-center gap-3 rounded-lg border border-gray-200 bg-white p-3 shadow-sm",
          "transition-colors active:bg-gray-50",
          level > 0 && "border-l-4"
        )}
        style={{
          marginLeft: `${level * 16}px`,
          borderLeftColor: level > 0 ? location.color || "#6b7280" : undefined,
        }}
        onClick={handleViewDetails}
      >
        {/* Expand Button for Children */}
        {hasChildren && (
          <Button
            variant="ghost"
            size="sm"
            className="h-8 w-8 flex-shrink-0 p-0"
            onClick={(e) => {
              e.stopPropagation();
              setIsExpanded(!isExpanded);
            }}
          >
            {isExpanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </Button>
        )}

        {/* Location Icon */}
        <div
          className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg text-white shadow-sm"
          style={{ backgroundColor: location.color || "#6b7280" }}
        >
          <Icon className="h-5 w-5" />
        </div>

        {/* Location Details */}
        <div className="min-w-0 flex-1">
          <div className="mb-1 flex items-center gap-2">
            <h3 className="truncate text-base font-semibold text-gray-900">{location.name}</h3>
            {location.code && (
              <Badge variant="outline" className="bg-gray-50 px-2 py-0.5 text-xs">
                {location.code}
              </Badge>
            )}
          </div>

          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <span className="text-sm text-gray-600">{location.productCount || 0} produktów</span>
              {hasChildren && (
                <span className="text-xs text-gray-400">
                  • {location.children?.length} podlokalizacji
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Actions Menu */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              size="sm"
              className="h-8 w-8 flex-shrink-0 p-0 text-gray-400 hover:text-gray-600"
              onClick={(e) => e.stopPropagation()}
            >
              <MoreHorizontal className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-48">
            <DropdownMenuItem onClick={handleViewDetails} className="text-sm">
              <Eye className="mr-3 h-4 w-4" />
              Zobacz szczegóły
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleEdit} className="text-sm">
              <Edit className="mr-3 h-4 w-4" />
              Edytuj lokalizację
            </DropdownMenuItem>
            <DropdownMenuItem onClick={handleAddChild} className="text-sm">
              <Plus className="mr-3 h-4 w-4" />
              Dodaj podlokalizację
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              onClick={handleDelete}
              disabled={!canDelete}
              className={cn(
                "text-sm",
                !canDelete && "cursor-not-allowed opacity-50",
                canDelete && "text-red-600 focus:bg-red-50 focus:text-red-600"
              )}
            >
              <Trash2 className="mr-3 h-4 w-4" />
              Usuń lokalizację
              {!canDelete && (
                <span className="ml-auto text-xs text-gray-400">(zawiera produkty)</span>
              )}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>

      {/* Children Locations */}
      <AnimatePresence>
        {hasChildren && isExpanded && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="mt-1 space-y-0">
              {location.children?.map((child) => (
                <LocationItemMobile
                  key={child.id}
                  location={child}
                  onEdit={onEdit}
                  onAddChild={onAddChild}
                  onDelete={onDelete}
                  level={level + 1}
                />
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export function LocationTreeMobile({
  locations,
  onEdit,
  onAddChild,
  onDelete,
}: LocationTreeMobileProps) {
  return (
    <div className="space-y-0 pb-4">
      {locations.map((location) => (
        <LocationItemMobile
          key={location.id}
          location={location}
          onEdit={onEdit}
          onAddChild={onAddChild}
          onDelete={onDelete}
          level={0}
        />
      ))}
    </div>
  );
}
