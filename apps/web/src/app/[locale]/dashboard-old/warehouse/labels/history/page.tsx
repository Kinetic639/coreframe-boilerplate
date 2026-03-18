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
  History,
  Search,
  Filter,
  Calendar,
  User,
  QrCode,
  MapPin,
  Package,
  MoreHorizontal,
  Download,
} from "lucide-react";

// Mock data - in real app this would come from database
const mockHistory = [
  {
    id: "1",
    timestamp: "2024-01-15T14:30:00Z",
    action: "generated",
    user: "Jan Kowalski",
    details: {
      batch_name: "LOC_2x2_2024-01-15_50szt",
      quantity: 50,
      label_type: "location",
      template: "Medium Location Label",
    },
    status: "success",
  },
  {
    id: "2",
    timestamp: "2024-01-15T13:45:00Z",
    action: "assigned",
    user: "Anna Nowak",
    details: {
      qr_token: "QR_LOC_A1B2C3",
      entity_type: "location",
      entity_name: "Magazyn A > Strefa 1 > Regal 5",
      assignment_method: "manual",
    },
    status: "success",
  },
  {
    id: "3",
    timestamp: "2024-01-15T12:20:00Z",
    action: "scanned",
    user: "Piotr Wiśniewski",
    details: {
      qr_token: "QR_PRD_X7Y8Z9",
      scan_type: "verification",
      entity_name: "Produkt ABC-123",
      scanner_type: "mobile",
    },
    status: "success",
  },
  {
    id: "4",
    timestamp: "2024-01-15T11:10:00Z",
    action: "printed",
    user: "Maria Kowalczyk",
    details: {
      batch_name: "PRD_3x3_2024-01-14_100szt",
      quantity: 100,
      printer: "Brother QL-820NWB",
    },
    status: "success",
  },
  {
    id: "5",
    timestamp: "2024-01-15T10:05:00Z",
    action: "failed_generation",
    user: "Tomasz Nowak",
    details: {
      batch_name: "GEN_Failed_Batch",
      quantity: 200,
      error: "Template validation failed",
      template: "Invalid Template",
    },
    status: "error",
  },
  {
    id: "6",
    timestamp: "2024-01-15T09:15:00Z",
    action: "template_created",
    user: "Jan Kowalski",
    details: {
      template_name: "Custom Product Label v2",
      template_type: "product",
      dimensions: "60x40mm",
    },
    status: "success",
  },
];

const getActionIcon = (action: string) => {
  switch (action) {
    case "generated":
      return <QrCode className="h-4 w-4" />;
    case "assigned":
      return <MapPin className="h-4 w-4" />;
    case "scanned":
      return <Search className="h-4 w-4" />;
    case "printed":
      return <Download className="h-4 w-4" />;
    case "template_created":
      return <Package className="h-4 w-4" />;
    default:
      return <History className="h-4 w-4" />;
  }
};

const getActionLabel = (action: string) => {
  switch (action) {
    case "generated":
      return "Wygenerowano";
    case "assigned":
      return "Przypisano";
    case "scanned":
      return "Zeskanowano";
    case "printed":
      return "Wydrukowano";
    case "failed_generation":
      return "Błąd generowania";
    case "template_created":
      return "Utworzono szablon";
    default:
      return action;
  }
};

const getActionColor = (action: string) => {
  switch (action) {
    case "generated":
      return "text-blue-600 bg-blue-50";
    case "assigned":
      return "text-green-600 bg-green-50";
    case "scanned":
      return "text-purple-600 bg-purple-50";
    case "printed":
      return "text-orange-600 bg-orange-50";
    case "failed_generation":
      return "text-red-600 bg-red-50";
    case "template_created":
      return "text-indigo-600 bg-indigo-50";
    default:
      return "text-gray-600 bg-gray-50";
  }
};

