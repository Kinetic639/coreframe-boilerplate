import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Edit, Trash2, Copy, Eye } from "lucide-react";
import Link from "next/link";

// Mock data - in real app this would come from database
const mockTemplates = [
  {
    id: "1",
    name: "Small Location Label",
    description: "Compact 25x25mm QR label for small locations",
    label_type: "location",
    category: "small",
    width_mm: 25,
    height_mm: 25,
    is_system: true,
    is_default: true,
    created_at: "2024-01-01T00:00:00Z",
    usage_count: 245,
  },
  {
    id: "2",
    name: "Medium Product Label",
    description: "Standard 50x25mm QR label with product name",
    label_type: "product",
    category: "medium",
    width_mm: 50,
    height_mm: 25,
    is_system: true,
    is_default: false,
    created_at: "2024-01-01T00:00:00Z",
    usage_count: 156,
  },
  {
    id: "3",
    name: "Custom Shelf Label",
    description: "Niestandardowa etykieta półki z dodatkowymi informacjami",
    label_type: "location",
    category: "custom",
    width_mm: 60,
    height_mm: 40,
    is_system: false,
    is_default: false,
    created_at: "2024-02-15T00:00:00Z",
    usage_count: 42,
  },
];

export default function LabelTemplatesPage() {
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Szablony Etykiet</h1>
          <p className="text-muted-foreground">
            Zarządzaj szablonami etykiet QR i dostosowuj ich wygląd
          </p>
        </div>
        <div className="flex gap-2">
          <Button asChild>
            <Link href="/dashboard/warehouse/labels/templates/create">
              <Plus className="mr-2 h-4 w-4" />
              Nowy Szablon
            </Link>
          </Button>
        </div>
      </div>

      {/* Templates Grid */}
      <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
        {mockTemplates.map((template) => (
          <Card key={template.id} className="relative">
            <CardHeader>
              <div className="flex items-start justify-between">
                <div className="space-y-1">
                  <CardTitle className="text-lg">{template.name}</CardTitle>
                  <p className="text-sm text-muted-foreground">{template.description}</p>
                </div>
                <div className="flex gap-1">
                  {template.is_system && <Badge variant="secondary">System</Badge>}
                  {template.is_default && <Badge variant="outline">Domyślny</Badge>}
                </div>
              </div>
            </CardHeader>
            <CardContent>
              <div className="space-y-4">
                {/* Template Details */}
                <div className="grid grid-cols-2 gap-4 text-sm">
                  <div>
                    <p className="text-muted-foreground">Typ:</p>
                    <p className="font-medium">
                      {template.label_type === "location" ? "Lokalizacja" : "Produkt"}
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Rozmiar:</p>
                    <p className="font-medium">
                      {template.width_mm}×{template.height_mm}mm
                    </p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Kategoria:</p>
                    <p className="font-medium capitalize">{template.category}</p>
                  </div>
                  <div>
                    <p className="text-muted-foreground">Użycia:</p>
                    <p className="font-medium">{template.usage_count}</p>
                  </div>
                </div>

                {/* Preview Area */}
                <div className="flex min-h-[80px] items-center justify-center rounded-lg bg-muted/30 p-4">
                  <div
                    className="flex items-center justify-center border-2 border-dashed border-muted-foreground/30 bg-white text-xs text-muted-foreground"
                    style={{
                      width: `${Math.min(template.width_mm * 2, 80)}px`,
                      height: `${Math.min(template.height_mm * 2, 50)}px`,
                    }}
                  >
                    Podgląd
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" className="flex-1">
                    <Eye className="mr-2 h-4 w-4" />
                    Podgląd
                  </Button>
                  {!template.is_system && (
                    <Button variant="outline" size="sm" className="flex-1">
                      <Edit className="mr-2 h-4 w-4" />
                      Edytuj
                    </Button>
                  )}
                  <Button variant="outline" size="sm">
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!template.is_system && (
                    <Button variant="outline" size="sm">
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Empty State for Custom Templates */}
      <Card>
        <CardContent className="p-8 text-center">
          <div className="space-y-4">
            <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
              <FileText className="h-8 w-8 text-muted-foreground" />
            </div>
            <div className="space-y-2">
              <h3 className="text-lg font-semibold">Stwórz własny szablon</h3>
              <p className="mx-auto max-w-md text-muted-foreground">
                Dostosuj wygląd etykiet do swoich potrzeb. Określ rozmiary, pozycję QR, tekst i inne
                elementy.
              </p>
            </div>
            <Button asChild>
              <Link href="/dashboard/warehouse/labels/templates/create">
                <Plus className="mr-2 h-4 w-4" />
                Rozpocznij tworzenie
              </Link>
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
