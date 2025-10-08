"use client";

import React, { useEffect, useState } from "react";
import { useRouter, useParams } from "next/navigation";
import { TemplateBuilder } from "@/modules/warehouse/components/templates/TemplateBuilder";
import { templateService } from "@/modules/warehouse/api/template-service";
import type { TemplateWithAttributes } from "@/modules/warehouse/types/template";
import { Loader2 } from "lucide-react";

export default function CloneTemplatePage() {
  const router = useRouter();
  const params = useParams();
  const templateId = params.templateId as string;

  const [baseTemplate, setBaseTemplate] = useState<TemplateWithAttributes | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const loadTemplate = async () => {
      try {
        setLoading(true);
        const template = await templateService.getTemplate(templateId);
        if (template) {
          setBaseTemplate(template);
        } else {
          setError("Template not found");
        }
      } catch (err) {
        console.error("Error loading template:", err);
        setError("Failed to load template");
      } finally {
        setLoading(false);
      }
    };

    if (templateId) {
      loadTemplate();
    }
  }, [templateId]);

  const handleSave = (_template: any) => {
    router.push("/dashboard/warehouse/products/templates");
  };

  const handleCancel = () => {
    router.back();
  };

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin" />
        <span className="ml-2">Loading template...</span>
      </div>
    );
  }

  if (error || !baseTemplate) {
    return (
      <div className="flex h-64 flex-col items-center justify-center">
        <p className="text-destructive">{error || "Template not found"}</p>
        <button onClick={() => router.back()} className="mt-4 text-blue-600 hover:underline">
          Go Back
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TemplateBuilder
        mode="clone"
        baseTemplate={baseTemplate}
        onSave={handleSave}
        onCancel={handleCancel}
      />
    </div>
  );
}
