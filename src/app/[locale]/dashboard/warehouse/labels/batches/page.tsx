import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Layers,
  Search,
  Filter,
  Download,
  Eye,
  MoreHorizontal,
  Calendar,
  User,
  Package,
  FileText,
} from "lucide-react";

// Mock data - in real app this would come from database
const mockBatches = [
  {
    id: "1",
    batch_name: "LOC_2x2_2024-01-15_50szt",
    description: "Etykiety lokalizacji dla nowego magazynu",
    label_type: "location",
    quantity: 50,
    template_name: "Medium Location Label",
    status: "completed",
    created_at: "2024-01-15T10:30:00Z",
    created_by: "Jan Kowalski",
    download_count: 3,
    print_count: 2,
  },
  {
    id: "2",
    batch_name: "PRD_3x3_2024-01-14_100szt",
    description: "Etykiety produktów - nowa dostawa",
    label_type: "product",
    quantity: 100,
    template_name: "Small Product Label",
    status: "generating",
    created_at: "2024-01-14T15:45:00Z",
    created_by: "Anna Nowak",
    download_count: 0,
    print_count: 0,
  },
  {
    id: "3",
    batch_name: "GEN_5x8_2024-01-13_200szt",
    description: "Uniwersalne etykiety do testów",
    label_type: "generic",
    quantity: 200,
    template_name: "Large Generic Label",
    status: "ready",
    created_at: "2024-01-13T09:20:00Z",
    created_by: "Piotr Wiśniewski",
    download_count: 1,
    print_count: 1,
  },
  {
    id: "4",
    batch_name: "LOC_4x6_2024-01-12_75szt",
    description: null,
    label_type: "location",
    quantity: 75,
    template_name: "Small Location Label",
    status: "failed",
    created_at: "2024-01-12T14:15:00Z",
    created_by: "Maria Kowalczyk",
    download_count: 0,
    print_count: 0,
  },
];

const getStatusBadge = (status: string) => {
  switch (status) {
    case "completed":
      return (
        <Badge variant="default" className="bg-green-500">
          Ukończona
        </Badge>
      );
    case "generating":
      return <Badge variant="secondary">Generowanie...</Badge>;
    case "ready":
      return <Badge variant="outline">Gotowa</Badge>;
    case "failed":
      return <Badge variant="destructive">Błąd</Badge>;
    default:
      return <Badge variant="secondary">{status}</Badge>;
  }
};

const getTypeLabel = (type: string) => {
  switch (type) {
    case "location":
      return "Lokalizacja";
    case "product":
      return "Produkt";
    case "generic":
      return "Uniwersalna";
    default:
      return type;
  }
};

export default function LabelBatchesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Partie Etykiet</h1>
          <p className="text-muted-foreground">
            Przeglądaj i zarządzaj partiami wygenerowanych etykiet QR
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input placeholder="Szukaj partii po nazwie lub opisie..." className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Select>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Typ etykiety" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="location">Lokalizacja</SelectItem>
                  <SelectItem value="product">Produkt</SelectItem>
                  <SelectItem value="generic">Uniwersalna</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-[120px]">
                  <SelectValue placeholder="Status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="completed">Ukończone</SelectItem>
                  <SelectItem value="ready">Gotowe</SelectItem>
                  <SelectItem value="generating">W trakcie</SelectItem>
                  <SelectItem value="failed">Błędy</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Batches List */}
      <div className="space-y-4">
        {mockBatches.map((batch) => (
          <Card key={batch.id}>
            <CardContent className="p-6">
              <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
                {/* Main Info */}
                <div className="space-y-3 lg:col-span-2">
                  <div className="flex items-start justify-between">
                    <div>
                      <h3 className="text-lg font-semibold">{batch.batch_name}</h3>
                      {batch.description && (
                        <p className="mt-1 text-sm text-muted-foreground">{batch.description}</p>
                      )}
                    </div>
                    {getStatusBadge(batch.status)}
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm">
                    <div className="flex items-center gap-1">
                      <Package className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Typ:</span>
                      <span>{getTypeLabel(batch.label_type)}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <Layers className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Ilość:</span>
                      <span className="font-medium">{batch.quantity}</span>
                    </div>
                    <div className="flex items-center gap-1">
                      <FileText className="h-4 w-4 text-muted-foreground" />
                      <span className="text-muted-foreground">Szablon:</span>
                      <span>{batch.template_name}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-4 text-sm text-muted-foreground">
                    <div className="flex items-center gap-1">
                      <Calendar className="h-4 w-4" />
                      <span>
                        {new Date(batch.created_at).toLocaleDateString("pl-PL", {
                          year: "numeric",
                          month: "short",
                          day: "numeric",
                          hour: "2-digit",
                          minute: "2-digit",
                        })}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <User className="h-4 w-4" />
                      <span>{batch.created_by}</span>
                    </div>
                  </div>
                </div>

                {/* Stats */}
                <div className="space-y-4">
                  <div className="grid grid-cols-2 gap-4 text-sm">
                    <div>
                      <p className="text-muted-foreground">Pobrania</p>
                      <p className="text-2xl font-bold">{batch.download_count}</p>
                    </div>
                    <div>
                      <p className="text-muted-foreground">Wydruki</p>
                      <p className="text-2xl font-bold">{batch.print_count}</p>
                    </div>
                  </div>

                  {batch.status === "generating" && (
                    <div className="space-y-2">
                      <p className="text-sm text-muted-foreground">Postęp</p>
                      <div className="h-2 w-full rounded-full bg-muted">
                        <div
                          className="h-2 animate-pulse rounded-full bg-blue-500"
                          style={{ width: "65%" }}
                        ></div>
                      </div>
                      <p className="text-xs text-muted-foreground">65% ukończone</p>
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex flex-col gap-2">
                  {batch.status === "completed" || batch.status === "ready" ? (
                    <>
                      <Button size="sm">
                        <Download className="mr-2 h-4 w-4" />
                        Pobierz PDF
                      </Button>
                      <Button variant="outline" size="sm">
                        <Eye className="mr-2 h-4 w-4" />
                        Podgląd
                      </Button>
                    </>
                  ) : batch.status === "generating" ? (
                    <Button variant="outline" size="sm" disabled>
                      Generowanie...
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm">
                      <Package className="mr-2 h-4 w-4" />
                      Ponów Generowanie
                    </Button>
                  )}

                  <Button variant="ghost" size="sm">
                    <MoreHorizontal className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <Layers className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Brak partii etykiet</h3>
              <p className="mx-auto max-w-md text-muted-foreground">
                Wygeneruj pierwszą partię etykiet używając generatora etykiet.
              </p>
            </div>
            <Button>Przejdź do Generatora</Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
