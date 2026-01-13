import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Truck,
  Package,
  MapPin,
  CheckCircle,
  Activity,
  ScanLine,
  TrendingUp,
  Calendar,
  Clock,
  Users,
} from "lucide-react";
import Link from "next/link";

// Mock data - in real app this would come from database
const mockStats = {
  todayScans: 127,
  activeOperations: 3,
  completedOperations: 8,
  totalUsers: 12,
};

const scanningOperations = [
  {
    title: "Skanowanie Dostaw",
    description: "Skanuj przychodzące produkty i dostawy",
    href: "/dashboard-old/warehouse/scanning/delivery",
    icon: Truck,
    color: "bg-blue-500",
    badge: "Nowe dostawy",
  },
  {
    title: "Skanowanie Inwentarza",
    description: "Weryfikuj produkty podczas inwentaryzacji",
    href: "/dashboard-old/warehouse/scanning/inventory",
    icon: Package,
    color: "bg-green-500",
    badge: "Audit ready",
  },
  {
    title: "Przypisanie Lokalizacji",
    description: "Przypisuj kody QR do lokalizacji",
    href: "/dashboard-old/warehouse/scanning/assignment",
    icon: MapPin,
    color: "bg-purple-500",
    badge: "Quick setup",
  },
  {
    title: "Weryfikacja Produktów",
    description: "Sprawdzaj informacje o produktach",
    href: "/dashboard-old/warehouse/scanning/verification",
    icon: CheckCircle,
    color: "bg-orange-500",
    badge: "Quality check",
  },
];

const activeOperationsMock = [
  {
    id: "1",
    name: "Dostawa od Supplier ABC",
    type: "delivery",
    progress: 75,
    totalItems: 45,
    scannedItems: 34,
    startedBy: "Jan Kowalski",
    startedAt: "08:30",
    status: "active",
  },
  {
    id: "2",
    name: "Inwentaryzacja Magazynu A",
    type: "inventory",
    progress: 45,
    totalItems: 120,
    scannedItems: 54,
    startedBy: "Anna Nowak",
    startedAt: "09:15",
    status: "active",
  },
  {
    id: "3",
    name: "Przypisanie QR - Strefa B",
    type: "assignment",
    progress: 90,
    totalItems: 20,
    scannedItems: 18,
    startedBy: "Piotr Wiśniewski",
    startedAt: "10:00",
    status: "active",
  },
];

const recentCompletedOperations = [
  {
    id: "4",
    name: "Weryfikacja produktów - Lakiery",
    type: "verification",
    completedAt: "11:45",
    totalItems: 35,
    completedBy: "Maria Kowal",
    duration: "25 min",
  },
  {
    id: "5",
    name: "Dostawa od Supplier XYZ",
    type: "delivery",
    completedAt: "10:30",
    totalItems: 28,
    completedBy: "Tomasz Nowak",
    duration: "45 min",
  },
];

function getOperationTypeLabel(type: string) {
  switch (type) {
    case "delivery":
      return "Dostawa";
    case "inventory":
      return "Inwentarz";
    case "assignment":
      return "Przypisanie";
    case "verification":
      return "Weryfikacja";
    default:
      return type;
  }
}

function getOperationTypeColor(type: string) {
  switch (type) {
    case "delivery":
      return "bg-blue-100 text-blue-800 border-blue-200";
    case "inventory":
      return "bg-green-100 text-green-800 border-green-200";
    case "assignment":
      return "bg-purple-100 text-purple-800 border-purple-200";
    case "verification":
      return "bg-orange-100 text-orange-800 border-orange-200";
    default:
      return "bg-gray-100 text-gray-800 border-gray-200";
  }
}

