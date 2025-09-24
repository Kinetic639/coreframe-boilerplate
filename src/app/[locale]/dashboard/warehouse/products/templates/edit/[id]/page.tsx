"use client";

import React from "react";
import { useRouter } from "next/navigation";
import { useParams } from "next/navigation";
import { TemplateBuilder } from "@/modules/warehouse/components/templates/TemplateBuilder";
import { templateService } from "@/modules/warehouse/api/template-service";
import type { TemplateWithAttributes } from "@/modules/warehouse/types/template";
import { Loader2 } from "lucide-react";
import { toast } from "react-toastify";

export default function EditTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.id as string;

  const [template, setTemplate] = React.useState<TemplateWithAttributes | null>(null);
  const [loading, setLoading] = React.useState(true);
  const [error, setError] = React.useState<string | null>(null);

  React.useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        const templateData = await templateService.getTemplate(templateId);
        if (!templateData) {
          setError("Template not found");
          return;
        }
        setTemplate(templateData);
      } catch (err) {
        console.error("Error loading template:", err);
        setError("Failed to load template");
        toast.error("Błąd podczas ładowania szablonu");
      } finally {
        setLoading(false);
      }
    };

    if (templateId) {
      loadTemplate();
    }
  }, [templateId]);

  const handleSave = async (updatedTemplate: any) => {
    try {
      await templateService.updateTemplate(templateId, updatedTemplate);
      toast.success("Szablon został zaktualizowany");
      router.push("/dashboard/warehouse/products/templates");
    } catch (err) {
      console.error("Error updating template:", err);
      toast.error("Błąd podczas aktualizacji szablonu");
    }
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Ładowanie szablonu...</span>
      </div>
    );
  }

  if (error || !template) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-red-600">Błąd</h2>
          <p className="text-muted-foreground">{error || "Template not found"}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TemplateBuilder
        mode="edit"
        baseTemplate={template}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
