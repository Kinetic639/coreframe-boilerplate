import type { Tables } from "../../../../supabase/types/types";

// Database types
export type ProductCategory = Tables<"product_categories">;

// Extended type for tree display
export interface CategoryTreeItem {
  id: string;
  name: string;
  description?: string | null;
  parent_id?: string | null;
  level: number;
  sort_order: number;
  icon_name?: string | null;
  color?: string | null;
  is_default: boolean;
  organization_id: string;
  created_at?: string | null;
  updated_at?: string | null;
  children?: CategoryTreeItem[];
  productCount?: number;
}

// Form data for creating categories
export interface CreateCategoryData {
  organization_id: string;
  name: string;
  description?: string;
  parent_id?: string | null;
  icon_name?: string;
  color?: string;
}

// Form data for updating categories
export interface UpdateCategoryData {
  id: string;
  name?: string;
  description?: string;
  icon_name?: string;
  color?: string;
}

// Deletion info returned before actual deletion
export interface DeleteCategoryInfo {
  requiresConfirmation: boolean;
  message: string;
  productCount: number;
  childCount?: number;
  targetCategory: string;
  targetCategoryId: string;
}

// Reorder data
export interface ReorderCategoryItem {
  id: string;
  sort_order: number;
}
