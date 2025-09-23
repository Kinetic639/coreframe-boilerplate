export interface ProductTemplate {
  id: string;
  name: string;
  slug: string;
  description?: string;
  organization_id?: string;
  parent_template_id?: string;
  is_system: boolean;
  is_active: boolean;
  category?: string;
  icon?: string;
  color?: string;
  supported_contexts: string[];
  settings: Record<string, any>;
  created_by?: string;
  created_at: string;
  updated_at: string;
  attribute_definitions?: ProductAttributeDefinition[];
}

export interface ProductAttributeDefinition {
  id: string;
  template_id: string;
  slug: string;
  label: Record<string, string>; // {"en": "Name", "pl": "Nazwa"}
  description?: Record<string, string>;
  data_type: "text" | "number" | "boolean" | "date" | "json";
  is_required: boolean;
  is_unique: boolean;
  default_value?: any;
  validation_rules?: Record<string, any>;
  context_scope: string;
  display_order: number;
  is_searchable: boolean;
  is_filterable: boolean;
  input_type: string;
  placeholder?: Record<string, string>;
  help_text?: Record<string, string>;
  created_at: string;
  updated_at: string;
}

export interface TemplateWithAttributes {
  template: ProductTemplate;
  attributes: ProductAttributeDefinition[];
  attribute_count?: number;
}

export interface CreateTemplateRequest {
  name: string;
  slug?: string; // Optional - will be auto-generated from name if not provided
  description?: string;
  organization_id?: string;
  parent_template_id?: string;
  category?: string;
  icon?: string;
  color?: string;
  supported_contexts?: string[];
  settings?: Record<string, any>;
  attributes: Omit<
    ProductAttributeDefinition,
    "id" | "template_id" | "created_at" | "updated_at"
  >[];
}

export interface CloneTemplateRequest {
  source_template_id: string;
  target_organization_id: string;
  new_name: string;
  customizations?: {
    description?: string;
    category?: string;
    icon?: string;
    color?: string;
    supported_contexts?: string[];
    settings?: Record<string, any>;
  };
}

export interface TemplateListResponse {
  system_templates: TemplateWithAttributes[];
  organization_templates: TemplateWithAttributes[];
}
