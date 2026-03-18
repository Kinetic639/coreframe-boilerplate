import { createClient } from "@/utils/supabase/client";
import type {
  ProductCategory,
  CategoryTreeItem,
  CreateCategoryData,
  UpdateCategoryData,
  DeleteCategoryInfo,
  ReorderCategoryItem,
} from "../types/categories";

class CategoriesService {
  private supabase = createClient();

  /**
   * Get all categories for an organization as a tree
   * Excludes default "Uncategorized" category from display
   */
  async getCategories(organizationId: string): Promise<CategoryTreeItem[]> {
    const { data, error } = await this.supabase
      .from("product_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_default", false)
      .is("deleted_at", null)
      .order("sort_order");

    if (error) throw error;

    const categories = data || [];
    return this.buildCategoryTree(categories);
  }

  /**
   * Get a single category by ID
   */
  async getCategoryById(categoryId: string): Promise<ProductCategory | null> {
    const { data, error } = await this.supabase
      .from("product_categories")
      .select("*")
      .eq("id", categoryId)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get the default "Uncategorized" category for an organization
   */
  async getDefaultCategory(organizationId: string): Promise<ProductCategory> {
    const { data, error } = await this.supabase
      .from("product_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_default", true)
      .is("deleted_at", null)
      .single();

    if (error) throw error;
    return data;
  }

  /**
   * Get the first non-default category (used as fallback target)
   */
  async getFirstCategory(organizationId: string): Promise<ProductCategory | null> {
    const { data, error } = await this.supabase
      .from("product_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_default", false)
      .is("deleted_at", null)
      .order("sort_order")
      .limit(1)
      .maybeSingle();

    if (error) throw error;
    return data;
  }

  /**
   * Create a new category
   */
  async createCategory(data: CreateCategoryData): Promise<ProductCategory> {
    // Get the next sort_order for this parent level
    const { data: existing } = await this.supabase
      .from("product_categories")
      .select("sort_order")
      .eq("organization_id", data.organization_id)
      .eq("parent_id", data.parent_id || null)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = existing ? existing.sort_order + 1 : 0;

    // Calculate level
    let level = 0;
    if (data.parent_id) {
      const parent = await this.getCategoryById(data.parent_id);
      level = parent ? parent.level + 1 : 0;
    }

    const { data: category, error } = await this.supabase
      .from("product_categories")
      .insert({
        organization_id: data.organization_id,
        name: data.name,
        description: data.description,
        parent_id: data.parent_id || null,
        icon_name: data.icon_name,
        color: data.color,
        level,
        sort_order: nextSortOrder,
      })
      .select()
      .single();

    if (error) throw error;
    return category;
  }

  /**
   * Update an existing category
   */
  async updateCategory(categoryId: string, data: UpdateCategoryData): Promise<ProductCategory> {
    const updateData: Record<string, unknown> = {};

    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.icon_name !== undefined) updateData.icon_name = data.icon_name;
    if (data.color !== undefined) updateData.color = data.color;

    const { data: category, error } = await this.supabase
      .from("product_categories")
      .update(updateData)
      .eq("id", categoryId)
      .select()
      .single();

    if (error) throw error;
    return category;
  }

  /**
   * Check deletion requirements and return info (InFlow behavior)
   */
  async checkDeletion(categoryId: string): Promise<DeleteCategoryInfo> {
    const category = await this.getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    // Cannot delete default category
    if (category.is_default) {
      throw new Error("Cannot delete default category");
    }

    const productCount = await this.countProducts(categoryId);
    const childCount = await this.countChildren(categoryId);

    // Determine target category
    let targetCategory: ProductCategory;
    let message: string;

    if (!category.parent_id) {
      // Main category deletion - move to first category or default
      const firstCategory = await this.getFirstCategory(category.organization_id);
      targetCategory = firstCategory || (await this.getDefaultCategory(category.organization_id));

      message =
        childCount > 0
          ? `This category contains ${productCount} products and ${childCount} subcategories. All will be moved to "${targetCategory.name}"`
          : `${productCount} products will be moved to "${targetCategory.name}"`;
    } else {
      // Subcategory deletion - move to parent
      const parentCategory = await this.getCategoryById(category.parent_id);
      if (!parentCategory) throw new Error("Parent category not found");

      targetCategory = parentCategory;
      message = `${productCount} products will be moved from "${category.name}" to "${targetCategory.name}"`;
    }

    return {
      requiresConfirmation: true,
      message,
      productCount,
      childCount: childCount > 0 ? childCount : undefined,
      targetCategory: targetCategory.name,
      targetCategoryId: targetCategory.id,
    };
  }

