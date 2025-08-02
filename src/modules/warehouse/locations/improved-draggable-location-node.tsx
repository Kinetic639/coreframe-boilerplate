"use client";

import * as React from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Icon } from "@/components/ui/icon";
import { LocationTreeItem } from "@/lib/types/location-tree";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { toast } from "react-toastify";
import {
  ChevronRight,
  Eye,
  Edit,
  Plus,
  Trash2,
  MoreHorizontal,
  ClipboardList,
  Settings,
  ArrowRight,
  GripVertical,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { useAppStore } from "@/lib/stores/app-store";
import { getProductsForLocations } from "@/lib/mock/audit";
import { getCurrentUser } from "@/lib/mock/organization";
import { AuditStartDialog } from "../audit/audit-start-dialog";
import { AuditProcessDialog } from "../audit/audit-process-dialog";
import { AuditSummaryDialog } from "../audit/audit-summary-dialog";
import { QuantityCorrectionDialog } from "../audit/quantity-correction-dialog";
import { useAuditStore } from "@/lib/stores/audit-store";
import { useRouter } from "@/i18n/navigation";
import { ImprovedDraggableLocationTree } from "./improved-draggable-location-tree";

interface ImprovedDraggableLocationNodeProps {
  location: LocationTreeItem;
  onEdit?: (location: LocationTreeItem) => void;
  onAddChild?: (parentLocation: LocationTreeItem) => void;
  onDelete?: (location: LocationTreeItem) => void;
  onMove?: (location: LocationTreeItem) => void;
  onReorderComplete?: () => void;
  branchId: string;
  level: number;
  index: number;
  isDragging?: boolean;
  isOver?: boolean;
  isActive?: boolean;
}

export function ImprovedDraggableLocationNode({
  location,
  onEdit,
  onAddChild,
  onDelete,
  onMove,
  onReorderComplete,
  branchId,
  level,
  index,
  isDragging = false,
  isOver = false,
  isActive = false,
}: ImprovedDraggableLocationNodeProps) {
  const router = useRouter();
  const { activeBranchId } = useAppStore();
  const { startAudit, completeAudit, resetAudit } = useAuditStore();
  const [isOpen, setIsOpen] = React.useState(level < 2);
  const [imageModalOpen, setImageModalOpen] = React.useState(false);
  const [auditStartOpen, setAuditStartOpen] = React.useState(false);
  const [auditProcessOpen, setAuditProcessOpen] = React.useState(false);
  const [auditSummaryOpen, setAuditSummaryOpen] = React.useState(false);
  const [correctionDialogOpen, setCorrectionDialogOpen] = React.useState(false);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging: isSortableDragging,
  } = useSortable({
    id: location.id,
    data: {
      type: "location",
      location,
      level,
      index,
    },
  });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  };

  const hasChildren = location.children && location.children.length > 0;
  const currentUser = getCurrentUser();

  const handleViewDetails = () => {
    router.push({ pathname: "/dashboard/warehouse/locations/[id]", params: { id: location.id } });
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

  const handleMove = (e: React.MouseEvent) => {
    e.stopPropagation();
    onMove?.(location);
  };

  const handleImageClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    if (location.raw.image_url) {
      setImageModalOpen(true);
    }
  };

  const handleStartAudit = (e: React.MouseEvent) => {
    e.stopPropagation();
    setAuditStartOpen(true);
  };

  const handleConfirmAudit = () => {
    const products = getProductsForLocations([location.id], activeBranchId);

    const audit = {
      id: `audit-${Date.now()}`,
      name: `Audyt - ${location.name}`,
      location_ids: [location.id],
      status: "pending" as const,
      conducted_by: currentUser.id,
      total_products: products.length,
      checked_products: 0,
      corrections_count: 0,
      total_value_change: 0,
      branch_id: activeBranchId,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    startAudit(audit, products);
    setAuditProcessOpen(true);

    toast.info(`Rozpoczęto audyt lokalizacji "${location.name}".`);
  };

  const handleCompleteAudit = () => {
    completeAudit();
    setAuditProcessOpen(false);
    setAuditSummaryOpen(true);
  };

  const handleFinishAudit = () => {
    resetAudit();
    toast.success("Audyt został pomyślnie zakończony i zapisany w historii.");
  };

  const handleQuantityCorrection = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCorrectionDialogOpen(true);
  };

  const handleSaveCorrection = (correction: { newQuantity: number; reason: string }) => {
    toast.success(`Ilość produktu została zaktualizowana. Powód: ${correction.reason}`);
  };

  const canDelete = (location.productCount || 0) === 0;

  return (
    <>
      <motion.div
        ref={setNodeRef}
        style={style}
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.2 }}
        className={cn(
          "relative mb-1 w-full",
          isSortableDragging && "z-50 opacity-50",
          isDragging && "pointer-events-none",
          isActive && "z-50"
        )}
      >
        {/* Drop indicator - shows above the item when dragging over */}
        {isOver && !isActive && (
          <div className="absolute -top-1 left-0 right-0 z-10 h-0.5 rounded-full bg-blue-500" />
        )}

        <div
          className={cn(
            "group flex items-center gap-3 rounded-lg border bg-card p-3 transition-all duration-200",
            level > 0 && "border-l-2",
            isOver && !isActive && "bg-blue-50 ring-2 ring-blue-500 ring-opacity-50",
            isSortableDragging && "border-blue-500 shadow-lg",
            "hover:bg-muted/50"
          )}
          style={{
            marginLeft: `${level * 20}px`,
            marginRight: 0,
            borderLeftColor: location.color || undefined,
          }}
        >
          {/* Drag Handle */}
          <div
            className={cn(
              "flex-shrink-0 cursor-grab transition-colors active:cursor-grabbing",
              isSortableDragging && "cursor-grabbing",
              "hover:text-blue-600"
            )}
            {...attributes}
            {...listeners}
          >
            <GripVertical className="h-4 w-4 text-muted-foreground" />
          </div>

          {/* Expand/Collapse Button */}
          <div className="flex-shrink-0">
            {hasChildren ? (
              <Collapsible open={isOpen} onOpenChange={setIsOpen}>
                <CollapsibleTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-6 w-6 p-0">
                    <ChevronRight
                      className={cn("h-3 w-3 transition-transform", isOpen && "rotate-90")}
                    />
                  </Button>
                </CollapsibleTrigger>
              </Collapsible>
            ) : (
              <div className="w-6" />
            )}
          </div>

          {/* Location Icon */}
          <div
            className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-md text-white"
            style={{ backgroundColor: location.color || "#6b7280" }}
          >
            <Icon name={location.icon_name || "MapPin"} className="h-5 w-5" />
          </div>

          {/* Location Image */}
          {location.raw.image_url && (
            <div
              className="h-10 w-10 flex-shrink-0 cursor-pointer overflow-hidden rounded-md transition-opacity hover:opacity-80"
              onClick={handleImageClick}
            >
              <img
                src={location.raw.image_url}
                alt={location.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}

          {/* Location Info - takes remaining space */}
          <div className="mr-3 min-w-0 flex-1">
            <div className="mb-1 flex items-center gap-2">
              <h3 className="truncate text-sm font-medium">{location.name}</h3>
              {location.code && (
                <Badge variant="outline" className="flex-shrink-0 text-xs">
                  {location.code}
                </Badge>
              )}
              {level > 0 && (
                <Badge variant="secondary" className="flex-shrink-0 text-xs">
                  Level {level + 1}
                </Badge>
              )}
            </div>
            {location.raw.description && (
              <p className="truncate text-xs text-muted-foreground">{location.raw.description}</p>
            )}
          </div>

          {/* Product Count */}
          <div className="flex-shrink-0">
            <Badge variant="secondary" className="text-xs">
              {location.productCount || 0}
            </Badge>
          </div>

          {/* Actions */}
          <div className="flex flex-shrink-0 items-center gap-1">
            <Button variant="ghost" size="sm" className="h-8 w-8 p-0" onClick={handleViewDetails}>
              <Eye className="h-3 w-3" />
            </Button>

            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                  <MoreHorizontal className="h-3 w-3" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onClick={handleEdit}>
                  <Edit className="mr-2 h-3 w-3" />
                  Edytuj
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleAddChild}>
                  <Plus className="mr-2 h-3 w-3" />
                  Dodaj podlokalizację
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleMove}>
                  <ArrowRight className="mr-2 h-3 w-3" />
                  Przenieś lokalizację
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleStartAudit}>
                  <ClipboardList className="mr-2 h-3 w-3" />
                  Przeprowadź audyt
                </DropdownMenuItem>
                <DropdownMenuItem onClick={handleQuantityCorrection}>
                  <Settings className="mr-2 h-3 w-3" />
                  Korekta ilości
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={handleDelete}
                  disabled={!canDelete}
                  className={cn(
                    !canDelete && "cursor-not-allowed opacity-50",
                    canDelete && "text-destructive focus:text-destructive"
                  )}
                >
                  <Trash2 className="mr-2 h-3 w-3" />
                  Usuń
                  {!canDelete && <span className="ml-auto text-xs">(nie pusta)</span>}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>
        </div>

        {/* Children - Recursive tree structure with independent drag contexts */}
        {hasChildren && (
          <Collapsible open={isOpen} onOpenChange={setIsOpen}>
            <CollapsibleContent>
              <div className="mt-1">
                <AnimatePresence>
                  <ImprovedDraggableLocationTree
                    locations={location.children || []}
                    onEdit={onEdit}
                    onAddChild={onAddChild}
                    onDelete={onDelete}
                    onMove={onMove}
                    onReorderComplete={onReorderComplete}
                    branchId={branchId}
                    level={level + 1}
                    parentId={location.id}
                  />
                </AnimatePresence>
              </div>
            </CollapsibleContent>
          </Collapsible>
        )}
      </motion.div>

      {/* Image Modal */}
      <Dialog open={imageModalOpen} onOpenChange={setImageModalOpen}>
        <DialogContent className="max-w-4xl">
          <DialogHeader>
            <DialogTitle>{location.name}</DialogTitle>
          </DialogHeader>
          {location.raw.image_url && (
            <div className="aspect-video overflow-hidden rounded-lg bg-muted">
              <img
                src={location.raw.image_url}
                alt={location.name}
                className="h-full w-full object-cover"
              />
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Audit Dialogs */}
      <AuditStartDialog
        open={auditStartOpen}
        onOpenChange={setAuditStartOpen}
        location={location}
        branchId={activeBranchId}
        onConfirm={handleConfirmAudit}
      />

      <AuditProcessDialog
        open={auditProcessOpen}
        onOpenChange={setAuditProcessOpen}
        onComplete={handleCompleteAudit}
      />

      <AuditSummaryDialog
        open={auditSummaryOpen}
        onOpenChange={setAuditSummaryOpen}
        onFinish={handleFinishAudit}
      />

      <QuantityCorrectionDialog
        open={correctionDialogOpen}
        onOpenChange={setCorrectionDialogOpen}
        product={null} // Would need to select a product first
        onSave={handleSaveCorrection}
      />
    </>
  );
}
