import { create } from "zustand";
import { devtools } from "zustand/middleware";
import type { TemplateContext } from "@/modules/warehouse/types/flexible-products";
import type {
  ProductTemplate as TemplateProductTemplate,
  ProductAttributeDefinition as TemplateAttributeDefinition,
} from "@/modules/warehouse/types/template";

// Form field state for dynamic forms
interface FormFieldState {
  value: any;
  error: string | null;
  isDirty: boolean;
  isTouched: boolean;
  isValidating: boolean;
}

// Dynamic form state
interface DynamicFormState {
  // Template being used for the form
  template: TemplateProductTemplate | null;

  // Form fields organized by attribute key
  fields: Record<string, FormFieldState>;

  // Form-level state
  isValid: boolean;
  isDirty: boolean;
  isSubmitting: boolean;
  submitError: string | null;

  // Context for which the form is being used
  context: TemplateContext;

  // Form mode (create, edit, etc.)
  mode: "create" | "edit" | "clone";

  // Entity being edited (for edit mode)
  entityId: string | null;
}

interface FormStateActions {
  // Form initialization
  initializeForm: (
    template: TemplateProductTemplate,
    context: TemplateContext,
    mode?: "create" | "edit" | "clone",
    initialValues?: Record<string, any>,
    entityId?: string
  ) => void;

  // Field management
  setFieldValue: (fieldKey: string, value: any) => void;
  setFieldError: (fieldKey: string, error: string | null) => void;
  touchField: (fieldKey: string) => void;
  validateField: (fieldKey: string) => Promise<boolean>;

  // Form-level operations
  validateForm: () => Promise<boolean>;
  setFormError: (error: string | null) => void;
  setSubmitting: (isSubmitting: boolean) => void;

  // Form state management
  markClean: () => void;
  resetForm: () => void;
  clearForm: () => void;

  // Utility methods
  getFormValues: () => Record<string, any>;
  getChangedValues: () => Record<string, any>;
  hasUnsavedChanges: () => boolean;
}

const initialState: DynamicFormState = {
  template: null,
  fields: {},
  isValid: true,
  isDirty: false,
  isSubmitting: false,
  submitError: null,
  context: "warehouse",
  mode: "create",
  entityId: null,
};