  /**
   * Delete a category (with product reassignment per InFlow logic)
   */
  async deleteCategory(categoryId: string): Promise<void> {
    const deleteInfo = await this.checkDeletion(categoryId);

    // Move products to target category
    await this.moveProductsToCategory(categoryId, deleteInfo.targetCategoryId);

    // Move children to target category (or delete cascade will handle it)
    const category = await this.getCategoryById(categoryId);
    if (category && !category.parent_id) {
      // Main category - move children
      await this.moveChildrenToCategory(categoryId, deleteInfo.targetCategoryId);
    }

    // Soft delete the category
    const { error } = await this.supabase
      .from("product_categories")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", categoryId);

    if (error) throw error;
  }

  /**
   * Move all products from one category to another
   */
  async moveProductsToCategory(fromCategoryId: string, toCategoryId: string): Promise<void> {
    const { error } = await this.supabase
      .from("products")
      .update({ category_id: toCategoryId })
      .eq("category_id", fromCategoryId);

    if (error) throw error;
  }

  /**
   * Move all children of a category to a new parent
   */
  async moveChildrenToCategory(parentId: string, newParentId: string | null): Promise<void> {
    const { error } = await this.supabase
      .from("product_categories")
      .update({ parent_id: newParentId })
      .eq("parent_id", parentId)
      .is("deleted_at", null);

    if (error) throw error;
  }

