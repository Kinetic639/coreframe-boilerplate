import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import type {
  CreateTemplateInput,
  UpdateTemplateInput,
  CloneTemplateInput,
} from "@/server/schemas/templates.schema";

// ==========================================
// TYPE DEFINITIONS
// ==========================================

type ProductTemplate = Database["public"]["Tables"]["product_templates"]["Row"];

export interface TemplateWithAttributes {
  template: ProductTemplate & {
    category: string;
    supported_contexts: string[];
    settings: Record<string, any>;
    is_active: boolean;
  };
  attributes: any[];
  attribute_count: number;
}

export interface TemplateListResponse {
  system_templates: TemplateWithAttributes[];
  organization_templates: TemplateWithAttributes[];
}

// ==========================================
// TEMPLATES SERVICE
// ==========================================

export class TemplatesService {
  /**
   * Check if a template slug already exists for the given organization
   */
  private static async checkSlugExists(
    supabase: SupabaseClient<Database>,
    slug: string,
    organizationId?: string | null
  ): Promise<boolean> {
    const { data, error } = await supabase
      .from("product_templates")
      .select("id")
      .eq("slug", slug)
      .eq("organization_id", organizationId || null)
      .is("deleted_at", null)
      .single();

    if (error && error.code !== "PGRST116") {
      // PGRST116 is "not found" error, which means slug is available
      throw error;
    }

    return !!data;
  }

