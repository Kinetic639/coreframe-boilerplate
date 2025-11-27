// =============================================
// Stock Movements List Page (Inventory Section)
// Main page for viewing and managing stock movements under inventory
// =============================================

"use client";

import { useState, useEffect } from "react";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { RefreshCw, Plus, Filter, LayoutGrid, List } from "lucide-react";
import { CreateMovementDialog } from "@/modules/warehouse/components/create-movement-dialog";
import { CreateTransferRequestDialog } from "@/modules/warehouse/components/create-transfer-request-dialog";
import { TransferRequestsTable } from "@/modules/warehouse/components/transfer-requests-table";
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
import { getTransferRequests } from "@/app/actions/warehouse/get-transfer-requests";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import type {
  StockMovementWithRelations,
  StockMovementFilters,
} from "@/modules/warehouse/types/stock-movements";
import type { TransferRequestWithRelations } from "@/modules/warehouse/types/inter-warehouse-transfers";

export default function InventoryMovementsPage() {
  const t = useTranslations("stockMovements");
  const { activeOrg, activeBranch } = useAppStore();

  const [movements, setMovements] = useState<StockMovementWithRelations[]>([]);
  const [transfers, setTransfers] = useState<TransferRequestWithRelations[]>([]);
  const [filters, setFilters] = useState<StockMovementFilters>({
    organization_id: activeOrg?.organization_id,
    branch_id: activeBranch?.id,
  });
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalCount, setTotalCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [transfersLoading, setTransfersLoading] = useState(false);
  const [selectedMovement, setSelectedMovement] = useState<StockMovementWithRelations | null>(null);
  const [detailsModalOpen, setDetailsModalOpen] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [activeTab, setActiveTab] = useState("all");
  const [pendingCount, setPendingCount] = useState(0);
  const [viewMode, setViewMode] = useState<"card" | "list">("card");
  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>([]);
  const [locations, setLocations] = useState<
    Array<{ id: string; name: string; code: string; branch_id: string }>
  >([]);

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
    if (activeTab === "transfers") {
      loadTransfers();
      loadBranchesAndLocations();
    } else {
      loadMovements();
      loadPendingCount();
    }
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

  const loadTransfers = async () => {
    if (!activeOrg?.organization_id || !activeBranch?.id) return;

    try {
      setTransfersLoading(true);
      const result = await getTransferRequests(activeOrg.organization_id, activeBranch.id);

      if (result.success) {
        setTransfers(result.data);
      } else {
        toast.error(result.error || "Failed to load transfers");
      }
    } catch (error) {
      console.error("Error loading transfers:", error);
      toast.error("Failed to load transfers");
    } finally {
      setTransfersLoading(false);
    }
  };

  const loadBranchesAndLocations = async () => {
    if (!activeOrg?.organization_id) return;

    try {
      // Load branches - in a real app, this would come from an API
      // For now, we'll use a mock implementation
      // You should create a proper action for this
      setBranches([{ id: activeBranch?.id || "", name: activeBranch?.name || "Current Branch" }]);

      // Load locations - same as above
      setLocations([]);
    } catch (error) {
      console.error("Error loading branches/locations:", error);
    }
  };

  const handleCreateSuccess = () => {
    loadMovements();
    loadPendingCount();
  };

  const handleTransferSuccess = () => {
    loadTransfers();
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
          <CreateMovementDialog
            organizationId={activeOrg.organization_id}
            branchId={activeBranch.id}
            onSuccess={handleCreateSuccess}
            trigger={
              <Button size="sm">
                <Plus className="h-4 w-4 mr-2" />
                {t("actions.create")}
              </Button>
            }
          />
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
          <TabsTrigger value="transfers">
            Inter-Warehouse Transfers
            <Badge variant="outline" className="ml-2">
              {transfers.length}
            </Badge>
          </TabsTrigger>
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

        <TabsContent value="transfers" className="space-y-4">
          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle>Transfer Requests</CardTitle>
                  <CardDescription>
                    Manage inter-warehouse stock transfers with approval workflow
                  </CardDescription>
                </div>
                <CreateTransferRequestDialog
                  organizationId={activeOrg.organization_id}
                  branchId={activeBranch.id}
                  branches={branches}
                  locations={locations}
                  onSuccess={handleTransferSuccess}
                />
              </div>
            </CardHeader>
            <CardContent>
              {transfersLoading ? (
                <div className="text-center py-12">
                  <div className="text-muted-foreground">Loading transfers...</div>
                </div>
              ) : (
                <TransferRequestsTable transfers={transfers} onRefresh={loadTransfers} />
              )}
            </CardContent>
          </Card>

          {/* Transfer Workflow Info */}
          <Card>
            <CardHeader>
              <CardTitle>Transfer Workflow</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-5 gap-4">
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                      <span className="text-lg font-bold">1</span>
                    </div>
                    <h4 className="font-semibold">Draft</h4>
                    <p className="text-sm text-muted-foreground">Create transfer request</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                      <span className="text-lg font-bold">2</span>
                    </div>
                    <h4 className="font-semibold">Pending</h4>
                    <p className="text-sm text-muted-foreground">Submit for approval</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                      <span className="text-lg font-bold">3</span>
                    </div>
                    <h4 className="font-semibold">Approved</h4>
                    <p className="text-sm text-muted-foreground">Warehouse manager approves</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-secondary flex items-center justify-center mb-2">
                      <span className="text-lg font-bold">4</span>
                    </div>
                    <h4 className="font-semibold">In Transit</h4>
                    <p className="text-sm text-muted-foreground">Ship (creates OUT movement 311)</p>
                  </div>
                  <div className="flex flex-col items-center text-center">
                    <div className="w-12 h-12 rounded-full bg-primary text-primary-foreground flex items-center justify-center mb-2">
                      <span className="text-lg font-bold">5</span>
                    </div>
                    <h4 className="font-semibold">Completed</h4>
                    <p className="text-sm text-muted-foreground">
                      Receive (creates IN movement 312)
                    </p>
                  </div>
                </div>
                <div className="bg-muted p-4 rounded-lg">
                  <h5 className="font-semibold mb-2">Movement Types</h5>
                  <ul className="text-sm space-y-1 text-muted-foreground">
                    <li>
                      • <strong>301:</strong> Transfer Out (same warehouse)
                    </li>
                    <li>
                      • <strong>302:</strong> Transfer In (same warehouse)
                    </li>
                    <li>
                      • <strong>311:</strong> Inter-Branch Transfer Out
                    </li>
                    <li>
                      • <strong>312:</strong> Inter-Branch Transfer In
                    </li>
                  </ul>
                </div>
              </div>
            </CardContent>
          </Card>
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