  /**
   * Count products in a category
   */
  async countProducts(categoryId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("products")
      .select("*", { count: "exact", head: true })
      .eq("category_id", categoryId)
      .is("deleted_at", null);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Count child categories
   */
  async countChildren(categoryId: string): Promise<number> {
    const { count, error } = await this.supabase
      .from("product_categories")
      .select("*", { count: "exact", head: true })
      .eq("parent_id", categoryId)
      .is("deleted_at", null);

    if (error) throw error;
    return count || 0;
  }

  /**
   * Reorder categories at the same level
   */
  async reorderCategories(
    organizationId: string,
    parentId: string | null,
    items: ReorderCategoryItem[]
  ): Promise<void> {
    for (const item of items) {
      const { error } = await this.supabase
        .from("product_categories")
        .update({ sort_order: item.sort_order })
        .eq("id", item.id)
        .eq("organization_id", organizationId);

      if (error) throw error;
    }
  }

  /**
   * Move category to a different parent (or to top level)
   */
  async moveCategory(categoryId: string, newParentId: string | null): Promise<void> {
    const category = await this.getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    // Calculate new level
    let newLevel = 0;
    if (newParentId) {
      const newParent = await this.getCategoryById(newParentId);
      if (!newParent) throw new Error("Target parent category not found");

      // Prevent moving to own child
      if (await this.isDescendant(newParentId, categoryId)) {
        throw new Error("Cannot move category to its own descendant");
      }

      newLevel = newParent.level + 1;
    }

    // Get next sort order in target location
    const { data: siblings } = await this.supabase
      .from("product_categories")
      .select("sort_order")
      .eq("organization_id", category.organization_id)
      .eq("parent_id", newParentId || null)
      .is("deleted_at", null)
      .order("sort_order", { ascending: false })
      .limit(1)
      .maybeSingle();

    const nextSortOrder = siblings ? siblings.sort_order + 1 : 0;

    // Update category
    const { error } = await this.supabase
      .from("product_categories")
      .update({
        parent_id: newParentId,
        level: newLevel,
        sort_order: nextSortOrder,
      })
      .eq("id", categoryId);

    if (error) throw error;

    // Update levels of all children recursively
    await this.updateChildrenLevels(categoryId, newLevel);
  }

  /**
   * Check if targetId is a descendant of categoryId
   */
  private async isDescendant(targetId: string, categoryId: string): Promise<boolean> {
    const target = await this.getCategoryById(targetId);
    if (!target) return false;

    if (target.parent_id === categoryId) return true;
    if (!target.parent_id) return false;

    return this.isDescendant(target.parent_id, categoryId);
  }

  /**
   * Update levels of all children when parent moves
   */
  private async updateChildrenLevels(parentId: string, parentLevel: number): Promise<void> {
    const { data: children } = await this.supabase
      .from("product_categories")
      .select("id, level")
      .eq("parent_id", parentId)
      .is("deleted_at", null);

    if (!children || children.length === 0) return;

    const newChildLevel = parentLevel + 1;

    for (const child of children) {
      await this.supabase
        .from("product_categories")
        .update({ level: newChildLevel })
        .eq("id", child.id);

      // Recursively update grandchildren
      await this.updateChildrenLevels(child.id, newChildLevel);
    }
  }

  /**
   * Toggle preferred status (starred category)
   * Only one category can be preferred at a time
   */
  async togglePreferred(categoryId: string): Promise<boolean> {
    const category = await this.getCategoryById(categoryId);
    if (!category) throw new Error("Category not found");

    const newPreferredStatus = !category.is_preferred;

    // If setting as preferred, unset all other preferred categories first
    if (newPreferredStatus) {
      await this.supabase
        .from("product_categories")
        .update({ is_preferred: false })
        .eq("organization_id", category.organization_id)
        .eq("is_preferred", true)
        .neq("id", categoryId);
    }

    // Toggle this category
    const { error } = await this.supabase
      .from("product_categories")
      .update({ is_preferred: newPreferredStatus })
      .eq("id", categoryId);

    if (error) throw error;

    return newPreferredStatus;
  }

  /**
   * Get all preferred categories for quick access
   */
  async getPreferredCategories(organizationId: string): Promise<ProductCategory[]> {
    const { data, error } = await this.supabase
      .from("product_categories")
      .select("*")
      .eq("organization_id", organizationId)
      .eq("is_preferred", true)
      .is("deleted_at", null)
      .order("name");

    if (error) throw error;
    return data || [];
  }

  /**
   * Build hierarchical tree from flat category list
   */
  buildCategoryTree(categories: ProductCategory[]): CategoryTreeItem[] {
    const itemMap = new Map<string, CategoryTreeItem>();
    const rootItems: CategoryTreeItem[] = [];

    // First pass: create all items
    categories.forEach((cat) => {
      itemMap.set(cat.id, {
        ...cat,
        children: [],
        productCount: 0,
      });
    });

    // Second pass: build tree structure
    categories.forEach((cat) => {
      const item = itemMap.get(cat.id)!;

      if (cat.parent_id) {
        const parent = itemMap.get(cat.parent_id);
        if (parent) {
          parent.children = parent.children || [];
          parent.children.push(item);
        } else {
          rootItems.push(item);
        }
      } else {
        rootItems.push(item);
      }
    });

    // Sort children by sort_order
    const sortChildren = (items: CategoryTreeItem[]) => {
      items.sort((a, b) => a.sort_order - b.sort_order);
      items.forEach((item) => {
        if (item.children && item.children.length > 0) {
          sortChildren(item.children);
        }
      });
    };

    sortChildren(rootItems);

    return rootItems;
  }
}

export const categoriesService = new CategoriesService();