  /**
   * Get all system templates
   */
  static async getSystemTemplates(
    supabase: SupabaseClient<Database>
  ): Promise<TemplateWithAttributes[]> {
    const { data, error } = await supabase
      .from("product_templates")
      .select(
        `
          *,
          template_attribute_definitions(*)
        `
      )
      .eq("is_system", true)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch system templates: ${error.message}`);
    }

    return (data || []).map((template: any) => ({
      template: {
        ...template,
        category: template.category || "general",
        supported_contexts: template.metadata?.contexts || ["warehouse"],
        settings: template.metadata?.settings || {},
        is_active: true,
      },
      attributes: (template.template_attribute_definitions || []).map((attr: any) => ({
        id: attr.id,
        template_id: attr.template_id,
        slug: attr.attribute_key,
        label: {
          pl: attr.display_name,
          en: attr.display_name,
        },
        description: attr.description
          ? {
              pl: attr.description,
              en: attr.description,
            }
          : undefined,
        data_type: attr.data_type,
        is_required: attr.is_required || false,
        is_unique: attr.is_unique || false,
        default_value: attr.default_value,
        validation_rules: attr.validation_rules || {},
        context_scope: Array.isArray(attr.context_scope)
          ? attr.context_scope[0] || "warehouse"
          : "warehouse",
        display_order: attr.display_order || 0,
        is_searchable: attr.is_searchable !== false,
        is_filterable: false,
        input_type: "text",
        placeholder: undefined,
        help_text: undefined,
        created_at: attr.created_at,
        updated_at: attr.created_at,
      })),
      attribute_count: (template.template_attribute_definitions || []).length,
    }));
  }

  /**
   * Get organization templates
   */
  static async getOrganizationTemplates(
    supabase: SupabaseClient<Database>,
    organizationId: string
  ): Promise<TemplateWithAttributes[]> {
    const { data, error } = await supabase
      .from("product_templates")
      .select(
        `
          *,
          template_attribute_definitions(*)
        `
      )
      .eq("organization_id", organizationId)
      .eq("is_system", false)
      .is("deleted_at", null);

    if (error) {
      throw new Error(`Failed to fetch organization templates: ${error.message}`);
    }

    return (data || []).map((template: any) => ({
      template: {
        ...template,
        category: template.category || "custom",
        supported_contexts: template.metadata?.contexts || ["warehouse"],
        settings: template.metadata?.settings || {},
        is_active: true,
      },
      attributes: (template.template_attribute_definitions || []).map((attr: any) => ({
        id: attr.id,
        template_id: attr.template_id,
        slug: attr.attribute_key,
        label: {
          pl: attr.display_name,
          en: attr.display_name,
        },
        description: attr.description
          ? {
              pl: attr.description,
              en: attr.description,
            }
          : undefined,
        data_type: attr.data_type,
        is_required: attr.is_required || false,
        is_unique: attr.is_unique || false,
        default_value: attr.default_value,
        validation_rules: attr.validation_rules || {},
        context_scope: Array.isArray(attr.context_scope)
          ? attr.context_scope[0] || "warehouse"
          : "warehouse",
        display_order: attr.display_order || 0,
        is_searchable: attr.is_searchable !== false,
        is_filterable: false,
        input_type: "text",
        placeholder: undefined,
        help_text: undefined,
        created_at: attr.created_at,
        updated_at: attr.created_at,
      })),
      attribute_count: (template.template_attribute_definitions || []).length,
    }));
  }

  /**
   * Get all templates for an organization (system + org templates) in one call
   */
  static async getAllTemplates(
    supabase: SupabaseClient<Database>,
    organizationId?: string
  ): Promise<TemplateListResponse> {
    // Get system templates and organization templates separately
    const [systemTemplates, organizationTemplates] = await Promise.all([
      this.getSystemTemplates(supabase),
      organizationId
        ? this.getOrganizationTemplates(supabase, organizationId)
        : Promise.resolve([]),
    ]);

    return {
      system_templates: systemTemplates,
      organization_templates: organizationTemplates,
    };
  }

  /**
   * Get a single template by ID with its attributes
   */
  static async getTemplate(
    supabase: SupabaseClient<Database>,
    templateId: string
  ): Promise<TemplateWithAttributes | null> {
    const { data, error } = await supabase
      .from("product_templates")
      .select(
        `
          *,
          template_attribute_definitions(*)
        `
      )
      .eq("id", templateId)
      .is("deleted_at", null)
      .single();

    if (error) {
      if (error.code === "PGRST116") return null;
      throw new Error(`Failed to fetch template: ${error.message}`);
    }

    return {
      template: {
        ...data,
        name: data.name || "Unnamed Template",
        description: data.description || null,
        icon: data.icon || null,
        color: data.color || "#10b981",
        organization_id: data.organization_id || null,
        parent_template_id: data.parent_template_id || null,
        is_system: Boolean(data.is_system),
        is_active: true,
        category: data.category || (data.is_system ? "general" : "custom"),
        supported_contexts: data.metadata?.contexts || ["warehouse"],
        settings: data.metadata?.settings || {},
        created_by: data.created_by || null,
      },
      attributes: (data.template_attribute_definitions || []).map((attr: any) => ({
        id: attr.id,
        template_id: attr.template_id,
        slug: attr.attribute_key,
        label: {
          pl: attr.display_name,
          en: attr.display_name,
        },
        description: attr.description
          ? {
              pl: attr.description,
              en: attr.description,
            }
          : undefined,
        data_type: attr.data_type,
        is_required: attr.is_required || false,
        is_unique: attr.is_unique || false,
        default_value: attr.default_value,
        validation_rules: attr.validation_rules || {},
        context_scope: Array.isArray(attr.context_scope)
          ? attr.context_scope[0] || "warehouse"
          : "warehouse",
        display_order: attr.display_order || 0,
        is_searchable: attr.is_searchable !== false,
        is_filterable: false,
        input_type: "text",
        placeholder: undefined,
        help_text: undefined,
        created_at: attr.created_at,
        updated_at: attr.created_at,
      })),
      attribute_count: (data.template_attribute_definitions || []).length,
    };
  }

  /**
   * Create a new template with attributes
   */
  static async createTemplate(
    supabase: SupabaseClient<Database>,
    templateData: CreateTemplateInput
  ): Promise<ProductTemplate> {
    const { attributes, supported_contexts, settings, category, slug, ...templateFields } =
      templateData;

    // Generate slug if not provided
    const baseSlug = slug || generateSlug(templateData.name);
    const uniqueSlug = await generateUniqueSlug(baseSlug, (s) =>
      this.checkSlugExists(supabase, s, templateData.organization_id)
    );

    // Create metadata object with supported_contexts and settings
    const insertData = {
      ...templateFields,
      slug: uniqueSlug,
      category: category || "custom",
      metadata: {
        contexts: supported_contexts || ["warehouse"],
        settings: settings || {},
      },
      is_system: false,
    };

    // Insert template
    const { data: template, error: templateError } = await supabase
      .from("product_templates")
      .insert(insertData as any)
      .select()
      .single();

    if (templateError) {
      throw new Error(`Template creation failed: ${templateError.message}`);
    }

    // Insert attributes
    if (attributes && attributes.length > 0) {
      const attributeInserts = attributes.map((attr, index) => ({
        template_id: template.id,
        attribute_key: attr.slug || `attr_${index}`,
        display_name:
          typeof attr.label === "string"
            ? attr.label
            : (attr.label as any)?.en || (attr.label as any)?.pl || `Attribute ${index + 1}`,
        description:
          typeof attr.description === "string"
            ? attr.description
            : (attr.description as any)?.en || (attr.description as any)?.pl || null,
        data_type: attr.data_type || "text",
        is_required: attr.is_required || false,
        is_unique: attr.is_unique || false,
        is_searchable: attr.is_searchable !== false,
        default_value: attr.default_value || null,
        validation_rules: attr.validation_rules || {},
        context_scope: [attr.context_scope || "warehouse"],
        display_order: attr.display_order || index,
      }));

      const { error: attributeError } = await supabase
        .from("template_attribute_definitions")
        .insert(attributeInserts as any);

      if (attributeError) {
        throw new Error(`Attribute creation failed: ${attributeError.message}`);
      }
    }

    return template;
  }

  /**
   * Update an existing template
   */
  static async updateTemplate(
    supabase: SupabaseClient<Database>,
    templateId: string,
    templateData: UpdateTemplateInput
  ): Promise<ProductTemplate> {
    const { attributes, supported_contexts, settings, ...templateFields } = templateData;

    // Prepare the update data
    const updateData: any = {
      ...templateFields,
      metadata: {
        contexts: supported_contexts || ["warehouse"],
        settings: settings || {},
      },
      updated_at: new Date().toISOString(),
    };

    // Update template
    const { data: template, error: templateError } = await supabase
      .from("product_templates")
      .update(updateData)
      .eq("id", templateId)
      .select()
      .single();

    if (templateError) {
      throw new Error(`Failed to update template: ${templateError.message}`);
    }

    // If attributes are provided, replace all existing attributes
    if (attributes) {
      // Delete existing attributes
      const { error: deleteError } = await supabase
        .from("template_attribute_definitions")
        .delete()
        .eq("template_id", templateId);

      if (deleteError) {
        throw new Error(`Failed to delete old attributes: ${deleteError.message}`);
      }

      // Insert new attributes
      if (attributes.length > 0) {
        const attributeInserts = attributes.map((attr, index) => ({
          template_id: templateId,
          attribute_key: attr.slug || `attr_${index}`,
          display_name:
            typeof attr.label === "string"
              ? attr.label
              : (attr.label as any)?.en || (attr.label as any)?.pl || `Attribute ${index + 1}`,
          description:
            typeof attr.description === "string"
              ? attr.description
              : (attr.description as any)?.en || (attr.description as any)?.pl || null,
          data_type: attr.data_type || "text",
          is_required: attr.is_required || false,
          is_unique: attr.is_unique || false,
          is_searchable: attr.is_searchable !== false,
          default_value: attr.default_value || null,
          validation_rules: attr.validation_rules || {},
          context_scope: [attr.context_scope || "warehouse"],
          display_order: attr.display_order || index,
        }));

        const { error: attributeError } = await supabase
          .from("template_attribute_definitions")
          .insert(attributeInserts as any);

        if (attributeError) {
          throw new Error(`Failed to create new attributes: ${attributeError.message}`);
        }
      }
    }

    return template;
  }

  /**
   * Clone a template
   */
  static async cloneTemplate(
    supabase: SupabaseClient<Database>,
    request: CloneTemplateInput
  ): Promise<ProductTemplate> {
    // Get source template with attributes
    const sourceTemplate = await this.getTemplate(supabase, request.source_template_id);
    if (!sourceTemplate) {
      throw new Error("Source template not found");
    }

    // Create new template data
    const newTemplateData: CreateTemplateInput = {
      name: request.new_name || "Cloned Template",
      description:
        request.customizations?.description || sourceTemplate.template.description || null,
      organization_id: request.target_organization_id,
      parent_template_id: request.source_template_id,
      category: request.customizations?.category || sourceTemplate.template.category || "custom",
      icon: request.customizations?.icon || sourceTemplate.template.icon || null,
      color: request.customizations?.color || sourceTemplate.template.color || "#10b981",
      supported_contexts: request.customizations?.supported_contexts ||
        sourceTemplate.template.supported_contexts || ["warehouse"],
      settings: request.customizations?.settings || sourceTemplate.template.settings || {},
      attributes: Array.isArray(sourceTemplate.attributes)
        ? sourceTemplate.attributes.map(
            ({
              id: _id,
              template_id: _template_id,
              created_at: _created_at,
              updated_at: _updated_at,
              ...attr
            }) => attr
          )
        : [],
    };

    return this.createTemplate(supabase, newTemplateData);
  }

  /**
   * Delete a template
   */
  static async deleteTemplate(
    supabase: SupabaseClient<Database>,
    templateId: string
  ): Promise<void> {
    const { error } = await supabase.from("product_templates").delete().eq("id", templateId);

    if (error) {
      throw new Error(`Failed to delete template: ${error.message}`);
    }
  }
}
