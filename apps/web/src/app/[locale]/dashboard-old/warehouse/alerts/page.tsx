// =============================================
// Stock Alerts Page
// Low stock monitoring and replenishment alerts
// =============================================

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
import {
  AlertTriangle,
  Search,
  RefreshCw,
  Package,
  Bell,
  BellOff,
  CheckCircle2,
  XCircle,
  Filter,
  Calculator,
} from "lucide-react";
import { toast } from "react-toastify";
import { useAppStore } from "@/lib/stores/app-store";
import { getAlerts, getAlertSummary } from "@/modules/warehouse/services/stock-alerts-service";
import {
  runStockLevelCheckAction,
  acknowledgeAlertAction,
  resolveAlertAction,
  ignoreAlertAction,
} from "@/app/actions/warehouse/stock-alerts-actions";
import type {
  StockAlertWithProduct,
  AlertSummary,
  AlertStatus,
  AlertSeverity,
} from "@/modules/warehouse/types/stock-alerts";

export default function AlertsPage() {
  const { activeOrg } = useAppStore();

  const [alerts, setAlerts] = useState<StockAlertWithProduct[]>([]);
  const [filteredAlerts, setFilteredAlerts] = useState<StockAlertWithProduct[]>([]);
  const [summary, setSummary] = useState<AlertSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [checking, setChecking] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState<AlertStatus | "all">("all");
  const [severityFilter, setSeverityFilter] = useState<AlertSeverity | "all">("all");

  useEffect(() => {
    if (activeOrg?.organization_id) {
      loadAlerts();
      loadSummary();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeOrg]);

  useEffect(() => {
    // Filter alerts based on search query and filters
    let filtered = alerts;

    if (searchQuery.trim() !== "") {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(
        (alert) =>
          alert.product?.name?.toLowerCase().includes(query) ||
          alert.product?.sku?.toLowerCase().includes(query)
      );
    }

    if (statusFilter !== "all") {
      filtered = filtered.filter((alert) => alert.status === statusFilter);
    }

    if (severityFilter !== "all") {
      filtered = filtered.filter((alert) => alert.severity === severityFilter);
    }

    setFilteredAlerts(filtered);
  }, [searchQuery, statusFilter, severityFilter, alerts]);

  const loadAlerts = async () => {
    if (!activeOrg?.organization_id) return;

    try {
      setLoading(true);
      const data = await getAlerts(activeOrg.organization_id, {
        status: statusFilter !== "all" ? [statusFilter] : undefined,
        severity: severityFilter !== "all" ? [severityFilter] : undefined,
      });
      setAlerts(data);
      setFilteredAlerts(data);
    } catch (error) {
      console.error("Error loading alerts:", error);
      toast.error("Failed to load alerts");
    } finally {
      setLoading(false);
    }
  };

  const loadSummary = async () => {
    if (!activeOrg?.organization_id) return;

    try {
      const data = await getAlertSummary(activeOrg.organization_id);
      setSummary(data);
    } catch (error) {
      console.error("Error loading summary:", error);
    }
  };

  const runStockCheck = async () => {
    if (!activeOrg?.organization_id) return;

    try {
      setChecking(true);
      const result = await runStockLevelCheckAction(activeOrg.organization_id);

      if (result.success && result.result) {
        const parts = [];
        if (result.result.alerts_created > 0) parts.push(`${result.result.alerts_created} created`);
        if (result.result.alerts_resolved > 0)
          parts.push(`${result.result.alerts_resolved} resolved`);
        if (result.result.alerts_updated > 0) parts.push(`${result.result.alerts_updated} updated`);

        const message =
          parts.length > 0
            ? `Stock check complete: ${parts.join(", ")}`
            : "Stock check complete. No changes.";

        toast.success(message);
        loadAlerts();
        loadSummary();
      } else {
        toast.error(result.error || "Failed to run stock check");
      }
    } catch (error) {
      console.error("Error running stock check:", error);
      toast.error("An error occurred while checking stock levels");
    } finally {
      setChecking(false);
    }
  };

  const handleAcknowledge = async (alertId: string) => {
    if (!activeOrg?.organization_id) return;

    try {
      const result = await acknowledgeAlertAction(alertId, activeOrg.organization_id);

      if (result.success) {
        toast.success("Alert acknowledged");
        loadAlerts();
        loadSummary();
      } else {
        toast.error(result.error || "Failed to acknowledge alert");
      }
    } catch (error) {
      console.error("Error acknowledging alert:", error);
      toast.error("An error occurred");
    }
  };

  const handleResolve = async (alertId: string) => {
    if (!activeOrg?.organization_id) return;

    try {
      const result = await resolveAlertAction(alertId, activeOrg.organization_id);

      if (result.success) {
        toast.success("Alert resolved");
        loadAlerts();
        loadSummary();
      } else {
        toast.error(result.error || "Failed to resolve alert");
      }
    } catch (error) {
      console.error("Error resolving alert:", error);
      toast.error("An error occurred");
    }
  };

  const handleIgnore = async (alertId: string) => {
    if (!activeOrg?.organization_id) return;

    try {
      const result = await ignoreAlertAction(alertId, activeOrg.organization_id);

      if (result.success) {
        toast.success("Alert ignored");
        loadAlerts();
        loadSummary();
      } else {
        toast.error(result.error || "Failed to ignore alert");
      }
    } catch (error) {
      console.error("Error ignoring alert:", error);
      toast.error("An error occurred");
    }
  };

  const getSeverityColor = (severity: AlertSeverity) => {
    switch (severity) {
      case "critical":
        return "destructive";
      case "warning":
        return "warning";
      case "info":
        return "secondary";
      default:
        return "secondary";
    }
  };

  const getStatusColor = (status: AlertStatus) => {
    switch (status) {
      case "active":
        return "destructive";
      case "acknowledged":
        return "warning";
      case "resolved":
        return "success";
      case "ignored":
        return "secondary";
      default:
        return "secondary";
    }
  };

  if (!activeOrg) {
    return (
      <div className="container mx-auto p-6">
        <div className="text-center text-muted-foreground">Please select an organization</div>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold">Stock Alerts</h1>
          <p className="text-muted-foreground">Low stock monitoring and replenishment alerts</p>
        </div>
        <div className="flex gap-2">
          <Button variant="outline" onClick={loadAlerts} disabled={loading}>
            <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
            Refresh
          </Button>
          <Button onClick={runStockCheck} disabled={checking}>
            <Calculator className={`h-4 w-4 mr-2 ${checking ? "animate-spin" : ""}`} />
            Run Stock Check
          </Button>
        </div>
      </div>

      {/* Summary Cards */}
      {summary && (
        <div className="grid grid-cols-1 md:grid-cols-6 gap-4">
          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Active Alerts</CardDescription>
              <CardTitle className="text-3xl">{summary.total_active}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <AlertTriangle className="h-4 w-4" />
                <span>Requiring attention</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Critical</CardDescription>
              <CardTitle className="text-3xl text-red-600">{summary.critical_count}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <XCircle className="h-4 w-4" />
                <span>Out of stock</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Warnings</CardDescription>
              <CardTitle className="text-3xl text-yellow-600">{summary.warning_count}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Below reorder point</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Affected Warehouses</CardDescription>
              <CardTitle className="text-3xl">{summary.affected_branches}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>With alerts</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Affected Products</CardDescription>
              <CardTitle className="text-3xl">{summary.affected_products}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Package className="h-4 w-4" />
                <span>Unique products</span>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardDescription>Notifications</CardDescription>
              <CardTitle className="text-3xl">{summary.notification_enabled_count}</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Bell className="h-4 w-4" />
                <span>Active notifications</span>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {/* Filters and List */}
      <Card>
        <CardHeader>
          <CardTitle>Alert List</CardTitle>
          <CardDescription>Current stock alerts and their status</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-4 mb-4">
            <div className="relative flex-1">
              <Search className="absolute left-2 top-2.5 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search by product name or SKU..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-8"
              />
            </div>
            <Select
              value={statusFilter}
              onValueChange={(value) => setStatusFilter(value as AlertStatus | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by status" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Statuses</SelectItem>
                <SelectItem value="active">Active</SelectItem>
                <SelectItem value="acknowledged">Acknowledged</SelectItem>
                <SelectItem value="resolved">Resolved</SelectItem>
                <SelectItem value="ignored">Ignored</SelectItem>
              </SelectContent>
            </Select>
            <Select
              value={severityFilter}
              onValueChange={(value) => setSeverityFilter(value as AlertSeverity | "all")}
            >
              <SelectTrigger className="w-[180px]">
                <Filter className="h-4 w-4 mr-2" />
                <SelectValue placeholder="Filter by severity" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Severities</SelectItem>
                <SelectItem value="critical">Critical</SelectItem>
                <SelectItem value="warning">Warning</SelectItem>
                <SelectItem value="info">Info</SelectItem>
              </SelectContent>
            </Select>
          </div>

          {loading ? (
            <div className="text-center py-12 text-muted-foreground">Loading alerts...</div>
          ) : filteredAlerts.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <CheckCircle2 className="h-12 w-12 mx-auto mb-4 text-green-500" />
              <p className="text-lg font-medium">No alerts found</p>
              <p className="text-sm">All products are adequately stocked</p>
            </div>
          ) : (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Product</TableHead>
                    <TableHead className="text-right">On Hand</TableHead>
                    <TableHead className="text-right">Reserved</TableHead>
                    <TableHead className="text-right">Available</TableHead>
                    <TableHead className="text-right">Reorder Point</TableHead>
                    <TableHead className="text-right">Suggested Order</TableHead>
                    <TableHead>Severity</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Notifications</TableHead>
                    <TableHead>Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredAlerts.map((alert) => (
                    <TableRow key={alert.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">
                            {alert.product?.name || "Unknown Product"}
                          </div>
                          <div className="text-sm text-muted-foreground">{alert.product?.sku}</div>
                        </div>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-muted-foreground">
                          {alert.quantity_on_hand ?? "-"}
                        </span>
                      </TableCell>
                      <TableCell className="text-right">
                        <span className="text-yellow-600">{alert.reserved_quantity ?? 0}</span>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex flex-col items-end">
                          <span
                            className={
                              alert.current_stock <= 0 ? "text-red-600 font-bold" : "font-semibold"
                            }
                          >
                            {alert.current_stock}
                          </span>
                          {alert.quantity_on_hand != null && alert.reserved_quantity != null && (
                            <span className="text-xs text-muted-foreground">
                              ({alert.quantity_on_hand} - {alert.reserved_quantity})
                            </span>
                          )}
                        </div>
                      </TableCell>
                      <TableCell className="text-right font-medium">
                        {alert.reorder_point}
                      </TableCell>
                      <TableCell className="text-right">
                        {alert.suggested_order_quantity ? (
                          <div>
                            <div className="font-medium">{alert.suggested_order_quantity}</div>
                            {alert.suggested_packages && (
                              <div className="text-xs text-muted-foreground">
                                ({alert.suggested_packages} packages)
                              </div>
                            )}
                          </div>
                        ) : (
                          <span className="text-muted-foreground">-</span>
                        )}
                      </TableCell>
                      <TableCell>
                        <Badge variant={getSeverityColor(alert.severity) as any}>
                          {alert.severity}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        <Badge variant={getStatusColor(alert.status) as any}>{alert.status}</Badge>
                      </TableCell>
                      <TableCell>
                        {alert.notification_sent ? (
                          <div className="flex items-center gap-1 text-sm text-green-600">
                            <Bell className="h-3 w-3" />
                            <span>Sent</span>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 text-sm text-muted-foreground">
                            <BellOff className="h-3 w-3" />
                            <span>Disabled</span>
                          </div>
                        )}
                      </TableCell>
                      <TableCell>
                        <div className="flex gap-1">
                          {alert.status === "active" && (
                            <Button
                              size="sm"
                              variant="outline"
                              onClick={() => handleAcknowledge(alert.id)}
                            >
                              Acknowledge
                            </Button>
                          )}
                          {(alert.status === "active" || alert.status === "acknowledged") && (
                            <>
                              <Button
                                size="sm"
                                variant="outline"
                                onClick={() => handleResolve(alert.id)}
                              >
                                Resolve
                              </Button>
                              <Button
                                size="sm"
                                variant="ghost"
                                onClick={() => handleIgnore(alert.id)}
                              >
                                Ignore
                              </Button>
                            </>
                          )}
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
