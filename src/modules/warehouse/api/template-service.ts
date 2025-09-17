import { createClient } from "@/utils/supabase/client";
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
          category: template.metadata?.category || "general",
          supported_contexts: Array.isArray(template.metadata?.contexts)
            ? template.metadata.contexts
            : ["warehouse"],
          settings: template.metadata || {},
          is_active: true,
        },
        attributes: (template.template_attribute_definitions || []).map((attr: any) => ({
          id: attr.id,
          template_id: attr.template_id,
          slug: attr.attribute_key,
          label: {
            pl: attr.display_name || attr.attribute_key,
            en: attr.display_name || attr.attribute_key,
          },
          description: attr.description ? { pl: attr.description, en: attr.description } : null,
          data_type: attr.data_type,
          is_required: attr.is_required || false,
          is_unique: attr.is_unique || false,
          default_value: attr.default_value,
          validation_rules: attr.validation_rules || {},
          context_scope: Array.isArray(attr.context_scope)
            ? attr.context_scope[0] || "warehouse"
            : "warehouse",
          display_order: attr.display_order || 0,
          is_searchable: attr.is_searchable !== false, // Default to true
          is_filterable: false,
          input_type: "text",
          placeholder: null,
          help_text: null,
          created_at: attr.created_at,
          updated_at: attr.updated_at || attr.created_at,
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
          category: template.metadata?.category || "custom",
          supported_contexts: Array.isArray(template.metadata?.contexts)
            ? template.metadata.contexts
            : ["warehouse"],
          settings: template.metadata || {},
          is_active: true,
        },
        attributes: (template.template_attribute_definitions || []).map((attr: any) => ({
          id: attr.id,
          template_id: attr.template_id,
          slug: attr.attribute_key,
          label: {
            pl: attr.display_name || attr.attribute_key,
            en: attr.display_name || attr.attribute_key,
          },
          description: attr.description ? { pl: attr.description, en: attr.description } : null,
          data_type: attr.data_type,
          is_required: attr.is_required || false,
          is_unique: attr.is_unique || false,
          default_value: attr.default_value,
          validation_rules: attr.validation_rules || {},
          context_scope: Array.isArray(attr.context_scope)
            ? attr.context_scope[0] || "warehouse"
            : "warehouse",
          display_order: attr.display_order || 0,
          is_searchable: attr.is_searchable !== false, // Default to true
          is_filterable: false,
          input_type: "text",
          placeholder: null,
          help_text: null,
          created_at: attr.created_at,
          updated_at: attr.updated_at || attr.created_at,
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
          metadata: data.metadata || {},
          organization_id: data.organization_id || null,
          parent_template_id: data.parent_template_id || null,
          is_system: Boolean(data.is_system),
          is_active: true,
          category: data.metadata?.category || (data.is_system ? "general" : "custom"),
          supported_contexts: Array.isArray(data.metadata?.contexts)
            ? data.metadata.contexts
            : ["warehouse"],
          settings: data.metadata || {},
          created_by: data.created_by || null,
        },
        attributes: (data.template_attribute_definitions || []).map((attr: any) => ({
          id: attr.id,
          template_id: attr.template_id,
          slug: attr.attribute_key,
          label: {
            pl: attr.display_name || attr.attribute_key,
            en: attr.display_name || attr.attribute_key,
          },
          description: attr.description ? { pl: attr.description, en: attr.description } : null,
          data_type: attr.data_type,
          is_required: attr.is_required || false,
          is_unique: attr.is_unique || false,
          default_value: attr.default_value,
          validation_rules: attr.validation_rules || {},
          context_scope: Array.isArray(attr.context_scope)
            ? attr.context_scope[0] || "warehouse"
            : "warehouse",
          display_order: attr.display_order || 0,
          is_searchable: attr.is_searchable !== false, // Default to true
          is_filterable: false,
          input_type: "text",
          placeholder: null,
          help_text: null,
          created_at: attr.created_at,
          updated_at: attr.updated_at || attr.created_at,
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
      // For now, we'll create the template manually since we can't use the stored procedure
      const { attributes, supported_contexts, settings, category, ...templateFields } =
        templateData;

      // Create metadata object with supported_contexts and settings
      const metadata = {
        ...settings,
        contexts: supported_contexts || ["warehouse"],
        category: category || "custom",
      };

      // Generate unique slug from name
      const baseSlug = templateFields.name
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-+|-+$/g, "");

      // Check for existing slug and append number if needed
      let slug = baseSlug;
      let counter = 1;

      while (true) {
        const { data: existingTemplate } = await this.supabase
          .from("product_templates")
          .select("id")
          .eq("organization_id", templateFields.organization_id)
          .eq("slug", slug)
          .is("deleted_at", null)
          .single();

        if (!existingTemplate) {
          break; // Slug is unique
        }

        slug = `${baseSlug}-${counter}`;
        counter++;
      }

      const insertData = {
        ...templateFields,
        slug,
        metadata,
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
        const attributeInserts = attributes.map((attr, index) => {
          // Handle the mapping between frontend types and database schema
          const insert = {
            template_id: template.id,
            attribute_key: attr.slug || `attr_${index}`,
            display_name:
              typeof attr.label === "object"
                ? attr.label.en || attr.label.pl || Object.values(attr.label)[0] || attr.slug
                : attr.label || attr.slug || `Attribute ${index + 1}`,
            description:
              typeof attr.description === "object"
                ? attr.description.en || attr.description.pl || Object.values(attr.description)[0]
                : attr.description || null,
            data_type: attr.data_type || "text",
            is_required: attr.is_required || false,
            is_unique: attr.is_unique || false,
            is_searchable: attr.is_searchable !== false, // Default to true
            default_value: attr.default_value || null,
            validation_rules: attr.validation_rules || {},
            context_scope: Array.isArray(attr.context_scope)
              ? [attr.context_scope[0] || "warehouse"]
              : [attr.context_scope || "warehouse"],
            display_order: attr.display_order || index,
          };

          return insert;
        });

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
      const { attributes, ...templateFields } = templateData;

      // Update template
      const { data: template, error: templateError } = await this.supabase
        .from("product_templates")
        .update({
          ...templateFields,
          updated_at: new Date().toISOString(),
        })
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
              typeof attr.label === "object"
                ? attr.label.en || attr.label.pl || Object.values(attr.label)[0] || attr.slug
                : attr.label || attr.slug || `Attribute ${index + 1}`,
            description:
              typeof attr.description === "object"
                ? attr.description.en || attr.description.pl || Object.values(attr.description)[0]
                : attr.description || null,
            data_type: attr.data_type || "text",
            is_required: attr.is_required || false,
            is_unique: attr.is_unique || false,
            is_searchable: attr.is_searchable !== false,
            default_value: attr.default_value || null,
            validation_rules: attr.validation_rules || {},
            context_scope: Array.isArray(attr.context_scope)
              ? [attr.context_scope[0] || "warehouse"]
              : [attr.context_scope || "warehouse"],
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

      // Generate unique slug from new name
      // const baseSlug = (request.new_name || "Cloned Template")
      //   .toLowerCase()
      //   .replace(/[^a-z0-9]+/g, "-")
      //   .replace(/^-+|-+$/g, "");

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
      const { error } = await this.supabase
        .from("product_templates")
        .update({
          deleted_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq("id", templateId);

      if (error) throw error;
    } catch (error) {
      console.error("Error deleting template:", error);
      throw error;
    }
  }
}

export const templateService = new TemplateService();
