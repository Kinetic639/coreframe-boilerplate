import { create } from "zustand";
import { devtools } from "zustand/middleware";
// Using template types from template module
import type {
  CreateTemplateRequest,
  CloneTemplateRequest,
  TemplateListResponse,
  ProductTemplate as TemplateProductTemplate,
  ProductAttributeDefinition as TemplateAttributeDefinition,
} from "@/modules/warehouse/types/template";
import { createClient } from "@/utils/supabase/client";

// Types for the store - Use the template interface from the template module
export interface TemplateWithAttributes {
  template: TemplateProductTemplate;
  attributes: TemplateAttributeDefinition[];
  attribute_count: number;
}

interface TemplateState {
  // Data state
  systemTemplates: TemplateWithAttributes[];
  organizationTemplates: TemplateWithAttributes[];
  currentTemplate: TemplateWithAttributes | null;

  // Loading states
  isLoadingSystem: boolean;
  isLoadingOrganization: boolean;
  isLoadingCurrent: boolean;
  isCreating: boolean;
  isUpdating: boolean;
  isDeleting: boolean;

  // Error states
  systemError: string | null;
  organizationError: string | null;
  currentError: string | null;
  actionError: string | null;

  // Meta state
  lastFetch: {
    system: Date | null;
    organization: Date | null;
  };
}

interface TemplateActions {
  // System templates
  loadSystemTemplates: () => Promise<void>;

  // Organization templates
  loadOrganizationTemplates: (organizationId: string) => Promise<void>;

  // Individual template
  loadTemplate: (templateId: string) => Promise<void>;
  clearCurrentTemplate: () => void;

  // CRUD operations
  createTemplate: (templateData: CreateTemplateRequest) => Promise<TemplateProductTemplate>;
  updateTemplate: (
    templateId: string,
    templateData: Partial<CreateTemplateRequest>
  ) => Promise<TemplateProductTemplate>;
  cloneTemplate: (request: CloneTemplateRequest) => Promise<TemplateProductTemplate>;
  deleteTemplate: (templateId: string) => Promise<void>;

  // Combined operations
  loadAllTemplates: (organizationId?: string) => Promise<TemplateListResponse>;

  // Utility actions
  clearErrors: () => void;
  reset: () => void;
}

export type TemplateStore = TemplateState & TemplateActions;

const initialState: TemplateState = {
  systemTemplates: [],
  organizationTemplates: [],
  currentTemplate: null,

  isLoadingSystem: false,
  isLoadingOrganization: false,
  isLoadingCurrent: false,
  isCreating: false,
  isUpdating: false,
  isDeleting: false,

  systemError: null,
  organizationError: null,
  currentError: null,
  actionError: null,

  lastFetch: {
    system: null,
    organization: null,
  },
};

