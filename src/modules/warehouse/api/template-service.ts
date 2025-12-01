import { createClient } from "@/lib/supabase/client";
import { generateSlug, generateUniqueSlug } from "@/lib/utils/slug";
import type {
  ProductTemplate,
  TemplateWithAttributes,
  CreateTemplateRequest,
  CloneTemplateRequest,
  TemplateListResponse,
} from "../types/template";

export class TemplateService {
  private supabase = createClient();

  /**
   * Check if a template slug already exists for the given organization
   */
  private async checkSlugExists(slug: string, organizationId?: string): Promise<boolean> {
    const { data, error } = await this.supabase
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
   * Get all system templates using database function
   */
  async getSystemTemplates(): Promise<TemplateWithAttributes[]> {
    try {
      const { data, error } = await this.supabase
        .from("product_templates")
        .select(
          `
          *,
          template_attribute_definitions(*)
        `
        )
        .eq("is_system", true)
        .is("deleted_at", null);

      if (error) throw error;

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
          input_type: "text", // Default since not stored in this table
          placeholder: undefined, // Not stored in this table
          help_text: undefined, // Not stored in this table
          created_at: attr.created_at,
          updated_at: attr.created_at, // No updated_at in this table
        })),
        attribute_count: (template.template_attribute_definitions || []).length,
      }));
    } catch (error) {
      console.error("Error getting system templates:", error);
      throw error;
    }
  }

  /**
   * Get organization templates using database function
   */
  async getOrganizationTemplates(organizationId: string): Promise<TemplateWithAttributes[]> {
    try {
      const { data, error } = await this.supabase
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

      if (error) throw error;

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
          input_type: "text", // Default since not stored in this table
          placeholder: undefined, // Not stored in this table
          help_text: undefined, // Not stored in this table
          created_at: attr.created_at,
          updated_at: attr.created_at, // No updated_at in this table
        })),
        attribute_count: (template.template_attribute_definitions || []).length,
      }));
    } catch (error) {
      console.error("Error getting organization templates:", error);
      throw error;
    }
  }

  /**
   * Get all templates for an organization (system + org templates) in one call
   */
  async getAllTemplates(organizationId?: string): Promise<TemplateListResponse> {
    try {
      // Get system templates and organization templates separately
      const [systemTemplates, organizationTemplates] = await Promise.all([
        this.getSystemTemplates(),
        organizationId ? this.getOrganizationTemplates(organizationId) : Promise.resolve([]),
      ]);

      return {
        system_templates: systemTemplates,
        organization_templates: organizationTemplates,
      };
    } catch (error) {
      console.error("Error getting all templates:", error);
      throw error;
    }
  }

  /**
   * Get a single template by ID with its attributes
   */
  async getTemplate(templateId: string): Promise<TemplateWithAttributes | null> {
    try {
      const { data, error } = await this.supabase
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
        if (error.code === "PGRST116") return null; // Not found
        throw error;
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
          input_type: "text", // Default since not stored in this table
          placeholder: undefined, // Not stored in this table
          help_text: undefined, // Not stored in this table
          created_at: attr.created_at,
          updated_at: attr.created_at, // No updated_at in this table
        })),
        attribute_count: (data.template_attribute_definitions || []).length,
      };
    } catch (error) {
      console.error("Error getting template:", error);
      throw error;
    }
  }

  /**
   * Create a new template with attributes
   */
  async createTemplate(templateData: CreateTemplateRequest): Promise<ProductTemplate> {
    try {
      const { attributes, supported_contexts, settings, category, slug, ...templateFields } =
        templateData;

      // Generate slug if not provided
      const baseSlug = slug || generateSlug(templateData.name);
      const uniqueSlug = await generateUniqueSlug(baseSlug, (s) =>
        this.checkSlugExists(s, templateData.organization_id)
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
      const { data: template, error: templateError } = await this.supabase
        .from("product_templates")
        .insert(insertData)
        .select()
        .single();

      if (templateError) {
        throw new Error(
          `Template creation failed: ${templateError.message || JSON.stringify(templateError)}`
        );
      }

      // Insert attributes
      if (attributes && attributes.length > 0) {
        const attributeInserts = attributes.map((attr, index) => ({
          template_id: template.id,
          attribute_key: attr.slug || `attr_${index}`,
          display_name:
            typeof attr.label === "string"
              ? attr.label
              : attr.label?.en || attr.label?.pl || `Attribute ${index + 1}`,
          description:
            typeof attr.description === "string"
              ? attr.description
              : attr.description?.en || attr.description?.pl || null,
          data_type: attr.data_type || "text",
          is_required: attr.is_required || false,
          is_unique: attr.is_unique || false,
          is_searchable: attr.is_searchable !== false,
          default_value: attr.default_value || null,
          validation_rules: attr.validation_rules || {},
          context_scope: [attr.context_scope || "warehouse"],
          display_order: attr.display_order || index,
        }));

        const { error: attributeError } = await this.supabase
          .from("template_attribute_definitions")
          .insert(attributeInserts);

        if (attributeError) {
          throw new Error(
            `Attribute creation failed: ${attributeError.message || JSON.stringify(attributeError)}`
          );
        }
      }

      return template;
    } catch (error) {
      console.error("Error creating template:", error);
      // Re-throw with better error message
      if (error instanceof Error) {
        throw error;
      } else {
        throw new Error(`Template creation failed: ${JSON.stringify(error)}`);
      }
    }
  }

  /**
   * Update an existing template
   */
  async updateTemplate(
    templateId: string,
    templateData: Partial<CreateTemplateRequest>
  ): Promise<ProductTemplate> {
    try {
      const { attributes, supported_contexts, settings, ...templateFields } = templateData;

      // Prepare the update data - only include valid database columns
      const updateData = {
        ...templateFields,
        metadata: {
          contexts: supported_contexts || ["warehouse"],
          settings: settings || {},
        },
        updated_at: new Date().toISOString(),
      };

      // Update template
      const { data: template, error: templateError } = await this.supabase
        .from("product_templates")
        .update(updateData)
        .eq("id", templateId)
        .select()
        .single();

      if (templateError) throw templateError;

      // If attributes are provided, replace all existing attributes
      if (attributes) {
        // Delete existing attributes
        const { error: deleteError } = await this.supabase
          .from("template_attribute_definitions")
          .delete()
          .eq("template_id", templateId);

        if (deleteError) throw deleteError;

        // Insert new attributes
        if (attributes.length > 0) {
          const attributeInserts = attributes.map((attr, index) => ({
            template_id: templateId,
            attribute_key: attr.slug || `attr_${index}`,
            display_name:
              typeof attr.label === "string"
                ? attr.label
                : attr.label?.en || attr.label?.pl || `Attribute ${index + 1}`,
            description:
              typeof attr.description === "string"
                ? attr.description
                : attr.description?.en || attr.description?.pl || null,
            data_type: attr.data_type || "text",
            is_required: attr.is_required || false,
            is_unique: attr.is_unique || false,
            is_searchable: attr.is_searchable !== false,
            default_value: attr.default_value || null,
            validation_rules: attr.validation_rules || {},
            context_scope: [attr.context_scope || "warehouse"],
            display_order: attr.display_order || index,
          }));

          const { error: attributeError } = await this.supabase
            .from("template_attribute_definitions")
            .insert(attributeInserts);

          if (attributeError) throw attributeError;
        }
      }

      return template;
    } catch (error) {
      console.error("Error updating template:", error);
      throw error;
    }
  }

  /**
   * Clone a template
   */
  async cloneTemplate(request: CloneTemplateRequest): Promise<ProductTemplate> {
    try {
      // Get source template with attributes
      const sourceTemplate = await this.getTemplate(request.source_template_id);
      if (!sourceTemplate) {
        throw new Error("Source template not found");
      }

      // Create new template data
      const newTemplateData: CreateTemplateRequest = {
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

      return this.createTemplate(newTemplateData);
    } catch (error) {
      console.error("Error cloning template:", error);
      throw error;
    }
  }

  /**
   * Delete a template (soft delete)
   */
  async deleteTemplate(templateId: string): Promise<void> {
    try {
      const { error } = await this.supabase.from("product_templates").delete().eq("id", templateId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting template:", error);
      throw error;
    }
  }
}

export const templateService = new TemplateService();
