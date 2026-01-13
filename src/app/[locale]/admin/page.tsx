import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Activity, Users, Database, Shield, BarChart3, AlertCircle } from "lucide-react";

export default async function AdminOverviewPage() {
  // TODO: Fetch real data from your backend
  const systemStats = {
    totalUsers: 0,
    totalOrganizations: 0,
    totalBranches: 0,
    systemHealth: "healthy" as const,
    activeConnections: 0,
    databaseSize: "0 MB",
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Admin Panel</h1>
        <p className="mt-2 text-gray-600 dark:text-gray-400">
          System administration and testing tools
        </p>
      </div>

      {/* System Health Status */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-5 w-5" />
            System Health
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center gap-2">
            <Badge variant={systemStats.systemHealth === "healthy" ? "default" : "destructive"}>
              {systemStats.systemHealth === "healthy" ? "Healthy" : "Issues Detected"}
            </Badge>
            <span className="text-sm text-gray-600 dark:text-gray-400">
              All systems operational
            </span>
          </div>
        </CardContent>
      </Card>

      {/* Quick Stats Grid */}
      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Users</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Registered in the system</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Organizations</CardTitle>
            <BarChart3 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.totalOrganizations}</div>
            <p className="text-xs text-muted-foreground">Active organizations</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Active Connections</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.activeConnections}</div>
            <p className="text-xs text-muted-foreground">Current active sessions</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Database Size</CardTitle>
            <Database className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{systemStats.databaseSize}</div>
            <p className="text-xs text-muted-foreground">Total storage used</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Security Status</CardTitle>
            <Shield className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">Secure</div>
            <p className="text-xs text-muted-foreground">No security issues detected</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">System Alerts</CardTitle>
            <AlertCircle className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">0</div>
            <p className="text-xs text-muted-foreground">Active alerts</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Quick Actions</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            <Link
              href="/admin/testing"
              className="rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <h3 className="font-semibold">Testing Tools</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Test APIs, database, and permissions
              </p>
            </Link>
            <Link
              href="/admin/app-management"
              className="rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <h3 className="font-semibold">App Management</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                Manage users, organizations, and config
              </p>
            </Link>
            <Link
              href="/admin/logs"
              className="rounded-lg border p-4 hover:bg-gray-50 dark:hover:bg-gray-800"
            >
              <h3 className="font-semibold">System Logs</h3>
              <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                View and analyze system logs
              </p>
            </Link>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