export default function LabelsHistoryPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Historia Etykiet</h1>
          <p className="text-muted-foreground">
            Śledź wszystkie działania związane z etykietami QR i kodami kreskowymi
          </p>
        </div>
      </div>

      {/* Filters and Search */}
      <Card>
        <CardContent className="p-6">
          <div className="flex flex-col gap-4 sm:flex-row">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 transform text-muted-foreground" />
              <Input placeholder="Szukaj w historii działań..." className="pl-10" />
            </div>
            <div className="flex gap-2">
              <Select>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Akcja" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Wszystkie</SelectItem>
                  <SelectItem value="generated">Wygenerowano</SelectItem>
                  <SelectItem value="assigned">Przypisano</SelectItem>
                  <SelectItem value="scanned">Zeskanowano</SelectItem>
                  <SelectItem value="printed">Wydrukowano</SelectItem>
                </SelectContent>
              </Select>
              <Select>
                <SelectTrigger className="w-[140px]">
                  <SelectValue placeholder="Okres" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="today">Dzisiaj</SelectItem>
                  <SelectItem value="week">Ostatni tydzień</SelectItem>
                  <SelectItem value="month">Ostatni miesiąc</SelectItem>
                  <SelectItem value="all">Wszystkie</SelectItem>
                </SelectContent>
              </Select>
              <Button variant="outline" size="icon">
                <Filter className="h-4 w-4" />
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* History Timeline */}
      <div className="space-y-4">
        {mockHistory.map((entry, index) => (
          <Card key={entry.id}>
            <CardContent className="p-6">
              <div className="flex items-start gap-4">
                {/* Timeline marker */}
                <div className="relative">
                  <div
                    className={`flex h-10 w-10 items-center justify-center rounded-full ${getActionColor(entry.action)}`}
                  >
                    {getActionIcon(entry.action)}
                  </div>
                  {index < mockHistory.length - 1 && (
                    <div className="absolute left-1/2 top-10 h-8 w-px -translate-x-1/2 transform bg-border"></div>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="mb-1 flex items-center gap-2">
                        <h3 className="font-semibold">{getActionLabel(entry.action)}</h3>
                        {entry.status === "error" && <Badge variant="destructive">Błąd</Badge>}
                      </div>
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="h-3 w-3" />
                          <span>{entry.user}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          <span>
                            {new Date(entry.timestamp).toLocaleDateString("pl-PL", {
                              year: "numeric",
                              month: "short",
                              day: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                            })}
                          </span>
                        </div>
                      </div>
                    </div>
                    <Button variant="ghost" size="sm">
                      <MoreHorizontal className="h-4 w-4" />
                    </Button>
                  </div>

                  {/* Details */}
                  <div className="mt-3 rounded-lg bg-muted/30 p-4">
                    {entry.action === "generated" && entry.details.batch_name && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Partia:</span>
                          <span className="font-medium">{entry.details.batch_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ilość:</span>
                          <span>{entry.details.quantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Szablon:</span>
                          <span>{entry.details.template}</span>
                        </div>
                      </div>
                    )}

                    {entry.action === "assigned" && entry.details.qr_token && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">QR Token:</span>
                          <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                            {entry.details.qr_token}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Przypisano do:</span>
                          <span>{entry.details.entity_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Metoda:</span>
                          <span>
                            {entry.details.assignment_method === "manual"
                              ? "Ręcznie"
                              : "Automatycznie"}
                          </span>
                        </div>
                      </div>
                    )}

                    {entry.action === "scanned" && entry.details.qr_token && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">QR Token:</span>
                          <span className="rounded bg-gray-100 px-2 py-1 font-mono text-xs">
                            {entry.details.qr_token}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Element:</span>
                          <span>{entry.details.entity_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Skaner:</span>
                          <span>
                            {entry.details.scanner_type === "mobile" ? "Telefon" : "Stacjonarny"}
                          </span>
                        </div>
                      </div>
                    )}

                    {entry.action === "printed" && entry.details.batch_name && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Partia:</span>
                          <span className="font-medium">{entry.details.batch_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Ilość:</span>
                          <span>{entry.details.quantity}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Drukarka:</span>
                          <span>{entry.details.printer}</span>
                        </div>
                      </div>
                    )}

                    {entry.action === "failed_generation" && entry.details.error && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Partia:</span>
                          <span className="font-medium">{entry.details.batch_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Błąd:</span>
                          <span className="text-red-600">{entry.details.error}</span>
                        </div>
                      </div>
                    )}

                    {entry.action === "template_created" && entry.details.template_name && (
                      <div className="space-y-2 text-sm">
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Szablon:</span>
                          <span className="font-medium">{entry.details.template_name}</span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Typ:</span>
                          <span>
                            {entry.details.template_type === "product" ? "Produkt" : "Lokalizacja"}
                          </span>
                        </div>
                        <div className="flex justify-between">
                          <span className="text-muted-foreground">Wymiary:</span>
                          <span>{entry.details.dimensions}</span>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Load More */}
      <div className="text-center">
        <Button variant="outline">Załaduj więcej</Button>
      </div>
    </div>
  );
}
