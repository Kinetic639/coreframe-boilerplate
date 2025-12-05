/**
 * Movement Types Service
 * Migrated from src/modules/warehouse/api/movement-types-service.ts
 * Manages read-only access to system-defined movement types (SAP-style codes 101-613)
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import type {
  MovementCategory,
  PolishDocumentType,
  MovementTypeFilters,
} from "@/server/schemas/movement-types.schema";

// Type definitions
export interface MovementType {
  id: string;
  code: string;
  category: MovementCategory;
  name: string;
  name_pl: string;
  name_en: string;
  description: string | null;
  polish_document_type: PolishDocumentType | null;
  affects_stock: -1 | 0 | 1;
  requires_approval: boolean;
  requires_source_location: boolean;
  requires_destination_location: boolean;
  requires_reference: boolean;
  allows_manual_entry: boolean;
  generates_document: boolean;
  is_system: boolean;
  cost_impact: string | null;
  accounting_entry: Record<string, unknown> | null;
  metadata: Record<string, unknown>;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface MovementTypeSummary {
  code: string;
  name: string;
  nameLocalized: string;
  category: MovementCategory;
  description?: string;
}

export interface MovementValidation {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

export class MovementTypesService {
  /**
   * Get all movement types
   */
  static async getMovementTypes(
    supabase: SupabaseClient<Database>,
    filters?: MovementTypeFilters
  ): Promise<MovementType[]> {
    let query = supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .order("code", { ascending: true });

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
      throw new Error(`Failed to fetch movement types: ${error.message}`);
    }

    return (data || []) as MovementType[];
  }

  /**
   * Get movement types by category
   */
  static async getMovementTypesByCategory(
    supabase: SupabaseClient<Database>,
    category: MovementCategory
  ): Promise<MovementType[]> {
    const { data, error } = await supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .eq("category", category)
      .order("code", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch ${category} movement types: ${error.message}`);
    }

    return (data || []) as MovementType[];
  }

  /**
   * Get a single movement type by code
   */
  static async getMovementTypeByCode(
    supabase: SupabaseClient<Database>,
    code: string
  ): Promise<MovementType | null> {
    const { data, error } = await supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .eq("code", code)
      .maybeSingle();

    if (error) {
      throw new Error(`Failed to fetch movement type: ${error.message}`);
    }

    return (data as MovementType) || null;
  }

  /**
   * Get movement types that allow manual entry
   */
  static async getManualEntryTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    const { data, error } = await supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .eq("allows_manual_entry", true)
      .order("category", { ascending: true })
      .order("name", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch manual entry types: ${error.message}`);
    }

    return (data || []) as MovementType[];
  }

  /**
   * Get movement types that generate documents
   */
  static async getDocumentGeneratingTypes(
    supabase: SupabaseClient<Database>,
    documentType?: PolishDocumentType
  ): Promise<MovementType[]> {
    let query = supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .eq("generates_document", true);

    if (documentType) {
      query = query.eq("polish_document_type", documentType);
    }

    const { data, error } = await query.order("code", { ascending: true });

    if (error) {
      throw new Error(`Failed to fetch document generating types: ${error.message}`);
    }

    return (data || []) as MovementType[];
  }

  /**
   * Get movement types grouped by category
   */
  static async getMovementTypesGroupedByCategory(
    supabase: SupabaseClient<Database>
  ): Promise<Record<MovementCategory, MovementType[]>> {
    const types = await this.getMovementTypes(supabase);

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
   */
  static async getMovementTypeSummaries(
    supabase: SupabaseClient<Database>,
    locale: "pl" | "en" = "en",
    filters?: MovementTypeFilters
  ): Promise<MovementTypeSummary[]> {
    const types = await this.getMovementTypes(supabase, filters);

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
   */
  static async validateMovementRequirements(
    supabase: SupabaseClient<Database>,
    movementTypeCode: string,
    hasSourceLocation: boolean,
    hasDestinationLocation: boolean,
    hasReference: boolean
  ): Promise<MovementValidation> {
    const errors: string[] = [];
    const warnings: string[] = [];

    const movementType = await this.getMovementTypeByCode(supabase, movementTypeCode);

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
   */
  static async requiresApproval(
    supabase: SupabaseClient<Database>,
    code: string
  ): Promise<boolean> {
    const type = await this.getMovementTypeByCode(supabase, code);
    return type?.requires_approval || false;
  }

  /**
   * Check if a movement type generates a document
   */
  static async generatesDocument(
    supabase: SupabaseClient<Database>,
    code: string
  ): Promise<boolean> {
    const type = await this.getMovementTypeByCode(supabase, code);
    return type?.generates_document || false;
  }

  /**
   * Get the Polish document type for a movement type
   */
  static async getPolishDocumentType(
    supabase: SupabaseClient<Database>,
    code: string
  ): Promise<PolishDocumentType | null> {
    const type = await this.getMovementTypeByCode(supabase, code);
    return type?.polish_document_type || null;
  }

  /**
   * Search movement types by name
   */
  static async searchMovementTypes(
    supabase: SupabaseClient<Database>,
    searchTerm: string
  ): Promise<MovementType[]> {
    const term = searchTerm.toLowerCase();

    const { data, error } = await supabase
      .from("movement_types")
      .select("*")
      .is("deleted_at", null)
      .or(
        `name.ilike.%${term}%,name_pl.ilike.%${term}%,name_en.ilike.%${term}%,code.ilike.%${term}%`
      )
      .order("code", { ascending: true });

    if (error) {
      throw new Error(`Failed to search movement types: ${error.message}`);
    }

    return (data || []) as MovementType[];
  }

  /**
   * Get receipt movement types (for receiving goods)
   */
  static async getReceiptTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "receipt");
  }

  /**
   * Get issue movement types (for issuing goods)
   */
  static async getIssueTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "issue");
  }

  /**
   * Get transfer movement types
   */
  static async getTransferTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "transfer");
  }

  /**
   * Get adjustment movement types
   */
  static async getAdjustmentTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "adjustment");
  }

  /**
   * Get reservation movement types
   */
  static async getReservationTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "reservation");
  }

  /**
   * Get e-commerce movement types
   */
  static async getEcommerceTypes(supabase: SupabaseClient<Database>): Promise<MovementType[]> {
    return this.getMovementTypesByCategory(supabase, "ecommerce");
  }

  /**
   * Get statistics about movement types
   */
  static async getStatistics(supabase: SupabaseClient<Database>): Promise<{
    total: number;
    byCategory: Record<MovementCategory, number>;
    systemTypes: number;
    manualEntryTypes: number;
    documentGeneratingTypes: number;
    approvalRequiredTypes: number;
  }> {
    const types = await this.getMovementTypes(supabase);

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