export const useTemplateStore = create<TemplateStore>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // System templates
      loadSystemTemplates: async () => {
        const supabase = createClient();
        set({ isLoadingSystem: true, systemError: null });

        try {
          const { data, error } = await supabase.rpc("get_system_templates");

          if (error) throw error;

          const templatesWithAttributes: TemplateWithAttributes[] = (data || []).map(
            (row: any) => ({
              id: row.template_id,
              name: row.template_name,
              slug: row.template_slug,
              description: row.description,
              icon: row.icon,
              color: row.color,
              metadata: row.metadata,
              organization_id: "", // System templates use empty string for org_id
              parent_template_id: null,
              is_system: true,
              created_at: row.created_at,
              updated_at: row.updated_at,
              deleted_at: null,
              attribute_definitions: Array.isArray(row.attributes) ? row.attributes : [],
              attribute_count: Array.isArray(row.attributes) ? row.attributes.length : 0,
            })
          );

          set({
            systemTemplates: templatesWithAttributes,
            isLoadingSystem: false,
            lastFetch: { ...get().lastFetch, system: new Date() },
          });
        } catch (error) {
          console.error("Error loading system templates:", error);
          set({
            systemError: error instanceof Error ? error.message : "Failed to load system templates",
            isLoadingSystem: false,
          });
        }
      },

      // Organization templates
      loadOrganizationTemplates: async (organizationId: string) => {
        const supabase = createClient();
        set({ isLoadingOrganization: true, organizationError: null });

        try {
          const { data, error } = await supabase.rpc("get_organization_templates", {
            p_organization_id: organizationId,
          });

          if (error) throw error;

          const templatesWithAttributes: TemplateWithAttributes[] = (data || []).map(
            (row: any) => ({
              id: row.template_id,
              name: row.template_name,
              slug: row.template_slug,
              description: row.description,
              icon: row.icon,
              color: row.color,
              metadata: row.metadata,
              organization_id: organizationId,
              parent_template_id: null,
              is_system: false,
              created_at: row.created_at,
              updated_at: row.updated_at,
              deleted_at: null,
              attribute_definitions: Array.isArray(row.attributes) ? row.attributes : [],
              attribute_count: Array.isArray(row.attributes) ? row.attributes.length : 0,
            })
          );

          set({
            organizationTemplates: templatesWithAttributes,
            isLoadingOrganization: false,
            lastFetch: { ...get().lastFetch, organization: new Date() },
          });
        } catch (error) {
          console.error("Error loading organization templates:", error);
          set({
            organizationError:
              error instanceof Error ? error.message : "Failed to load organization templates",
            isLoadingOrganization: false,
          });
        }
      },

      // Individual template
      loadTemplate: async (templateId: string) => {
        const supabase = createClient();
        set({ isLoadingCurrent: true, currentError: null });

        try {
          const { data, error } = await supabase.rpc("get_template_by_id", {
            p_template_id: templateId,
          });

          if (error) throw error;
          if (!data || data.length === 0) {
            throw new Error("Template not found");
          }

          const row = data[0];
          const templateWithAttributes: TemplateWithAttributes = {
            template: {
              id: row.template_id,
              name: row.template_name,
              slug: row.template_slug || "",
              description: row.description,
              organization_id: row.organization_id,
              parent_template_id: row.parent_template_id,
              is_system: row.is_system,
              is_active: true,
              supported_contexts: [],
              settings: {},
              created_at: row.created_at,
              updated_at: row.updated_at,
            },
            attributes: Array.isArray(row.attributes) ? row.attributes : [],
            attribute_count: Array.isArray(row.attributes) ? row.attributes.length : 0,
          };

          set({
            currentTemplate: templateWithAttributes,
            isLoadingCurrent: false,
          });
        } catch (error) {
          console.error("Error loading template:", error);
          set({
            currentError: error instanceof Error ? error.message : "Failed to load template",
            isLoadingCurrent: false,
            currentTemplate: null,
          });
        }
      },

      clearCurrentTemplate: () => {
        set({ currentTemplate: null, currentError: null });
      },

      // CRUD operations using the template service for now
      createTemplate: async (templateData: CreateTemplateRequest) => {
        set({ isCreating: true, actionError: null });

        try {
          // For now, fall back to direct Supabase calls since we don't have the full RPC for create
          const supabase = createClient();

          const { attributes, ...templateFields } = templateData;

          const { data: template, error: templateError } = await supabase
            .from("product_templates")
            .insert({
              ...templateFields,
              is_system: false,
              created_by: (await supabase.auth.getUser()).data.user?.id,
            })
            .select()
            .single();

          if (templateError) throw templateError;

          // Insert attributes if provided
          if (attributes && attributes.length > 0) {
            const attributeInserts = attributes.map((attr, index) => ({
              template_id: template.id,
              ...attr,
              display_order: attr.display_order || index,
            }));

            const { error: attributeError } = await supabase
              .from("template_attribute_definitions")
              .insert(attributeInserts);

            if (attributeError) throw attributeError;
          }

          // Refresh the organization templates if we have an organization ID
          if (templateData.organization_id) {
            await get().loadOrganizationTemplates(templateData.organization_id);
          }

          set({ isCreating: false });
          return template;
        } catch (error) {
          console.error("Error creating template:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to create template",
            isCreating: false,
          });
          throw error;
        }
      },

      updateTemplate: async (templateId: string, templateData: Partial<CreateTemplateRequest>) => {
        set({ isUpdating: true, actionError: null });

        try {
          const supabase = createClient();
          const { attributes, ...templateFields } = templateData;

          // Update template
          const { data: template, error: templateError } = await supabase
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
            const { error: deleteError } = await supabase
              .from("template_attribute_definitions")
              .delete()
              .eq("template_id", templateId);

            if (deleteError) throw deleteError;

            // Insert new attributes
            if (attributes.length > 0) {
              const attributeInserts = attributes.map((attr, index) => ({
                template_id: templateId,
                ...attr,
                display_order: attr.display_order || index,
              }));

              const { error: attributeError } = await supabase
                .from("template_attribute_definitions")
                .insert(attributeInserts);

              if (attributeError) throw attributeError;
            }
          }

          // Refresh current template if it's the one being updated
          if (get().currentTemplate?.template.id === templateId) {
            await get().loadTemplate(templateId);
          }

          set({ isUpdating: false });
          return template;
        } catch (error) {
          console.error("Error updating template:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to update template",
            isUpdating: false,
          });
          throw error;
        }
      },

      cloneTemplate: async (request: CloneTemplateRequest) => {
        set({ isCreating: true, actionError: null });

        try {
          // Get source template
          await get().loadTemplate(request.source_template_id);
          const sourceTemplate = get().currentTemplate;

          if (!sourceTemplate) {
            throw new Error("Source template not found");
          }

          // Create new template data
          const newTemplateData: CreateTemplateRequest = {
            name: request.new_name,
            description: request.customizations?.description || sourceTemplate.template.description,
            organization_id: request.target_organization_id,
            parent_template_id: request.source_template_id,
            category: request.customizations?.category || sourceTemplate.template.category,
            icon: request.customizations?.icon || sourceTemplate.template.icon,
            color: request.customizations?.color || sourceTemplate.template.color,
            supported_contexts:
              request.customizations?.supported_contexts ||
              sourceTemplate.template.supported_contexts,
            settings: request.customizations?.settings || sourceTemplate.template.settings,
            attributes: sourceTemplate.attributes.map(
              ({
                id: _id,
                template_id: _template_id,
                created_at: _created_at,
                updated_at: _updated_at,
                ...attr
              }) => attr
            ),
          };

          const result = await get().createTemplate(newTemplateData);
          set({ isCreating: false });
          return result;
        } catch (error) {
          console.error("Error cloning template:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to clone template",
            isCreating: false,
          });
          throw error;
        }
      },

      deleteTemplate: async (templateId: string) => {
        set({ isDeleting: true, actionError: null });

        try {
          const supabase = createClient();

          const { error } = await supabase
            .from("product_templates")
            .update({ deleted_at: new Date().toISOString() })
            .eq("id", templateId);

          if (error) throw error;

          // Remove from local state
          set((state) => ({
            systemTemplates: state.systemTemplates.filter((t) => t.template.id !== templateId),
            organizationTemplates: state.organizationTemplates.filter(
              (t) => t.template.id !== templateId
            ),
            currentTemplate:
              state.currentTemplate?.template.id === templateId ? null : state.currentTemplate,
            isDeleting: false,
          }));
        } catch (error) {
          console.error("Error deleting template:", error);
          set({
            actionError: error instanceof Error ? error.message : "Failed to delete template",
            isDeleting: false,
          });
          throw error;
        }
      },

      // Combined operations
      loadAllTemplates: async (organizationId?: string) => {
        const [systemPromise, orgPromise] = [
          get().loadSystemTemplates(),
          organizationId ? get().loadOrganizationTemplates(organizationId) : Promise.resolve(),
        ];

        await Promise.all([systemPromise, orgPromise]);

        return {
          system_templates: get().systemTemplates,
          organization_templates: get().organizationTemplates,
        };
      },

      // Utility actions
      clearErrors: () => {
        set({
          systemError: null,
          organizationError: null,
          currentError: null,
          actionError: null,
        });
      },

      reset: () => {
        set(initialState);
      },
    }),
    {
      name: "template-store",
    }
  )
);
