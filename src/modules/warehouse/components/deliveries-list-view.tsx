"use client";

// =============================================
// Deliveries List View Component
// Advanced table view matching Odoo design
// =============================================

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import { useTranslations, useLocale } from "next-intl";
import { Plus, Filter, List, LayoutGrid, Calendar } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DeliveryStatusBadge } from "./delivery-status-badge";
import { getDeliveries } from "@/app/actions/warehouse/get-deliveries";
import type {
  DeliveryWithRelations,
  DeliveryStatus,
  DeliveryFilters,
} from "@/modules/warehouse/types/deliveries";
import { formatDate } from "@/lib/utils";

interface DeliveriesListViewProps {
  organizationId: string;
  branchId: string;
}

export function DeliveriesListView({ organizationId, branchId }: DeliveriesListViewProps) {
  const router = useRouter();
  const t = useTranslations("modules.warehouse.items.deliveries");
  const locale = useLocale();

  const [deliveries, setDeliveries] = useState<DeliveryWithRelations[]>([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [total, setTotal] = useState(0);
  const [viewMode, setViewMode] = useState<"list" | "grid" | "calendar">("list");

  // Filters
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<DeliveryStatus | "all">("all");

  const loadDeliveries = useCallback(async () => {
    setLoading(true);

    const filters: DeliveryFilters = {
      organization_id: organizationId,
      branch_id: branchId,
    };

    if (statusFilter !== "all") {
      filters.status = statusFilter;
    }

    if (searchQuery) {
      filters.search = searchQuery;
    }

    const result = await getDeliveries(organizationId, branchId, filters, page, 50);

    setDeliveries(result.data);
    setTotal(result.total);
    setTotalPages(result.total_pages);
    setLoading(false);
  }, [organizationId, branchId, page, statusFilter, searchQuery]);

  useEffect(() => {
    loadDeliveries();
  }, [loadDeliveries]);

  const handleRowClick = (deliveryId: string) => {
    router.push(`/dashboard/warehouse/deliveries/${deliveryId}`);
  };

  const handleNewDelivery = () => {
    router.push("/dashboard/warehouse/deliveries/new");
  };

  const formatScheduledDate = (dateStr: string) => {
    const date = new Date(dateStr);
    const now = new Date();
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);

    if (date.toDateString() === yesterday.toDateString()) {
      return <span className="text-red-600 font-medium">Yesterday</span>;
    }

    return formatDate(dateStr, locale);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm text-muted-foreground">
            {total} {total === 1 ? "delivery" : "deliveries"}
          </p>
        </div>

        <Button onClick={handleNewDelivery} className="bg-[#8B4789] hover:bg-[#7A3E78]">
          <Plus className="h-4 w-4 mr-2" />
          {t("new")}
        </Button>
      </div>

      {/* Toolbar */}
      <Card className="p-4">
        <div className="flex items-center gap-4">
          {/* Search */}
          <div className="flex-1 flex items-center gap-2">
            <div className="flex-1 flex items-center gap-2 border rounded-lg px-3 py-2">
              <Filter className="h-4 w-4 text-muted-foreground" />
              <Badge variant="secondary" className="gap-1">
                {t("title")}
                <button className="ml-1 hover:bg-muted-foreground/20 rounded-full w-4 h-4 flex items-center justify-center text-xs">
                  ×
                </button>
              </Badge>
              <Input
                placeholder={t("filters.search")}
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-0 shadow-none focus-visible:ring-0 px-2"
              />
            </div>

            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as DeliveryStatus | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">{t("filters.all")}</SelectItem>
                <SelectItem value="draft">{t("filters.draft")}</SelectItem>
                <SelectItem value="waiting">{t("filters.waiting")}</SelectItem>
                <SelectItem value="ready">{t("filters.ready")}</SelectItem>
                <SelectItem value="done">{t("filters.done")}</SelectItem>
                <SelectItem value="cancelled">{t("filters.cancelled")}</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {/* Pagination */}
          <div className="flex items-center gap-4">
            <span className="text-sm text-muted-foreground">
              {(page - 1) * 50 + 1}-{Math.min(page * 50, total)} / {total}
            </span>
            <div className="flex gap-1">
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
              >
                ‹
              </Button>
              <Button
                variant="outline"
                size="icon"
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
              >
                ›
              </Button>
            </div>
          </div>

          {/* View Modes */}
          <div className="flex gap-1 border rounded-lg p-1">
            <Button
              variant={viewMode === "list" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("list")}
              className="h-8 w-8"
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "grid" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("grid")}
              className="h-8 w-8"
            >
              <LayoutGrid className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === "calendar" ? "secondary" : "ghost"}
              size="icon"
              onClick={() => setViewMode("calendar")}
              className="h-8 w-8"
            >
              <Calendar className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </Card>

      {/* Table */}
      {loading ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t("messages.loadingDeliveries")}</p>
        </Card>
      ) : deliveries.length === 0 ? (
        <Card className="p-8 text-center">
          <p className="text-muted-foreground">{t("messages.noDeliveries")}</p>
        </Card>
      ) : (
        <Card>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-12">
                  <input type="checkbox" className="rounded border-gray-300" />
                </TableHead>
                <TableHead className="w-12"></TableHead>
                <TableHead>{t("fields.reference")}</TableHead>
                <TableHead>{t("fields.contact")}</TableHead>
                <TableHead>{t("fields.scheduledDate")}</TableHead>
                <TableHead>{t("fields.sourceDocument")}</TableHead>
                <TableHead className="text-right">Status</TableHead>
                <TableHead className="w-12"></TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {deliveries.map((delivery) => (
                <TableRow
                  key={delivery.id}
                  className="cursor-pointer hover:bg-muted/50"
                  onClick={() => handleRowClick(delivery.id)}
                >
                  <TableCell onClick={(e) => e.stopPropagation()}>
                    <input type="checkbox" className="rounded border-gray-300" />
                  </TableCell>
                  <TableCell>
                    <button
                      className="text-muted-foreground hover:text-yellow-500"
                      onClick={(e) => {
                        e.stopPropagation();
                        // Toggle favorite
                      }}
                    >
                      ☆
                    </button>
                  </TableCell>
                  <TableCell className="font-medium">{delivery.delivery_number}</TableCell>
                  <TableCell>
                    {delivery.delivery_address || delivery.created_by_user?.name || "-"}
                  </TableCell>
                  <TableCell>{formatScheduledDate(delivery.scheduled_date)}</TableCell>
                  <TableCell>{delivery.source_document || "-"}</TableCell>
                  <TableCell className="text-right">
                    <DeliveryStatusBadge status={delivery.status} />
                  </TableCell>
                  <TableCell>
                    <button className="text-muted-foreground hover:text-foreground">⋮</button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </Card>
      )}
    </div>
  );
}
