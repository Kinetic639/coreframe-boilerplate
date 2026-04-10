// =============================================
// Stock Movements List Page
// Main page for viewing and managing stock movements
// =============================================

"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCw } from "lucide-react";
import { CreateMovementDialog } from "@/modules/warehouse/components/create-movement-dialog";
import { StockMovementCard } from "@/modules/warehouse/components/stock-movement-card";
import { MovementFilters } from "@/modules/warehouse/components/movement-filters";
import { MovementDetailsModal } from "@/modules/warehouse/components/movement-details-modal";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { getMovements } from "@/app/actions/warehouse/get-movements";
import { approveMovement } from "@/app/actions/warehouse/approve-movement";
import { cancelMovement } from "@/app/actions/warehouse/cancel-movement";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import type {
  StockMovementWithRelations,
  StockMovementFilters,
} from "@/modules/warehouse/types/stock-movements";

export default function MovementsPage() {
  const { activeOrg, activeBranch } = useAppStore();

  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    organization_id: activeOrg?.organization_id,
    branch_id: activeBranch?.id,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [selectedMovement, setSelectedMovement] = useState<StockMovementWithRelations | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);

  useEffect(() => {
    if (activeOrg?.organization_id && activeBranch?.id) {
      setFilters((prev) => ({
        ...prev,
        organization_id: activeOrg.organization_id,
        branch_id: activeBranch.id,
      }));
    }
  }, [activeOrg, activeBranch]);

  useEffect(() => {
    loadMovements();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page]);

  const loadMovements = async () => {
    try {
      setLoading(true);
      const result = await getMovements({ filters, page, pageSize: 20 });

      if (result.success) {
        setMovements(result.data);
        setTotalPages(result.total_pages);
      } else {
        toast.error(result.error || "Failed to load movements");
      }
    } catch (error) {
      console.error("Error loading movements:", error);
      toast.error("An error occurred while loading movements");
    } finally {
      setLoading(false);
    }
  };

  const handleMovementClick = (movement: StockMovementWithRelations) => {
    setSelectedMovement(movement);
    setDetailsModalOpen(true);
  };

  const handleApprove = async (movementId: string) => {
    try {
      const result = await approveMovement(movementId);

      if (result.success) {
        toast.success("Movement approved successfully");
        await loadMovements();
        setDetailsModalOpen(false);
      } else {
        toast.error(result.error || "Failed to approve movement");
      }
    } catch (error) {
      console.error("Error approving movement:", error);
      toast.error("An error occurred while approving the movement");
    }
  };

  const handleCancel = async (movementId: string) => {
    const reason = prompt("Please enter a cancellation reason:");

    if (!reason) {
      return;
    }

    try {
      const result = await cancelMovement({ movementId, reason });

      if (result.success) {
        toast.success("Movement cancelled successfully");
        await loadMovements();
        setDetailsModalOpen(false);
      } else {
        toast.error(result.error || "Failed to cancel movement");
      }
    } catch (error) {
      console.error("Error cancelling movement:", error);
      toast.error("An error occurred while cancelling the movement");
    }
  };

  const handleCreateSuccess = () => {
    loadMovements();
  };

  const handleResetFilters = () => {
    setFilters({
      organization_id: activeOrg?.organization_id,
      branch_id: activeBranch?.id,
    });
    setPage(1);
  };

  if (!activeOrg || !activeBranch) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">
          Please select an organization and branch
        </div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Movements</h1>
          <p className="text-muted-foreground">Track and manage all warehouse stock movements</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadMovements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <CreateMovementDialog
            organizationId={activeOrg.organization_id}
            branchId={activeBranch.id}
            onSuccess={handleCreateSuccess}
          />
        </div>
      </div>

      {/* Filters */}
      <MovementFilters filters={filters} onChange={setFilters} onReset={handleResetFilters} />

      {/* Movements Grid */}
      {loading ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">Loading movements...</div>
        </div>
      ) : movements.length === 0 ? (
        <div className="text-center py-12">
          <div className="text-muted-foreground">No movements found</div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {movements.map((movement) => (
              <StockMovementCard
                key={movement.id}
                movement={movement}
                onClick={() => handleMovementClick(movement)}
              />
            ))}
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <Pagination>
              <PaginationContent>
                <PaginationItem>
                  <PaginationPrevious
                    onClick={() => setPage((p) => Math.max(1, p - 1))}
                    className={page === 1 ? "pointer-events-none opacity-50" : "cursor-pointer"}
                  />
                </PaginationItem>
                {Array.from({ length: Math.min(5, totalPages) }, (_, i) => {
                  const pageNum = i + 1;
                  return (
                    <PaginationItem key={pageNum}>
                      <PaginationLink
                        onClick={() => setPage(pageNum)}
                        isActive={page === pageNum}
                        className="cursor-pointer"
                      >
                        {pageNum}
                      </PaginationLink>
                    </PaginationItem>
                  );
                })}
                <PaginationItem>
                  <PaginationNext
                    onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                    className={
                      page === totalPages ? "pointer-events-none opacity-50" : "cursor-pointer"
                    }
                  />
                </PaginationItem>
              </PaginationContent>
            </Pagination>
          )}
        </>
      )}

      {/* Details Modal */}
      <MovementDetailsModal
        movement={selectedMovement}
        open={detailsModalOpen}
        onOpenChange={setDetailsModalOpen}
        onApprove={handleApprove}
        onCancel={handleCancel}
      />
    </div>
  );
}
