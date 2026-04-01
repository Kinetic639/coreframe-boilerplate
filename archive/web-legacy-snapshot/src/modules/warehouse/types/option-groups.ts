import type { Tables } from "../../../../supabase/types/types";

// Database types
export type VariantOptionGroup = Tables<"variant_option_groups">;
export type VariantOptionValue = Tables<"variant_option_values">;

// Extended types with relations
export interface OptionGroupWithValues extends VariantOptionGroup {
  values: VariantOptionValue[];
}

// Form data for creating/updating option groups
export interface CreateOptionGroupData {
  organization_id: string;
  name: string;
  values?: Array<{
    value: string;
    display_order?: number;
  }>;
}

export interface UpdateOptionGroupData {
  id: string;
  name?: string;
}

// Form data for creating/updating option values
export interface CreateOptionValueData {
  option_group_id: string;
  value: string;
  display_order?: number;
}

export interface UpdateOptionValueData {
  id: string;
  value?: string;
  display_order?: number;
}
