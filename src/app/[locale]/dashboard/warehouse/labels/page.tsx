"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { QrCode, Plus, FileText, Scan, Package, MapPin, Eye, Edit, Printer } from "lucide-react";
import { LabelGenerationDialog } from "@/modules/warehouse/components/labels/LabelGenerationDialog";
import { LabelAssignmentDialog } from "@/modules/warehouse/components/labels/LabelAssignmentDialog";

// Mock template data - replace with actual Supabase data
const mockTemplates = [
  {
    id: "template-1",
    name: "Etykieta produktu - standard",
    label_type: "product" as const,
    description: "Standardowa etykieta produktu z kodem QR",
    width_mm: 50,
    height_mm: 30,
    template_config: {
      fields: ["name", "code", "sku", "price"],
    },
    created_at: "2024-01-15T10:00:00Z",
    is_default: true,
  },
  {
    id: "template-2",
    name: "Etykieta lokalizacji - mała",
    label_type: "location" as const,
    description: "Kompaktowa etykieta lokalizacji",
    width_mm: 40,
    height_mm: 25,
    template_config: {
      fields: ["name", "code", "level"],
    },
    created_at: "2024-01-20T14:30:00Z",
    is_default: false,
  },
  {
    id: "template-3",
    name: "Etykieta produktu - duża",
    label_type: "product" as const,
    description: "Większa etykieta z dodatkowymi informacjami",
    width_mm: 70,
    height_mm: 40,
    template_config: {
      fields: ["name", "code", "sku", "price", "description"],
    },
    created_at: "2024-01-25T09:15:00Z",
    is_default: false,
  },
];

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
  const [generationDialogOpen, setGenerationDialogOpen] = useState(false);
  const [assignmentDialogOpen, setAssignmentDialogOpen] = useState(false);
  const [assignmentEntityType, setAssignmentEntityType] = useState<"product" | "location">(
    "product"
  );

  const handleAssignLabels = (type: "product" | "location") => {
    setAssignmentEntityType(type);
    setAssignmentDialogOpen(true);
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Etykiety i kody QR</h1>
          <p className="text-muted-foreground">
            Zarządzaj etykietami, szablonami i kodami QR dla produktów i lokalizacji
          </p>
        </div>
      </div>

      <Tabs defaultValue="overview" className="space-y-6">
        <TabsList>
          <TabsTrigger value="overview">Przegląd</TabsTrigger>
          <TabsTrigger value="templates">Szablony</TabsTrigger>
          <TabsTrigger value="generate">Generuj</TabsTrigger>
          <TabsTrigger value="assign">Przypisz</TabsTrigger>
        </TabsList>

        <TabsContent value="overview" className="space-y-6">
          {/* Statistics Cards */}
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Łączna liczba etykiet</CardTitle>
                <QrCode className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.totalLabels.toLocaleString()}</div>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Przypisane etykiety</CardTitle>
                <Package className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-green-600">
                  {mockStats.assignedLabels.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">
                  {((mockStats.assignedLabels / mockStats.totalLabels) * 100).toFixed(1)}%
                  wszystkich
                </p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Nieprzypisane</CardTitle>
                <Scan className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-orange-600">
                  {mockStats.unassignedLabels.toLocaleString()}
                </div>
                <p className="text-xs text-muted-foreground">Gotowe do przypisania</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Skany w tym miesiącu</CardTitle>
                <Eye className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{mockStats.scansThisMonth}</div>
                <p className="text-xs text-muted-foreground">+12% vs poprzedni miesiąc</p>
              </CardContent>
            </Card>
          </div>

          {/* Recent Activity */}
          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Scan className="h-5 w-5" />
                  Ostatnie skanowania
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
                      <div className="text-right">
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.scanned_at).toLocaleDateString("pl-PL")}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {new Date(scan.scanned_at).toLocaleTimeString("pl-PL", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <FileText className="h-5 w-5" />
                  Szablony etykiet
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-4">
                  <div className="flex items-center justify-between">
                    <span className="text-sm">Łączna liczba szablonów</span>
                    <Badge variant="secondary">{mockStats.templates}</Badge>
                  </div>
                  <div className="space-y-3">
                    {mockTemplates.slice(0, 3).map((template) => (
                      <div key={template.id} className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                          {template.label_type === "product" ? (
                            <Package className="h-4 w-4 text-muted-foreground" />
                          ) : (
                            <MapPin className="h-4 w-4 text-muted-foreground" />
                          )}
                          <div>
                            <p className="text-sm font-medium">{template.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {template.width_mm}×{template.height_mm}mm
                            </p>
                          </div>
                        </div>
                        {template.is_default && (
                          <Badge variant="outline" className="text-xs">
                            Domyślny
                          </Badge>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="templates" className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-lg font-medium">Szablony etykiet</h3>
              <p className="text-sm text-muted-foreground">
                Zarządzaj szablonami do generowania etykiet
              </p>
            </div>
            <Button>
              <Plus className="mr-2 h-4 w-4" />
              Nowy szablon
            </Button>
          </div>

          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {mockTemplates.map((template) => (
              <Card key={template.id}>
                <CardHeader>
                  <div className="flex items-center justify-between">
                    <CardTitle className="flex items-center gap-2 text-base">
                      {template.label_type === "product" ? (
                        <Package className="h-4 w-4" />
                      ) : (
                        <MapPin className="h-4 w-4" />
                      )}
                      {template.name}
                    </CardTitle>
                    {template.is_default && (
                      <Badge variant="secondary" className="text-xs">
                        Domyślny
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="mb-2 text-sm text-muted-foreground">{template.description}</p>
                    <div className="flex items-center gap-4 text-xs text-muted-foreground">
                      <span>
                        Rozmiar: {template.width_mm}×{template.height_mm}mm
                      </span>
                      <span>Pola: {template.template_config.fields?.length || 0}</span>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-1">
                    {template.template_config.fields?.map((field: string) => (
                      <Badge key={field} variant="outline" className="text-xs">
                        {field}
                      </Badge>
                    ))}
                  </div>

                  <div className="flex items-center gap-2 pt-2">
                    <Button variant="outline" size="sm">
                      <Eye className="mr-2 h-3 w-3" />
                      Podgląd
                    </Button>
                    <Button variant="outline" size="sm">
                      <Edit className="mr-2 h-3 w-3" />
                      Edytuj
                    </Button>
                    <Button variant="outline" size="sm" disabled>
                      <Printer className="mr-2 h-3 w-3" />
                      Edytuj w kreatorze
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </TabsContent>

        <TabsContent value="generate" className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Generuj etykiety</h3>
            <p className="text-sm text-muted-foreground">
              Utwórz nowe etykiety z kodami QR dla produktów lub lokalizacji
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Etykiety produktów
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generuj etykiety z kodami QR dla produktów w magazynie
                </p>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Dostępne szablony:</div>
                  {mockTemplates
                    .filter((t) => t.label_type === "product")
                    .map((template) => (
                      <div key={template.id} className="flex items-center justify-between text-sm">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {template.width_mm}×{template.height_mm}mm
                        </Badge>
                      </div>
                    ))}
                </div>
                <Button className="w-full" disabled>
                  <Plus className="mr-2 h-4 w-4" />
                  Użyj kreatora etykiet
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Etykiety lokalizacji
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Generuj etykiety z kodami QR dla lokalizacji magazynowych
                </p>
                <div className="space-y-2">
                  <div className="text-xs text-muted-foreground">Dostępne szablony:</div>
                  {mockTemplates
                    .filter((t) => t.label_type === "location")
                    .map((template) => (
                      <div key={template.id} className="flex items-center justify-between text-sm">
                        <span>{template.name}</span>
                        <Badge variant="outline" className="text-xs">
                          {template.width_mm}×{template.height_mm}mm
                        </Badge>
                      </div>
                    ))}
                </div>
                <Button className="w-full" disabled>
                  <Plus className="mr-2 h-4 w-4" />
                  Użyj kreatora etykiet
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>

        <TabsContent value="assign" className="space-y-6">
          <div>
            <h3 className="text-lg font-medium">Przypisz etykiety</h3>
            <p className="text-sm text-muted-foreground">
              Przypisz istniejące etykiety QR do produktów lub lokalizacji
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2">
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <Package className="h-5 w-5" />
                  Przypisz do produktu
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Zeskanuj kod QR etykiety i przypisz go do wybranego produktu
                </p>
                <div className="rounded-lg bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    Nieprzypisane etykiety produktów
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.floor(mockStats.unassignedLabels * 0.6)}
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleAssignLabels("product")}>
                  <Scan className="mr-2 h-4 w-4" />
                  Przypisz do produktu
                </Button>
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <MapPin className="h-5 w-5" />
                  Przypisz do lokalizacji
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <p className="text-sm text-muted-foreground">
                  Zeskanuj kod QR etykiety i przypisz go do wybranej lokalizacji
                </p>
                <div className="rounded-lg bg-muted/20 p-4">
                  <div className="mb-2 flex items-center gap-2 text-sm text-muted-foreground">
                    <QrCode className="h-4 w-4" />
                    Nieprzypisane etykiety lokalizacji
                  </div>
                  <div className="text-2xl font-bold">
                    {Math.floor(mockStats.unassignedLabels * 0.4)}
                  </div>
                </div>
                <Button className="w-full" onClick={() => handleAssignLabels("location")}>
                  <Scan className="mr-2 h-4 w-4" />
                  Przypisz do lokalizacji
                </Button>
              </CardContent>
            </Card>
          </div>
        </TabsContent>
      </Tabs>

      {/* Dialogs */}
      <LabelGenerationDialog
        templates={mockTemplates}
        trigger={null}
        open={generationDialogOpen}
        onClose={() => setGenerationDialogOpen(false)}
      />

      <LabelAssignmentDialog
        open={assignmentDialogOpen}
        onClose={() => setAssignmentDialogOpen(false)}
        entityType={assignmentEntityType}
      />
    </div>
  );
}
