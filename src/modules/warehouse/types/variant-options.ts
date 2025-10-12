import type { Tables } from "../../../../supabase/types/types";

// Database types
export type VariantOptionGroup = Tables<"variant_option_groups">;
export type VariantOptionGroupValue = Tables<"variant_option_group_values">;
export type ProductOptionGroup = Tables<"product_option_groups">;
export type ProductOptionValue = Tables<"product_option_values">;
export type ProductVariantOption = Tables<"product_variant_options">;

// Extended types with relationships
export interface VariantOptionGroupWithValues {
  group: VariantOptionGroup;
  values: VariantOptionGroupValue[];
  valueCount: number;
}

export interface ProductOptionGroupWithValues {
  group: ProductOptionGroup;
  values: ProductOptionValue[];
  templateGroup?: VariantOptionGroup;
}

// Create/Update types
export interface CreateOptionGroupData {
  organization_id: string;
  name: string;
  description?: string;
  is_template?: boolean;
}

export interface UpdateOptionGroupData {
  name?: string;
  description?: string;
}

export interface CreateOptionValueData {
  option_group_id: string;
  value: string;
  display_order?: number;
}

export interface CreateProductOptionGroupData {
  product_id: string;
  template_group_id?: string;
  name: string;
  display_order?: number;
}

export interface CreateProductOptionValueData {
  product_option_group_id: string;
  value: string;
  display_order?: number;
}

// Preset suggestions for quick pick
export interface OptionGroupSuggestion {
  name: string;
  description: string;
  values: string[];
}

export interface OptionGroupSuggestions {
  dimensions: OptionGroupSuggestion;
  size: OptionGroupSuggestion;
  color: OptionGroupSuggestion;
  coating: OptionGroupSuggestion;
  panType: OptionGroupSuggestion;
  storageCapacity: OptionGroupSuggestion;
}