export const useFormStateStore = create<DynamicFormState & FormStateActions>()(
  devtools(
    (set, get) => ({
      ...initialState,

      // ===== FORM INITIALIZATION =====

      initializeForm: (
        template: TemplateProductTemplate,
        context: TemplateContext,
        mode = "create",
        initialValues = {},
        entityId = null
      ) => {
        // Initialize fields based on template attributes
        const fields: Record<string, FormFieldState> = {};

        if (template.attribute_definitions) {
          template.attribute_definitions.forEach((attr: TemplateAttributeDefinition) => {
            // Only include attributes for the current context
            if (attr.context_scope === context) {
              const initialValue =
                initialValues[attr.slug] ||
                attr.default_value ||
                getDefaultValueForType(attr.data_type);

              fields[attr.slug] = {
                value: initialValue,
                error: null,
                isDirty: false,
                isTouched: false,
                isValidating: false,
              };
            }
          });
        }

        set({
          template,
          fields,
          context,
          mode,
          entityId,
          isValid: true,
          isDirty: false,
          isSubmitting: false,
          submitError: null,
        });
      },

      // ===== FIELD MANAGEMENT =====

      setFieldValue: (fieldKey: string, value: any) => {
        set((state) => {
          const field = state.fields[fieldKey];
          if (!field) return state;

          const newField = {
            ...field,
            value,
            isDirty: true,
            error: null, // Clear error when value changes
          };

          return {
            fields: {
              ...state.fields,
              [fieldKey]: newField,
            },
            isDirty: true,
          };
        });

        // Validate field after value change
        setTimeout(() => get().validateField(fieldKey), 100);
      },

      setFieldError: (fieldKey: string, error: string | null) => {
        set((state) => ({
          fields: {
            ...state.fields,
            [fieldKey]: {
              ...state.fields[fieldKey],
              error,
            },
          },
        }));
      },

      touchField: (fieldKey: string) => {
        set((state) => ({
          fields: {
            ...state.fields,
            [fieldKey]: {
              ...state.fields[fieldKey],
              isTouched: true,
            },
          },
        }));
      },

      validateField: async (fieldKey: string) => {
        const { template, fields } = get();
        const field = fields[fieldKey];

        if (!template || !field) return true;

        // Find attribute definition
        const attrDef = template.attribute_definitions?.find((attr) => attr.slug === fieldKey);
        if (!attrDef) return true;

        set((state) => ({
          fields: {
            ...state.fields,
            [fieldKey]: {
              ...state.fields[fieldKey],
              isValidating: true,
            },
          },
        }));

        try {
          let error: string | null = null;

          // Required field validation
          if (attrDef.is_required && (!field.value || field.value === "")) {
            error = `${getAttributeLabel(attrDef, "en")} is required`;
          }

          // Type validation
          if (!error && field.value) {
            error = validateAttributeValue(field.value, attrDef);
          }

          // Custom validation rules
          if (!error && attrDef.validation_rules) {
            error = await validateCustomRules(field.value, attrDef.validation_rules);
          }

          set((state) => ({
            fields: {
              ...state.fields,
              [fieldKey]: {
                ...state.fields[fieldKey],
                error,
                isValidating: false,
              },
            },
          }));

          return error === null;
        } catch {
          set((state) => ({
            fields: {
              ...state.fields,
              [fieldKey]: {
                ...state.fields[fieldKey],
                error: "Validation error occurred",
                isValidating: false,
              },
            },
          }));
          return false;
        }
      },

      // ===== FORM-LEVEL OPERATIONS =====

      validateForm: async () => {
        const { fields } = get();

        // Validate all fields
        const validationPromises = Object.keys(fields).map((fieldKey) =>
          get().validateField(fieldKey)
        );

        const results = await Promise.all(validationPromises);
        const isValid = results.every((result) => result);

        set({ isValid });
        return isValid;
      },

      setFormError: (error: string | null) => {
        set({ submitError: error });
      },

      setSubmitting: (isSubmitting: boolean) => {
        set({ isSubmitting });
      },

      // ===== FORM STATE MANAGEMENT =====

      markClean: () => {
        set((state) => ({
          isDirty: false,
          fields: Object.keys(state.fields).reduce(
            (acc, key) => ({
              ...acc,
              [key]: {
                ...state.fields[key],
                isDirty: false,
              },
            }),
            {}
          ),
        }));
      },

      resetForm: () => {
        const { template, context, mode, entityId } = get();
        if (template) {
          get().initializeForm(template, context, mode, {}, entityId);
        }
      },

      clearForm: () => {
        set(initialState);
      },

      // ===== UTILITY METHODS =====

      getFormValues: () => {
        const { fields } = get();
        return Object.keys(fields).reduce(
          (acc, key) => ({
            ...acc,
            [key]: fields[key].value,
          }),
          {}
        );
      },

      getChangedValues: () => {
        const { fields } = get();
        return Object.keys(fields).reduce((acc, key) => {
          if (fields[key].isDirty) {
            return { ...acc, [key]: fields[key].value };
          }
          return acc;
        }, {});
      },

      hasUnsavedChanges: () => {
        const { isDirty } = get();
        return isDirty;
      },
    }),
    {
      name: "form-state-store",
    }
  )
);

// ===== UTILITY FUNCTIONS =====

function getDefaultValueForType(dataType: string): any {
  switch (dataType) {
    case "text":
      return "";
    case "number":
      return 0;
    case "boolean":
      return false;
    case "date":
      return "";
    case "json":
      return null;
    default:
      return "";
  }
}

function getAttributeLabel(attr: TemplateAttributeDefinition, locale: string): string {
  if (typeof attr.label === "object" && attr.label) {
    return attr.label[locale] || attr.label["en"] || attr.slug;
  }
  return attr.slug;
}

function validateAttributeValue(value: any, attr: TemplateAttributeDefinition): string | null {
  switch (attr.data_type) {
    case "number":
      if (isNaN(Number(value))) {
        return `${getAttributeLabel(attr, "en")} must be a valid number`;
      }
      break;
    case "date":
      if (value && !Date.parse(value)) {
        return `${getAttributeLabel(attr, "en")} must be a valid date`;
      }
      break;
    case "boolean":
      if (typeof value !== "boolean" && value !== "true" && value !== "false") {
        return `${getAttributeLabel(attr, "en")} must be true or false`;
      }
      break;
  }
  return null;
}

async function validateCustomRules(value: any, rules: Record<string, any>): Promise<string | null> {
  // Implement custom validation rules here
  // This could include min/max lengths, patterns, etc.

  if (rules.min && typeof value === "string" && value.length < rules.min) {
    return `Value must be at least ${rules.min} characters`;
  }

  if (rules.max && typeof value === "string" && value.length > rules.max) {
    return `Value must be no more than ${rules.max} characters`;
  }

  if (rules.pattern && typeof value === "string" && !new RegExp(rules.pattern).test(value)) {
    return `Value does not match required format`;
  }

  return null;
}
