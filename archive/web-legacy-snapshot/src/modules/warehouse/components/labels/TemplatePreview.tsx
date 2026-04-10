"use client";

import { LabelTemplate } from "@/lib/types/qr-system";
import { InteractiveLabelCanvas } from "./InteractiveLabelCanvas";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

interface TemplatePreviewProps {
  template: LabelTemplate;
  className?: string;
}

export function TemplatePreview({ template, className = "" }: TemplatePreviewProps) {
  // Add sample data to template for preview
  const previewTemplate: any = {
    ...template,
    // Ensure all required properties are present
    field_vertical_gap:
      (template as any).field_vertical_gap ||
      (template.template_config as any)?.field_vertical_gap ||
      2,
    label_padding_top:
      (template as any).label_padding_top ||
      (template.template_config as any)?.label_padding_top ||
      2,
    label_padding_right:
      (template as any).label_padding_right ||
      (template.template_config as any)?.label_padding_right ||
      2,
    label_padding_bottom:
      (template as any).label_padding_bottom ||
      (template.template_config as any)?.label_padding_bottom ||
      2,
    label_padding_left:
      (template as any).label_padding_left ||
      (template.template_config as any)?.label_padding_left ||
      2,
    items_alignment:
      (template as any).items_alignment ||
      (template.template_config as any)?.items_alignment ||
      "center",
    fields:
      template.fields?.map((field, index) => ({
        ...field,
        field_value:
          field.field_type === "text"
            ? field.field_value || `Sample ${field.field_name || `Field ${index + 1}`}`
            : field.field_value,
      })) || [],
  };

  return (
    <div className={`space-y-4 ${className}`}>
      {/* Template Info */}
      <div className="flex items-center justify-between">
        <div className="space-y-1">
          <h3 className="text-lg font-semibold">{template.name}</h3>
          {template.description && (
            <p className="text-sm text-muted-foreground">{template.description}</p>
          )}
        </div>
        <div className="flex gap-2">
          {template.is_system && <Badge variant="secondary">System</Badge>}
          {template.is_default && <Badge variant="outline">Default</Badge>}
          <Badge variant="outline">
            {template.width_mm}×{template.height_mm}mm
          </Badge>
        </div>
      </div>

      {/* Template Preview */}
      <Card className="p-6">
        <div className="flex justify-center">
          <div className="rounded-lg border bg-white p-4 shadow-sm">
            <InteractiveLabelCanvas
              template={previewTemplate}
              viewMode="preview"
              selectedField={null}
              onFieldSelect={() => {}}
            />
          </div>
        </div>
      </Card>

      {/* Template Details */}
      {template.fields && template.fields.length > 0 && (
        <Card className="p-4">
          <h4 className="mb-3 font-medium">Fields ({template.fields.length})</h4>
          <div className="grid gap-2 text-sm">
            {template.fields
              .sort((a, b) => (a.sort_order || 0) - (b.sort_order || 0))
              .map((field, index) => (
                <div key={field.id || index} className="flex justify-between">
                  <span className="text-muted-foreground">
                    {field.field_name || `Field ${index + 1}`}
                  </span>
                  <span className="font-mono">
                    {field.field_type} • {field.field_value || "Sample text"}
                  </span>
                </div>
              ))}
          </div>
        </Card>
      )}
    </div>
  );
}
