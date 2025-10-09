"use client";

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { QrCode, Plus, FileText, Scan, Package, MapPin } from "lucide-react";
import { Link } from "@/i18n/navigation";

// Mock statistics - replace with actual Supabase queries
const mockStats = {
  totalLabels: 1247,
  assignedLabels: 983,
  unassignedLabels: 264,
  templates: 8,
  scansThisMonth: 145,
  recentScans: [
    {
      id: "1",
      qr_token: "ABC123",
      entity_type: "product",
      entity_name: "Produkt A",
      scanned_at: "2024-01-30T15:30:00Z",
    },
    {
      id: "2",
      qr_token: "DEF456",
      entity_type: "location",
      entity_name: "Magazyn A-1",
      scanned_at: "2024-01-30T14:20:00Z",
    },
    {
      id: "3",
      qr_token: "GHI789",
      entity_type: "product",
      entity_name: "Produkt B",
      scanned_at: "2024-01-30T13:10:00Z",
    },
  ],
};

export default function LabelsPage() {
  return (
    <div className="space-y-6">
      {/* Header with Create Button */}
      <div className="flex items-center justify-end">
        <Link href="/dashboard/warehouse/labels/create">
          <Button size="lg">
            <Plus className="mr-2 h-4 w-4" />
            Create Label
          </Button>
        </Link>
      </div>

      {/* Statistics Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Labels</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalLabels.toLocaleString()}</div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Assigned Labels</CardTitle>
            <Package className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold text-green-600">
              {mockStats.assignedLabels.toLocaleString()}
            </div>
            <p className="text-xs text-muted-foreground">
              {((mockStats.assignedLabels / mockStats.totalLabels) * 100).toFixed(1)}% of total
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Unassigned</CardTitle>
            <Scan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.unassignedLabels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">Ready to assign</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Scans This Month</CardTitle>
            <Scan className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.scansThisMonth.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% from last month</p>
          </CardContent>
        </Card>
      </div>

      {/* Recent Scans */}
      <div className="grid gap-6 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Scan className="h-5 w-5" />
              Recent Scans
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockStats.recentScans.map((scan) => (
                <div key={scan.id} className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    {scan.entity_type === "product" ? (
                      <Package className="h-4 w-4 text-muted-foreground" />
                    ) : (
                      <MapPin className="h-4 w-4 text-muted-foreground" />
                    )}
                    <div>
                      <p className="text-sm font-medium">{scan.entity_name}</p>
                      <p className="text-xs text-muted-foreground">{scan.qr_token}</p>
                    </div>
                  </div>
                  <Badge variant="outline" className="text-xs">
                    {scan.entity_type}
                  </Badge>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <FileText className="h-5 w-5" />
              Templates
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-sm">Total templates</span>
                <Badge variant="secondary">{mockStats.templates}</Badge>
              </div>
              <p className="text-sm text-muted-foreground">
                Manage label templates in the Templates tab
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
