// =============================================
// Movement Types Service
// Phase 1: Enhanced Movement Types
// Handles CRUD operations for movement types
// =============================================

import { createClient } from "@/lib/supabase/client";
import type {
  MovementType,
  MovementCategory,
  MovementTypeFilters,
  MovementTypeSummary,
  MovementValidation,
  PolishDocumentType,
} from "../types/movement-types";

/**
 * Service for managing movement types
 * Provides methods to query, filter, and validate movement types
 */
class MovementTypesService {
  private supabase = createClient();

  /**
   * Get all movement types
   * @param filters Optional filters to apply
   * @returns Array of movement types
   */
  async getMovementTypes(filters?: MovementTypeFilters): Promise<MovementType[]> {
    let query = this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .order("code", { ascending: true });

    // Apply filters
    if (filters?.category) {
      query = query.eq("category", filters.category);
    }

    if (filters?.allows_manual_entry !== undefined) {
      query = query.eq("allows_manual_entry", filters.allows_manual_entry);
    }

    if (filters?.generates_document !== undefined) {
      query = query.eq("generates_document", filters.generates_document);
    }

    if (filters?.polish_document_type) {
      query = query.eq("polish_document_type", filters.polish_document_type);
    }

    if (filters?.requires_approval !== undefined) {
      query = query.eq("requires_approval", filters.requires_approval);
    }

    const { data, error } = await query;

    if (error) {
      console.error("Error fetching movement types:", error);
      throw new Error(`Failed to fetch movement types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get movement types by category
   * @param category Movement category
   * @returns Array of movement types in the category
   */
  async getMovementTypesByCategory(category: MovementCategory): Promise<MovementType[]> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .eq("category", category)
      .order("code", { ascending: true });

    if (error) {
      console.error(`Error fetching ${category} movement types:`, error);
      throw new Error(`Failed to fetch ${category} movement types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get a single movement type by code
   * @param code Movement type code
   * @returns Movement type or null if not found
   */
  async getMovementTypeByCode(code: string): Promise<MovementType | null> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .eq("code", code)
      .maybeSingle();

    if (error) {
      console.error(`Error fetching movement type ${code}:`, error);
      throw new Error(`Failed to fetch movement type: ${error.message}`);
    }

    return data;
  }

  /**
   * Get movement types that allow manual entry
   * These are types that users can manually create movements for
   * @returns Array of movement types allowing manual entry
   */
  async getManualEntryTypes(): Promise<MovementType[]> {
    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .eq("allows_manual_entry", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      console.error("Error fetching manual entry types:", error);
      throw new Error(`Failed to fetch manual entry types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get movement types that generate documents
   * @param documentType Optional filter by Polish document type
   * @returns Array of movement types that generate documents
   */
  async getDocumentGeneratingTypes(documentType?: PolishDocumentType): Promise<MovementType[]> {
    let query = this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .eq("generates_document", true);

    if (documentType) {
      query = query.eq("polish_document_type", documentType);
    }

    const { data, error } = await query.order("code", { ascending: true });

    if (error) {
      console.error("Error fetching document generating types:", error);
      throw new Error(`Failed to fetch document generating types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get movement types grouped by category
   * Useful for UI display in categorized lists
   * @returns Object with categories as keys and movement types as values
   */
  async getMovementTypesGroupedByCategory(): Promise<Record<MovementCategory, MovementType[]>> {
    const types = await this.getMovementTypes();

    const grouped: Partial<Record<MovementCategory, MovementType[]>> = {};

    types.forEach((type) => {
      if (!grouped[type.category]) {
        grouped[type.category] = [];
      }
      grouped[type.category]!.push(type);
    });

    return grouped as Record<MovementCategory, MovementType[]>;
  }

  /**
   * Get movement type summaries for UI display
   * Returns simplified data optimized for dropdowns and lists
   * @param locale User's locale (pl or en)
   * @param filters Optional filters
   * @returns Array of movement type summaries
   */
  async getMovementTypeSummaries(
    locale: "pl" | "en" = "en",
    filters?: MovementTypeFilters
  ): Promise<MovementTypeSummary[]> {
    const types = await this.getMovementTypes(filters);

    return types.map((type) => ({
      code: type.code,
      name: type.name,
      nameLocalized: locale === "pl" ? type.name_pl : type.name_en,
      category: type.category,
      description: type.description || undefined,
    }));
  }

  /**
   * Validate movement requirements
   * Checks if a movement has all required fields based on its type
   * @param movementTypeCode Movement type code
   * @param hasSourceLocation Whether source location is provided
   * @param hasDestinationLocation Whether destination location is provided
   * @param hasReference Whether reference is provided
   * @returns Validation result
   */
  async validateMovementRequirements(
    movementTypeCode: string,
    hasSourceLocation: boolean,
    hasDestinationLocation: boolean,
    hasReference: boolean
  ): Promise<MovementValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const movementType = await this.getMovementTypeByCode(movementTypeCode);

    if (!movementType) {
      errors.push(`Movement type "${movementTypeCode}" not found`);
      return { isValid: false, errors, warnings };
    }

    // Check source location requirement
    if (movementType.requires_source_location && !hasSourceLocation) {
      errors.push(`Movement type "${movementType.name}" requires a source location`);
    }

    // Check destination location requirement
    if (movementType.requires_destination_location && !hasDestinationLocation) {
      errors.push(`Movement type "${movementType.name}" requires a destination location`);
    }

    // Check reference requirement
    if (movementType.requires_reference && !hasReference) {
      errors.push(`Movement type "${movementType.name}" requires a reference (order/document)`);
    }

    // Add warnings
    if (movementType.requires_approval) {
      warnings.push("This movement type requires approval before execution");
    }

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
    };
  }

  /**
   * Check if a movement type requires approval
   * @param code Movement type code
   * @returns True if approval is required
   */
  async requiresApproval(code: string): Promise<boolean> {
    const type = await this.getMovementTypeByCode(code);
    return type?.requires_approval || false;
  }

  /**
   * Check if a movement type generates a document
   * @param code Movement type code
   * @returns True if document is generated
   */
  async generatesDocument(code: string): Promise<boolean> {
    const type = await this.getMovementTypeByCode(code);
    return type?.generates_document || false;
  }

  /**
   * Get the Polish document type for a movement type
   * @param code Movement type code
   * @returns Polish document type or null
   */
  async getPolishDocumentType(code: string): Promise<PolishDocumentType | null> {
    const type = await this.getMovementTypeByCode(code);
    return type?.polish_document_type || null;
  }

  /**
   * Search movement types by name
   * Searches in both Polish and English names
   * @param searchTerm Search term
   * @param locale Preferred locale for results
   * @returns Array of matching movement types
   */
  async searchMovementTypes(searchTerm: string): Promise<MovementType[]> {
    const term = searchTerm.toLowerCase();

    const { data, error } = await this.supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null) // Exclude soft-deleted records
      .or(
        `name.ilike.%${term}%,name_pl.ilike.%${term}%,name_en.ilike.%${term}%,code.ilike.%${term}%`
      )
      .order("code", { ascending: true });

    if (error) {
      console.error("Error searching movement types:", error);
      throw new Error(`Failed to search movement types: ${error.message}`);
    }

    return data || [];
  }

  /**
   * Get receipt movement types (for receiving goods)
   * @returns Array of receipt movement types
   */
  async getReceiptTypes(): Promise<MovementType[]> {
    return this.getMovementTypesByCategory("receipt");
  }

  /**
   * Get issue movement types (for issuing goods)
   * @returns Array of issue movement types
   */
  async getIssueTypes(): Promise<MovementType[]> {
    return this.getMovementTypesByCategory("issue");
  }

  /**
   * Get transfer movement types
   * @returns Array of transfer movement types
   */
  async getTransferTypes(): Promise<MovementType[]> {
    return this.getMovementTypesByCategory("transfer");
  }

  /**
   * Get adjustment movement types
   * @returns Array of adjustment movement types
   */
  async getAdjustmentTypes(): Promise<MovementType[]> {
    return this.getMovementTypesByCategory("adjustment");
  }

  /**
   * Get e-commerce movement types
   * @returns Array of e-commerce movement types
   */
  async getEcommerceTypes(): Promise<MovementType[]> {
    return this.getMovementTypesByCategory("ecommerce");
  }

  /**
   * Get statistics about movement types
   * Useful for admin dashboards
   * @returns Statistics object
   */
  async getStatistics(): Promise<{
    total: number;
    byCategory: Record<MovementCategory, number>;
    systemTypes: number;
    manualEntryTypes: number;
    documentGeneratingTypes: number;
    approvalRequiredTypes: number;
  }> {
    const types = await this.getMovementTypes();

    const byCategory = types.reduce(
      (acc, type) => {
        acc[type.category] = (acc[type.category] || 0) + 1;
        return acc;
      },
      {} as Record<MovementCategory, number>
    );

    return {
      total: types.length,
      byCategory,
      systemTypes: types.filter((t) => t.is_system).length,
      manualEntryTypes: types.filter((t) => t.allows_manual_entry).length,
      documentGeneratingTypes: types.filter((t) => t.generates_document).length,
      approvalRequiredTypes: types.filter((t) => t.requires_approval).length,
    };
  }
}

// Export singleton instance
export const movementTypesService = new MovementTypesService();

// Also export the class for testing
export { MovementTypesService };
