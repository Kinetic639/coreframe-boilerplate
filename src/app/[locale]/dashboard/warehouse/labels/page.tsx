import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  QrCode,
  Plus,
  FileText,
  Layers,
  History,
  Tag,
  Scan,
  TrendingUp,
  Calendar,
} from "lucide-react";
import Link from "next/link";

// Mock data - in real app this would come from database
const mockStats = {
  totalLabels: 1247,
  activeLabels: 892,
  assignedLabels: 678,
  todayGenerated: 23,
};

const mockRecentActivity = [
  {
    id: "1",
    type: "generated",
    description: "Wygenerowano partię 50 etykiet lokalizacji",
    timestamp: "2 godziny temu",
    user: "Jan Kowalski",
  },
  {
    id: "2",
    type: "assigned",
    description: "Przypisano QR do lokalizacji: Magazyn A > Strefa 1 > Regal 5",
    timestamp: "4 godziny temu",
    user: "Anna Nowak",
  },
  {
    id: "3",
    type: "scanned",
    description: "Zeskanowano 15 kodów QR podczas inwentaryzacji",
    timestamp: "6 godzin temu",
    user: "Piotr Wiśniewski",
  },
];

const quickActions = [
  {
    title: "Szablony",
    description: "Zarządzaj szablonami etykiet",
    href: "/dashboard/warehouse/labels/templates",
    icon: FileText,
    color: "bg-green-500",
  },
  {
    title: "Partie",
    description: "Przeglądaj partie etykiet",
    href: "/dashboard/warehouse/labels/batches",
    icon: Layers,
    color: "bg-purple-500",
  },
  {
    title: "Skanowanie",
    description: "Rozpocznij skanowanie kodów",
    href: "/dashboard/warehouse/scanning",
    icon: Scan,
    color: "bg-orange-500",
  },
];

export default function LabelsMainPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Etykiety i Kody QR</h1>
          <p className="text-muted-foreground">
            Zarządzaj etykietami QR, generuj nowe kody i przypisuj je do lokalizacji oraz produktów
          </p>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Wszystkie Etykiety</CardTitle>
            <QrCode className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalLabels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+12% od ostatniego miesiąca</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.activeLabels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((mockStats.activeLabels / mockStats.totalLabels) * 100).toFixed(1)}% wszystkich
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Przypisane</CardTitle>
            <Tag className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.assignedLabels.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">
              {((mockStats.assignedLabels / mockStats.activeLabels) * 100).toFixed(1)}% aktywnych
            </p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dzisiaj</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.todayGenerated}</div>
            <p className="text-xs text-muted-foreground">Nowych etykiet wygenerowanych</p>
          </CardContent>
        </Card>
      </div>

      {/* Quick Actions */}
      <Card>
        <CardHeader>
          <CardTitle>Szybkie Akcje</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3">
            {quickActions.map((action) => {
              const Icon = action.icon;
              return (
                <Link
                  key={action.title}
                  href={action.href}
                  className="group relative overflow-hidden rounded-lg border p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-center gap-4">
                    <div
                      className={`rounded-lg p-3 ${action.color} transition-transform group-hover:scale-110`}
                    >
                      <Icon className="h-6 w-6 text-white" />
                    </div>
                    <div className="flex-1">
                      <h3 className="text-lg font-semibold transition-colors group-hover:text-primary">
                        {action.title}
                      </h3>
                      <p className="text-sm text-muted-foreground">{action.description}</p>
                    </div>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Recent Activity and Templates */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Ostatnia Aktywność</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/warehouse/labels/history">
                <History className="mr-2 h-4 w-4" />
                Zobacz Wszystkie
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {mockRecentActivity.map((activity) => (
                <div key={activity.id} className="flex items-start gap-3">
                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-primary" />
                  <div className="flex-1 space-y-1">
                    <p className="text-sm text-foreground">{activity.description}</p>
                    <div className="flex items-center gap-2 text-xs text-muted-foreground">
                      <span>{activity.timestamp}</span>
                      <span>•</span>
                      <span>{activity.user}</span>
                      <Badge variant="outline" className="ml-auto text-xs">
                        {activity.type === "generated" && "Wygenerowano"}
                        {activity.type === "assigned" && "Przypisano"}
                        {activity.type === "scanned" && "Zeskanowano"}
                      </Badge>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* System Templates */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Szablony Systemowe</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard/warehouse/labels/templates">
                <FileText className="mr-2 h-4 w-4" />
                Zarządzaj
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div>
                  <h4 className="text-sm font-medium">Small Location Label</h4>
                  <p className="text-xs text-muted-foreground">25×25mm • QR tylko kod</p>
                </div>
                <Badge variant="secondary">System</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div>
                  <h4 className="text-sm font-medium">Medium Location Label</h4>
                  <p className="text-xs text-muted-foreground">50×25mm • QR + tekst</p>
                </div>
                <Badge variant="secondary">System</Badge>
              </div>

              <div className="flex items-center justify-between rounded-lg bg-muted/30 p-3">
                <div>
                  <h4 className="text-sm font-medium">Large Product Label</h4>
                  <p className="text-xs text-muted-foreground">75×50mm • QR + kod kreskowy</p>
                </div>
                <Badge variant="secondary">System</Badge>
              </div>

              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard/warehouse/labels/templates/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Stwórz Własny Szablon
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
