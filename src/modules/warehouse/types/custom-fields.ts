import type { Tables } from "@/types/supabase";

// Database types
export type CustomFieldDefinition = Tables<"product_custom_field_definitions">;
export type CustomFieldValue = Tables<"product_custom_field_values">;

// Field types
export type CustomFieldType = "text" | "checkbox" | "date" | "dropdown";

// Extended types with relations
export interface CustomFieldDefinitionWithValues
  extends Omit<CustomFieldDefinition, "dropdown_options"> {
  dropdown_options?: string[] | null; // Parsed from JSON
}

export interface CustomFieldValueFormatted {
  id: string;
  field_definition_id: string;
  field_name: string;
  field_type: CustomFieldType;
  value: string | boolean | null;
  dropdown_options?: string[];
}

// Form data for creating/updating field definitions
export interface CreateCustomFieldData {
  organization_id: string;
  field_name: string;
  field_type: CustomFieldType;
  dropdown_options?: string[]; // For dropdown type
  display_order?: number;
}

export interface UpdateCustomFieldData {
  id: string;
  field_name?: string;
  field_type?: CustomFieldType;
  dropdown_options?: string[];
  display_order?: number;
}

// Form data for setting field values
export interface SetCustomFieldValueData {
  field_definition_id: string;
  product_id?: string;
  variant_id?: string;
  value: string | boolean | null;
}