export default function ScanningMainPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Skanowanie Kodów</h1>
          <p className="text-muted-foreground">
            Zarządzaj operacjami skanowania QR i kodów kreskowych
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard-old/warehouse/scanning/operations">
              <Activity className="mr-2 h-4 w-4" />
              Wszystkie Operacje
            </Link>
          </Button>
        </div>
      </div>

      {/* Statistics Cards */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-4">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Dzisiejsze Skany</CardTitle>
            <ScanLine className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.todayScans.toLocaleString()}</div>
            <p className="text-xs text-muted-foreground">+23% od wczoraj</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywne Operacje</CardTitle>
            <TrendingUp className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.activeOperations}</div>
            <p className="text-xs text-muted-foreground">W toku</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Zakończone Dzisiaj</CardTitle>
            <Calendar className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.completedOperations}</div>
            <p className="text-xs text-muted-foreground">Operacji ukończonych</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Aktywni Użytkownicy</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{mockStats.totalUsers}</div>
            <p className="text-xs text-muted-foreground">Skanujących obecnie</p>
          </CardContent>
        </Card>
      </div>

      {/* Scanning Operations */}
      <Card>
        <CardHeader>
          <CardTitle>Rodzaje Operacji Skanowania</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {scanningOperations.map((operation) => {
              const Icon = operation.icon;
              return (
                <Link
                  key={operation.title}
                  href={operation.href}
                  className="group relative overflow-hidden rounded-lg border p-6 transition-shadow hover:shadow-md"
                >
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-4">
                      <div
                        className={`rounded-lg p-3 ${operation.color} transition-transform group-hover:scale-110`}
                      >
                        <Icon className="h-6 w-6 text-white" />
                      </div>
                      <div className="flex-1">
                        <h3 className="text-lg font-semibold transition-colors group-hover:text-primary">
                          {operation.title}
                        </h3>
                        <p className="text-sm text-muted-foreground">{operation.description}</p>
                      </div>
                    </div>
                    <Badge variant="outline" className="text-xs">
                      {operation.badge}
                    </Badge>
                  </div>
                </Link>
              );
            })}
          </div>
        </CardContent>
      </Card>

      {/* Active Operations and Recent Completed */}
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        {/* Active Operations */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle>Aktywne Operacje</CardTitle>
            <Button variant="outline" size="sm" asChild>
              <Link href="/dashboard-old/warehouse/scanning/operations">
                <Activity className="mr-2 h-4 w-4" />
                Zobacz Wszystkie
              </Link>
            </Button>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {activeOperationsMock.map((operation) => (
                <div key={operation.id} className="rounded-lg border p-4">
                  <div className="mb-2 flex items-center justify-between">
                    <h4 className="font-medium">{operation.name}</h4>
                    <Badge className={getOperationTypeColor(operation.type)}>
                      {getOperationTypeLabel(operation.type)}
                    </Badge>
                  </div>

                  <div className="space-y-2">
                    <div className="flex justify-between text-sm text-muted-foreground">
                      <span>Postęp</span>
                      <span>
                        {operation.scannedItems}/{operation.totalItems} elementów
                      </span>
                    </div>

                    <div className="h-2 w-full rounded-full bg-secondary">
                      <div
                        className="h-2 rounded-full bg-primary transition-all duration-300"
                        style={{ width: `${operation.progress}%` }}
                      />
                    </div>

                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{operation.startedBy}</span>
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {operation.startedAt}
                      </span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Recent Completed Operations */}
        <Card>
          <CardHeader>
            <CardTitle>Ostatnio Zakończone</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              {recentCompletedOperations.map((operation) => (
                <div
                  key={operation.id}
                  className="flex items-start gap-3 rounded-lg bg-muted/30 p-3"
                >
                  <div className="mt-2 h-2 w-2 flex-shrink-0 rounded-full bg-green-500" />
                  <div className="flex-1 space-y-1">
                    <h4 className="text-sm font-medium">{operation.name}</h4>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <Badge
                        variant="outline"
                        className={`${getOperationTypeColor(operation.type)} text-xs`}
                      >
                        {getOperationTypeLabel(operation.type)}
                      </Badge>
                      <span>{operation.totalItems} elementów</span>
                      <span>{operation.duration}</span>
                    </div>
                    <div className="flex justify-between text-xs text-muted-foreground">
                      <span>{operation.completedBy}</span>
                      <span>{operation.completedAt}</span>
                    </div>
                  </div>
                </div>
              ))}

              <Button variant="outline" className="w-full" asChild>
                <Link href="/dashboard-old/warehouse/scanning/operations">
                  Zobacz historię operacji
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
