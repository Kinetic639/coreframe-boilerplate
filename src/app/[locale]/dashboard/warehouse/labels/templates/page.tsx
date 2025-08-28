"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { FileText, Plus, Edit, Trash2, Copy, Eye, Loader2 } from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import type { LabelTemplate } from "@/lib/types/qr-system";
import { LabelPreview } from "@/modules/warehouse/components/labels/LabelPreview";
import { generateQRToken } from "@/lib/utils/qr-generator";

interface TemplateWithPreview extends LabelTemplate {
  usage_count?: number;
}

export default function LabelTemplatesPage() {
  const [templates, setTemplates] = useState<TemplateWithPreview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<TemplateWithPreview | null>(null);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    fetchTemplates();
  }, []);

  const fetchTemplates = async () => {
    try {
      setIsLoading(true);
      const response = await fetch("/api/labels/templates");
      const data = await response.json();

      if (data.success) {
        setTemplates(data.templates);
      } else {
        toast.error("Błąd podczas pobierania szablonów", {
          description: data.error || "Spróbuj ponownie",
        });
      }
    } catch (error) {
      console.error("Error fetching templates:", error);
      toast.error("Błąd podczas pobierania szablonów", {
        description: "Sprawdź połączenie i spróbuj ponownie",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handlePreviewTemplate = (template: TemplateWithPreview) => {
    setSelectedTemplate(template);
    setShowPreview(true);
  };

  const handleEditTemplate = (template: TemplateWithPreview) => {
    // Navigate to edit page with template ID
    window.location.href = `/dashboard/warehouse/labels/templates/edit/${template.id}`;
  };

  const handleCloneTemplate = async (template: TemplateWithPreview) => {
    try {
      const cloneData = {
        ...template,
        name: `${template.name} (kopia)`,
        is_system: false,
        is_default: false,
      };
      // Remove fields that shouldn't be cloned
      delete cloneData.id;
      delete cloneData.created_at;
      delete cloneData.updated_at;
      delete cloneData.usage_count;

      const response = await fetch("/api/labels/templates", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(cloneData),
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Szablon został sklonowany!", {
          description: "Nowy szablon został utworzony na podstawie wybranego",
        });
        fetchTemplates(); // Refresh the list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error cloning template:", error);
      toast.error("Błąd podczas klonowania szablonu", {
        description: "Spróbuj ponownie",
      });
    }
  };

  const handleDeleteTemplate = async (template: TemplateWithPreview) => {
    if (!confirm(`Czy na pewno chcesz usunąć szablon "${template.name}"?`)) {
      return;
    }

    try {
      const response = await fetch(`/api/labels/templates/${template.id}`, {
        method: "DELETE",
      });

      const data = await response.json();
      if (data.success) {
        toast.success("Szablon został usunięty");
        fetchTemplates(); // Refresh the list
      } else {
        throw new Error(data.error);
      }
    } catch (error) {
      console.error("Error deleting template:", error);
      toast.error("Błąd podczas usuwania szablonu", {
        description: "Spróbuj ponownie",
      });
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-5 w-5 animate-spin" />
          <span>Ładowanie szablonów...</span>
        </div>
      </div>
    );
  }

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
        {templates.map((template) => (
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
                      {template.label_type === "location"
                        ? "Lokalizacja"
                        : template.label_type === "product"
                          ? "Produkt"
                          : "Uniwersalna"}
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
                    <p className="font-medium">{template.usage_count || 0}</p>
                  </div>
                </div>

                {/* Preview Area */}
                <div className="flex min-h-[80px] items-center justify-center rounded-lg bg-muted/30 p-4">
                  <div
                    className="flex cursor-pointer items-center justify-center border-2 border-dashed border-muted-foreground/30 bg-white text-xs text-muted-foreground transition-colors hover:bg-muted/10"
                    style={{
                      width: `${Math.min(Number(template.width_mm) * 2, 80)}px`,
                      height: `${Math.min(Number(template.height_mm) * 2, 50)}px`,
                    }}
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    Kliknij dla podglądu
                  </div>
                </div>

                {/* Actions */}
                <div className="flex gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => handlePreviewTemplate(template)}
                  >
                    <Eye className="mr-2 h-4 w-4" />
                    Podgląd
                  </Button>
                  {!template.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      className="flex-1"
                      onClick={() => handleEditTemplate(template)}
                    >
                      <Edit className="mr-2 h-4 w-4" />
                      Edytuj
                    </Button>
                  )}
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleCloneTemplate(template)}
                    title="Klonuj szablon"
                  >
                    <Copy className="h-4 w-4" />
                  </Button>
                  {!template.is_system && (
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => handleDeleteTemplate(template)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Preview Dialog */}
      {showPreview && selectedTemplate && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="max-h-[90vh] w-full max-w-2xl overflow-auto rounded-lg bg-background shadow-lg">
            <div className="p-6">
              <div className="mb-4 flex items-center justify-between">
                <h2 className="text-xl font-semibold">Podgląd szablonu: {selectedTemplate.name}</h2>
                <Button variant="outline" onClick={() => setShowPreview(false)}>
                  Zamknij
                </Button>
              </div>

              <LabelPreview
                data={{
                  qrToken: generateQRToken(),
                  displayText:
                    selectedTemplate.label_type === "location"
                      ? "Przykładowa Lokalizacja"
                      : "Przykładowy Produkt",
                  codeText: selectedTemplate.label_type === "location" ? "LOC-001" : "PRD-001",
                  template: selectedTemplate,
                }}
                showControls={true}
              />
            </div>
          </div>
        </div>
      )}

      {/* Empty State for Custom Templates */}
      {templates.length === 0 && !isLoading && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Brak szablonów</h3>
                <p className="mx-auto max-w-md text-muted-foreground">
                  Nie znaleziono żadnych szablonów etykiet.
                </p>
              </div>
              <Button asChild>
                <Link href="/dashboard/warehouse/labels/templates/create">
                  <Plus className="mr-2 h-4 w-4" />
                  Stwórz pierwszy szablon
                </Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* Create Custom Template CTA */}
      {templates.length > 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="space-y-4">
              <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-full bg-muted">
                <FileText className="h-8 w-8 text-muted-foreground" />
              </div>
              <div className="space-y-2">
                <h3 className="text-lg font-semibold">Stwórz własny szablon</h3>
                <p className="mx-auto max-w-md text-muted-foreground">
                  Dostosuj wygląd etykiet do swoich potrzeb. Określ rozmiary, pozycję QR, tekst i
                  inne elementy.
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
      )}
    </div>
  );
}
