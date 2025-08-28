"use client";

import { useState, useEffect } from "react";
import { LabelGenerator } from "@/modules/warehouse/components/labels/LabelGenerator";
import type { LabelTemplate, LabelGenerationRequest, QRLabel } from "@/lib/types/qr-system";
import { toast } from "sonner";
import { Loader2 } from "lucide-react";

export default function LabelGeneratorPage() {
  const [templates, setTemplates] = useState<LabelTemplate[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isLoadingTemplates, setIsLoadingTemplates] = useState(true);

  // Fetch templates on component mount
  useEffect(() => {
    const fetchTemplates = async () => {
      try {
        const response = await fetch("/api/labels/templates");
        const data = await response.json();

        if (data.success) {
          setTemplates(data.templates);
        } else {
          toast.error("Błąd podczas ładowania szablonów", {
            description: data.error || "Spróbuj odświeżyć stronę",
          });
        }
      } catch (error) {
        console.error("Error fetching templates:", error);
        toast.error("Błąd podczas ładowania szablonów", {
          description: "Spróbuj odświeżyć stronę",
        });
      } finally {
        setIsLoadingTemplates(false);
      }
    };

    fetchTemplates();
  }, []);

  // Show loading spinner while templates are loading
  if (isLoadingTemplates) {
    return (
      <div className="container mx-auto flex min-h-[400px] items-center justify-center py-6">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
          <span>Ładowanie szablonów...</span>
        </div>
      </div>
    );
  }

  // Mock templates fallback - in real app this would come from database
  const fallbackTemplates: LabelTemplate[] = [
    {
      id: "1",
      name: "Small Location Label",
      description: "Compact 25x25mm QR label for small locations",
      label_type: "location",
      category: "small",
      width_mm: 25,
      height_mm: 25,
      dpi: 300,
      template_config: { layout: "qr_only", margins: { top: 2, bottom: 2, left: 2, right: 2 } },
      qr_position: "center",
      qr_size_mm: 20,
      show_label_text: false,
      label_text_position: "none",
      label_text_size: 12,
      show_code: false,
      show_hierarchy: false,
      show_barcode: false,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: true,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "2",
      name: "Medium Location Label",
      description: "Standard 50x25mm QR label with location name",
      label_type: "location",
      category: "medium",
      width_mm: 50,
      height_mm: 25,
      dpi: 300,
      template_config: {
        layout: "qr_with_text",
        margins: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      qr_position: "left",
      qr_size_mm: 20,
      show_label_text: true,
      label_text_position: "right",
      label_text_size: 12,
      show_code: false,
      show_hierarchy: false,
      show_barcode: false,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: false,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "3",
      name: "Large Location Label",
      description: "Comprehensive 75x50mm QR label with full information",
      label_type: "location",
      category: "large",
      width_mm: 75,
      height_mm: 50,
      dpi: 300,
      template_config: {
        layout: "comprehensive",
        margins: { top: 5, bottom: 5, left: 5, right: 5 },
      },
      qr_position: "top-left",
      qr_size_mm: 25,
      show_label_text: true,
      label_text_position: "bottom",
      label_text_size: 12,
      show_code: true,
      show_hierarchy: true,
      show_barcode: false,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: false,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "4",
      name: "Small Product Label",
      description: "Compact 25x25mm QR label for products",
      label_type: "product",
      category: "small",
      width_mm: 25,
      height_mm: 25,
      dpi: 300,
      template_config: { layout: "qr_only", margins: { top: 2, bottom: 2, left: 2, right: 2 } },
      qr_position: "center",
      qr_size_mm: 20,
      show_label_text: false,
      label_text_position: "none",
      label_text_size: 12,
      show_code: false,
      show_hierarchy: false,
      show_barcode: false,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: true,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "5",
      name: "Medium Product Label",
      description: "Standard 50x25mm QR label with product name",
      label_type: "product",
      category: "medium",
      width_mm: 50,
      height_mm: 25,
      dpi: 300,
      template_config: {
        layout: "qr_with_text",
        margins: { top: 2, bottom: 2, left: 2, right: 2 },
      },
      qr_position: "left",
      qr_size_mm: 20,
      show_label_text: true,
      label_text_position: "right",
      label_text_size: 12,
      show_code: false,
      show_hierarchy: false,
      show_barcode: false,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: false,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
    {
      id: "6",
      name: "Large Product Label with Barcode",
      description: "Comprehensive 75x50mm label with QR and barcode",
      label_type: "product",
      category: "large",
      width_mm: 75,
      height_mm: 50,
      dpi: 300,
      template_config: {
        layout: "qr_and_barcode",
        show_barcode: true,
        margins: { top: 5, bottom: 5, left: 5, right: 5 },
      },
      qr_position: "top-left",
      qr_size_mm: 20,
      show_label_text: true,
      label_text_position: "center",
      label_text_size: 12,
      show_code: true,
      show_hierarchy: false,
      show_barcode: true,
      background_color: "#FFFFFF",
      text_color: "#000000",
      border_enabled: true,
      border_width: 0.5,
      border_color: "#000000",
      is_default: false,
      is_system: true,
      created_at: "2024-01-01T00:00:00Z",
      updated_at: "2024-01-01T00:00:00Z",
    },
  ];

  const handleGenerate = async (request: LabelGenerationRequest) => {
    setIsLoading(true);

    try {
      // Make real API call to generate labels
      const response = await fetch("/api/labels/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          templateId: request.templateId,
          labelType: request.labelType,
          quantity: request.quantity || 1,
          batchName: request.batchName,
          batchDescription: request.batchDescription,
          entityIds: request.entityIds || [],
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to generate labels");
      }

      const data = await response.json();

      if (data.success) {
        // Generate and download PDF
        await generateAndDownloadPDF(data.labels, request, data.batchId);

        if (request.quantity && request.quantity > 1) {
          toast.success(`Pomyślnie wygenerowano ${request.quantity} etykiet!`, {
            description: request.batchName
              ? `Partie: ${request.batchName}`
              : "PDF został pobrany automatycznie",
          });
        } else {
          toast.success("Etykieta została pomyślnie wygenerowana!", {
            description: "PDF został pobrany automatycznie",
          });
        }
      }
    } catch (error) {
      console.error("Error generating labels:", error);
      toast.error("Błąd podczas generowania etykiet", {
        description:
          error instanceof Error
            ? error.message
            : "Spróbuj ponownie lub skontaktuj się z administratorem",
      });
    } finally {
      setIsLoading(false);
    }
  };

  const generateAndDownloadPDF = async (
    labels: QRLabel[],
    request: LabelGenerationRequest,
    batchId?: string
  ) => {
    try {
      // Find the selected template
      const template = [...templates, ...fallbackTemplates].find(
        (t) => t.id === request.templateId
      );
      if (!template) {
        throw new Error("Template not found");
      }

      // Use the utility function to generate PDF
      const { generateLabelPDF, downloadPDF, generateFileName } = await import(
        "@/lib/utils/pdf-generator"
      );

      const pdf = await generateLabelPDF(labels, template, {
        batchId,
        request,
      });

      // Generate PDF blob
      const pdfBlob = new Blob([pdf.output("blob")], { type: "application/pdf" });
      const filename = generateFileName(request);

      // Upload to Supabase storage if batch mode
      if (batchId || request.quantity > 1) {
        try {
          const formData = new FormData();
          formData.append("file", pdfBlob, filename);
          formData.append("batchId", batchId || "");
          formData.append("labelType", request.labelType);

          const uploadResponse = await fetch("/api/labels/upload-pdf", {
            method: "POST",
            body: formData,
          });

          const uploadData = await uploadResponse.json();

          if (uploadData.success) {
            toast.success("PDF został zapisany w systemie!", {
              description: "Możesz go pobrać z listy partii",
            });
          }
        } catch (uploadError) {
          console.error("Error uploading PDF:", uploadError);
          // Still download the PDF even if upload fails
          toast.info("PDF został wygenerowany lokalnie", {
            description: "Nie udało się zapisać w systemie, ale plik został pobrany",
          });
        }
      }

      // Always download PDF locally
      downloadPDF(pdf, filename);
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast.error("Błąd podczas generowania PDF", {
        description: "Etykiety zostały utworzone, ale nie udało się wygenerować PDF",
      });
    }
  };

  return (
    <div className="container mx-auto py-6">
      <LabelGenerator
        templates={templates.length > 0 ? templates : fallbackTemplates}
        onGenerate={handleGenerate}
        isLoading={isLoading}
      />
    </div>
  );
}
