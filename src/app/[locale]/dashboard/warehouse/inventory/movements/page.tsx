// =============================================
// Stock Movements List Page (Inventory Section)
// Main page for viewing and managing stock movements under inventory
// =============================================

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter, LayoutGrid, List } from "lucide-react";
import { StockMovementCard } from "@/modules/warehouse/components/stock-movement-card";
import { StockMovementsTable } from "@/modules/warehouse/components/stock-movements-table";
import { MovementFilters } from "@/modules/warehouse/components/movement-filters";
import { MovementDetailsModal } from "@/modules/warehouse/components/movement-details-modal";
import { ApprovalQueue } from "@/modules/warehouse/components/approval-queue";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { getMovements } from "@/app/actions/warehouse/get-movements";
import { approveMovement } from "@/app/actions/warehouse/approve-movement";
import { cancelMovement } from "@/app/actions/warehouse/cancel-movement";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import type {
  StockMovementWithRelations,
  StockMovementFilters,
} from "@/modules/warehouse/types/stock-movements";

export default function InventoryMovementsPage() {
  const t = useTranslations("stockMovements");
  const router = useRouter();
  const { activeOrg, activeBranch } = useAppStore();

  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    organization_id: activeOrg?.organization_id,
    branch_id: activeBranch?.id,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedMovement, setSelectedMovement] = useState<StockMovementWithRelations | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");

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
    loadPendingCount();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters, page, activeTab]);

  const loadMovements = async () => {
    try {
      setLoading(true);

      // Apply tab-specific filters
      const tabFilters = { ...filters };
      if (activeTab === "pending") {
        tabFilters.status = "pending";
        tabFilters.requires_approval = true;
      } else if (activeTab === "approved") {
        tabFilters.status = "approved";
      } else if (activeTab === "completed") {
        tabFilters.status = "completed";
      }

      const result = await getMovements({ filters: tabFilters, page, pageSize: 20 });

      if (result.success) {
        setMovements(result.data);
        setTotalPages(result.total_pages);
        setTotalCount(result.total);
      } else {
        toast.error(result.error || t("messages.loadError"));
      }
    } catch (error) {
      console.error("Error loading movements:", error);
      toast.error(t("messages.loadError"));
    } finally {
      setLoading(false);
    }
  };

  const loadPendingCount = async () => {
    try {
      const result = await getMovements({
        filters: {
          ...filters,
          status: "pending",
        },
        page: 1,
        pageSize: 1,
      });

      if (result.success) {
        setPendingCount(result.total);
      }
    } catch (error) {
      console.error("Error loading pending count:", error);
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
        toast.success(t("messages.movementApproved"));
        await loadMovements();
        await loadPendingCount();
        setDetailsModalOpen(false);
      } else {
        toast.error(result.error || t("messages.approveError"));
      }
    } catch (error) {
      console.error("Error approving movement:", error);
      toast.error(t("messages.approveError"));
    }
  };

  const handleCancel = async (movementId: string) => {
    const reason = prompt(t("messages.cancellationReasonRequired"));

    if (!reason) {
      return;
    }

    try {
      const result = await cancelMovement({ movementId, reason });

      if (result.success) {
        toast.success(t("messages.movementCancelled"));
        await loadMovements();
        await loadPendingCount();
        setDetailsModalOpen(false);
      } else {
        toast.error(result.error || t("messages.cancelError"));
      }
    } catch (error) {
      console.error("Error cancelling movement:", error);
      toast.error(t("messages.cancelError"));
    }
  };

  const handleResetFilters = () => {
    setFilters({
      organization_id: activeOrg?.organization_id,
      branch_id: activeBranch?.id,
    });
    setPage(1);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value);
    setPage(1);
  };

  if (!activeOrg || !activeBranch) {
    return (
      <div className="container mx-auto p-6">
        <Card>
          <CardContent className="pt-6">
            <div className="text-center text-muted-foreground">{t("messages.authRequired")}</div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">{t("title")}</h1>
          <p className="text-muted-foreground mt-1">{t("description")}</p>
        </div>
        <div className="flex gap-2">
          <ToggleGroup
            type="single"
            value={viewMode}
            onValueChange={(value) => value && setViewMode(value as "card" | "list")}
          >
            <ToggleGroupItem value="card" aria-label="Card view" size="sm">
              <LayoutGrid className="h-4 w-4" />
            </ToggleGroupItem>
            <ToggleGroupItem value="list" aria-label="List view" size="sm">
              <List className="h-4 w-4" />
            </ToggleGroupItem>
          </ToggleGroup>
          <Button variant="outline" size="sm" onClick={() => setShowFilters(!showFilters)}>
            <Filter className="h-4 w-4 mr-2" />
            {showFilters ? t("filters.hide") : t("filters.show")}
          </Button>
          <Button variant="outline" size="sm" onClick={loadMovements} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            {t("actions.refresh")}
          </Button>
          <Button
            size="sm"
            onClick={() => router.push("/dashboard/warehouse/inventory/movements/new")}
          >
            <Plus className="h-4 w-4 mr-2" />
            {t("actions.create")}
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("filters.allMovements")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{totalCount}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("statuses.pending")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{pendingCount}</div>
            {pendingCount > 0 && (
              <Badge variant="destructive" className="mt-2">
                {t("filters.requiresApproval")}
              </Badge>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("categories.receipt")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {movements.filter((m) => m.category === "receipt").length}
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">{t("categories.issue")}</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">
              {movements.filter((m) => m.category === "issue").length}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Filters */}
      {showFilters && (
        <Card>
          <CardHeader>
            <CardTitle>{t("filters.title")}</CardTitle>
            <CardDescription>
              Filter movements by status, category, date range, and more
            </CardDescription>
          </CardHeader>
          <CardContent>
            <MovementFilters filters={filters} onChange={setFilters} onReset={handleResetFilters} />
          </CardContent>
        </Card>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={handleTabChange}>
        <TabsList>
          <TabsTrigger value="all">
            {t("filters.allMovements")}
            <Badge variant="secondary" className="ml-2">
              {totalCount}
            </Badge>
          </TabsTrigger>
          <TabsTrigger value="pending">
            {t("statuses.pending")}
            {pendingCount > 0 && (
              <Badge variant="destructive" className="ml-2">
                {pendingCount}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="approved">{t("statuses.approved")}</TabsTrigger>
          <TabsTrigger value="completed">{t("statuses.completed")}</TabsTrigger>
        </TabsList>

        <TabsContent value="all" className="space-y-4">
          {/* Movements Grid */}
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading movements...</div>
                </div>
              </CardContent>
            </Card>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">{t("messages.noMovements")}</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movements.map((movement) => (
                    <StockMovementCard
                      key={movement.id}
                      movement={movement}
                      onClick={() => handleMovementClick(movement)}
                    />
                  ))}
                </div>
              ) : (
                <StockMovementsTable movements={movements} onMovementClick={handleMovementClick} />
              )}

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
        </TabsContent>

        <TabsContent value="pending" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading pending movements...</div>
                </div>
              </CardContent>
            </Card>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">No pending movements</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <ApprovalQueue
              organizationId={activeOrg.organization_id}
              branchId={activeBranch.id}
              onApprove={handleApprove}
              onReject={handleCancel}
            />
          )}
        </TabsContent>

        <TabsContent value="approved" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading approved movements...</div>
                </div>
              </CardContent>
            </Card>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">No approved movements</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movements.map((movement) => (
                    <StockMovementCard
                      key={movement.id}
                      movement={movement}
                      onClick={() => handleMovementClick(movement)}
                    />
                  ))}
                </div>
              ) : (
                <StockMovementsTable movements={movements} onMovementClick={handleMovementClick} />
              )}

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
        </TabsContent>

        <TabsContent value="completed" className="space-y-4">
          {loading ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading completed movements...</div>
                </div>
              </CardContent>
            </Card>
          ) : movements.length === 0 ? (
            <Card>
              <CardContent className="pt-6">
                <div className="text-center py-12">
                  <div className="text-muted-foreground">No completed movements</div>
                </div>
              </CardContent>
            </Card>
          ) : (
            <>
              {viewMode === "card" ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  {movements.map((movement) => (
                    <StockMovementCard
                      key={movement.id}
                      movement={movement}
                      onClick={() => handleMovementClick(movement)}
                    />
                  ))}
                </div>
              ) : (
                <StockMovementsTable movements={movements} onMovementClick={handleMovementClick} />
              )}

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
        </TabsContent>
      </Tabs>

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
