import { Metadata } from "next";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  FileTextIcon,
  UsersIcon,
  PackageIcon,
  ShieldIcon,
  DownloadIcon,
  CalendarIcon,
  TrendingUpIcon,
  AlertTriangleIcon,
} from "lucide-react";

export const metadata: Metadata = {
  title: "Activity Reports",
  description: "Generate and view detailed activity reports and analytics",
};

export default function ReportsPage() {
  const reportTypes = [
    {
      id: "user-activity",
      title: "User Activity Report",
      description: "Detailed breakdown of user activities, login patterns, and engagement metrics",
      icon: UsersIcon,
      features: [
        "Activity counts per user",
        "Login/logout tracking",
        "Most active users",
        "Usage patterns",
      ],
      frequency: "Daily, Weekly, Monthly",
      color: "#3b82f6",
    },
    {
      id: "module-activity",
      title: "Module Activity Report",
      description: "Module-specific activity analysis and usage statistics",
      icon: PackageIcon,
      features: ["Activity by module", "Feature usage", "Performance metrics", "Adoption rates"],
      frequency: "Weekly, Monthly",
      color: "#10b981",
    },
    {
      id: "security-audit",
      title: "Security Audit Report",
      description: "Security events, failed logins, and compliance tracking",
      icon: ShieldIcon,
      features: [
        "Failed login attempts",
        "Permission changes",
        "Admin actions",
        "Compliance tracking",
      ],
      frequency: "Daily, Weekly",
      color: "#ef4444",
      restricted: true,
    },
    {
      id: "system-performance",
      title: "System Performance Report",
      description: "System health, error rates, and performance metrics",
      icon: TrendingUpIcon,
      features: ["Error tracking", "Response times", "System health", "Performance trends"],
      frequency: "Daily, Weekly",
      color: "#f59e0b",
    },
  ];

  const quickStats = [
    { label: "Reports Generated", value: "127", icon: FileTextIcon },
    { label: "Last Generated", value: "2 hours ago", icon: CalendarIcon },
    { label: "Export Formats", value: "PDF, CSV, JSON", icon: DownloadIcon },
    { label: "Data Retention", value: "2 years", icon: AlertTriangleIcon },
  ];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Activity Reports</h1>
        <p className="text-muted-foreground">
          Generate comprehensive reports on activity data, user behavior, and system performance
        </p>
      </div>

      {/* Quick Stats */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {quickStats.map((stat) => (
          <Card key={stat.label}>
            <CardContent className="p-4">
              <div className="flex items-center gap-3">
                <stat.icon className="h-5 w-5 text-muted-foreground" />
                <div>
                  <p className="text-sm font-medium">{stat.label}</p>
                  <p className="text-lg font-bold">{stat.value}</p>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Report Types */}
      <div>
        <h2 className="mb-4 text-xl font-semibold">Available Reports</h2>
        <div className="grid gap-4 lg:grid-cols-2">
          {reportTypes.map((report) => (
            <Card key={report.id} className="relative">
              <CardHeader>
                <div className="flex items-start justify-between">
                  <div className="flex items-center gap-3">
                    <div
                      className="rounded-lg p-2"
                      style={{ backgroundColor: `${report.color}20`, color: report.color }}
                    >
                      <report.icon className="h-5 w-5" />
                    </div>
                    <div>
                      <CardTitle className="text-lg">{report.title}</CardTitle>
                      <CardDescription>{report.description}</CardDescription>
                    </div>
                  </div>
                  {report.restricted && (
                    <Badge variant="outline" className="text-xs">
                      Restricted
                    </Badge>
                  )}
                </div>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  {/* Features */}
                  <div>
                    <h4 className="mb-2 text-sm font-medium">Includes:</h4>
                    <ul className="space-y-1 text-sm text-muted-foreground">
                      {report.features.map((feature) => (
                        <li key={feature} className="flex items-center gap-2">
                          <div className="h-1 w-1 rounded-full bg-current" />
                          {feature}
                        </li>
                      ))}
                    </ul>
                  </div>

                  {/* Frequency */}
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">Frequency:</span>
                    <Badge variant="outline">{report.frequency}</Badge>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-2 pt-2">
                    <Button size="sm" className="flex-1" disabled={report.restricted}>
                      <FileTextIcon className="mr-2 h-4 w-4" />
                      Generate Report
                    </Button>
                    <Button size="sm" variant="outline" disabled={report.restricted}>
                      <DownloadIcon className="mr-2 h-4 w-4" />
                      Export
                    </Button>
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Recent Reports */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Reports</CardTitle>
          <CardDescription>Recently generated reports and exports</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {[
              {
                name: "Weekly User Activity Report",
                date: "2 hours ago",
                type: "PDF",
                size: "2.4 MB",
              },
              { name: "Module Usage Analysis", date: "1 day ago", type: "CSV", size: "890 KB" },
              { name: "Security Audit Summary", date: "3 days ago", type: "PDF", size: "1.2 MB" },
              {
                name: "System Performance Report",
                date: "1 week ago",
                type: "JSON",
                size: "456 KB",
              },
            ].map((report, index) => (
              <div key={index} className="flex items-center justify-between rounded-lg border p-3">
                <div className="flex items-center gap-3">
                  <FileTextIcon className="h-4 w-4 text-muted-foreground" />
                  <div>
                    <p className="text-sm font-medium">{report.name}</p>
                    <p className="text-xs text-muted-foreground">{report.date}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <Badge variant="outline" className="text-xs">
                    {report.type}
                  </Badge>
                  <span className="text-xs text-muted-foreground">{report.size}</span>
                  <Button size="sm" variant="ghost">
                    <DownloadIcon className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
