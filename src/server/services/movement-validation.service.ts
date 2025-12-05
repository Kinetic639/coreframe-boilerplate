/**
 * Movement Validation Service
 * Migrated from src/modules/warehouse/api/movement-validation-service.ts
 * Validates movement data before creation/update with comprehensive business rules
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "../../../supabase/types/types";
import { MovementTypesService, type MovementType } from "@/server/services/movement-types.service";
import type { CreateStockMovementInput } from "@/server/schemas/stock-movements.schema";

// Validation constants
const MOVEMENT_VALIDATION = {
  MAX_QUANTITY: 999999.9999,
  MIN_QUANTITY: 0.0001,
  MAX_COST: 9999999999.99,
  LARGE_QUANTITY_THRESHOLD: 10000,
  EXPIRY_WARNING_DAYS: 30,
};

// Type definitions
export interface MovementValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
  requiredFields: {
    sourceLocation: boolean;
    destinationLocation: boolean;
    reference: boolean;
    approval: boolean;
  };
  stockCheck?: {
    available: number;
    required: number;
    sufficient: boolean;
  };
}

export class MovementValidationService {
  /**
   * Validate movement data before creation
   * Performs all necessary checks in a single pass for performance
   */
  static async validateMovement(
    supabase: SupabaseClient<Database>,
    data: CreateStockMovementInput
  ): Promise<MovementValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Fetch movement type
    let movementType: MovementType | null = null;
    try {
      movementType = await MovementTypesService.getMovementTypeByCode(
        supabase,
        data.movement_type_code
      );

      if (!movementType) {
        errors.push(`Movement type '${data.movement_type_code}' not found`);
        return this.createResult(false, errors, warnings);
      }
    } catch (error) {
      const err = error as Error;
      errors.push(`Failed to fetch movement type: ${err.message}`);
      return this.createResult(false, errors, warnings);
    }

    // Required fields validation
    const requiredFields = this.validateRequiredFields(data, movementType, errors);

    // Quantity validation
    this.validateQuantity(data.quantity, errors, warnings);

    // Cost validation
    if (data.unit_cost !== undefined && data.unit_cost !== null) {
      this.validateCost(data.unit_cost, errors);
    }

    // Location validation
    this.validateLocations(data, movementType, errors);

    // Stock availability check (for issue movements)
    let stockCheck;
    if (movementType.category === "issue" && data.source_location_id && data.product_id) {
      try {
        const level = await StockMovementsService.getStockLevel(
          supabase,
          data.product_id,
          data.variant_id || null,
          data.source_location_id
        );

        const available = level?.available_quantity || 0;
        const sufficient = available >= data.quantity;
        stockCheck = {
          available,
          required: data.quantity,
          sufficient,
        };

        if (!sufficient) {
          errors.push(`Insufficient stock. Available: ${available}, Required: ${data.quantity}`);
        }
      } catch {
        warnings.push("Could not verify stock availability");
      }
    }

    // Reference validation
    if (movementType.requires_reference && !data.reference_id) {
      errors.push("Reference is required for this movement type");
    }

    // Date validation
    if (data.occurred_at) {
      this.validateDate(data.occurred_at, errors, warnings);
    }

    // Batch/Serial/Lot validation
    this.validateTrackingFields(data, warnings);

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      requiredFields,
      stockCheck,
    };
  }

  /**
   * Batch validation for multiple movements
   */
  static async validateBatch(
    supabase: SupabaseClient<Database>,
    movements: CreateStockMovementInput[]
  ): Promise<MovementValidationResult[]> {
    const validations = await Promise.all(
      movements.map((movement) => this.validateMovement(supabase, movement))
    );

    return validations;
  }

  /**
   * Quick validation (without stock checks)
   * Useful for form validation before submission
   */
  static async quickValidate(
    supabase: SupabaseClient<Database>,
    data: CreateStockMovementInput
  ): Promise<MovementValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic field validation only
    if (!data.movement_type_code) {
      errors.push("Movement type is required");
    }

    if (!data.product_id) {
      errors.push("Product is required");
    }

    this.validateQuantity(data.quantity, errors, warnings);

    if (data.unit_cost !== undefined && data.unit_cost !== null) {
      this.validateCost(data.unit_cost, errors);
    }

    return this.createResult(errors.length === 0, errors, warnings);
  }

  /**
   * Validate required fields based on movement type
   * @private
   */
  private static validateRequiredFields(
    data: CreateStockMovementInput,
    movementType: MovementType,
    errors: string[]
  ): MovementValidationResult["requiredFields"] {
    const required = {
      sourceLocation: movementType.requires_source_location || false,
      destinationLocation: movementType.requires_destination_location || false,
      reference: movementType.requires_reference || false,
      approval: movementType.requires_approval || false,
    };

    // Validate source location
    if (required.sourceLocation && !data.source_location_id) {
      errors.push("Source location is required for this movement type");
    }

    // Validate destination location
    if (required.destinationLocation && !data.destination_location_id) {
      errors.push("Destination location is required for this movement type");
    }

    // Validate reference
    if (required.reference && !data.reference_id && !data.reference_number) {
      errors.push("Reference document is required for this movement type");
    }

    return required;
  }

  /**
   * Validate quantity
   * @private
   */
  private static validateQuantity(quantity: number, errors: string[], warnings: string[]): void {
    if (quantity === undefined || quantity === null) {
      errors.push("Quantity is required");
      return;
    }

    if (isNaN(quantity)) {
      errors.push("Quantity must be a valid number");
      return;
    }

    if (quantity <= 0) {
      errors.push("Quantity must be greater than zero");
    }

    if (quantity < MOVEMENT_VALIDATION.MIN_QUANTITY) {
      errors.push(`Quantity must be at least ${MOVEMENT_VALIDATION.MIN_QUANTITY}`);
    }

    if (quantity > MOVEMENT_VALIDATION.MAX_QUANTITY) {
      errors.push(`Quantity cannot exceed ${MOVEMENT_VALIDATION.MAX_QUANTITY}`);
    }

    // Warning for very large quantities
    if (quantity > MOVEMENT_VALIDATION.LARGE_QUANTITY_THRESHOLD) {
      warnings.push("Large quantity detected. Please verify.");
    }

    // Warning for very small quantities
    if (quantity < 1 && quantity >= MOVEMENT_VALIDATION.MIN_QUANTITY) {
      warnings.push("Small quantity detected. Please verify decimal point.");
    }
  }

  /**
   * Validate cost
   * @private
   */
  private static validateCost(cost: number, errors: string[]): void {
    if (cost < 0) {
      errors.push("Cost cannot be negative");
    }

    if (cost > MOVEMENT_VALIDATION.MAX_COST) {
      errors.push(`Cost cannot exceed ${MOVEMENT_VALIDATION.MAX_COST}`);
    }

    if (isNaN(cost)) {
      errors.push("Cost must be a valid number");
    }
  }

  /**
   * Validate locations
   * @private
   */
  private static validateLocations(
    data: CreateStockMovementInput,
    movementType: MovementType,
    errors: string[]
  ): void {
    // Check if same location for transfer
    if (
      movementType.category === "transfer" &&
      data.source_location_id &&
      data.destination_location_id &&
      data.source_location_id === data.destination_location_id
    ) {
      errors.push("Source and destination locations cannot be the same for transfers");
    }

    // At least one location must be specified
    if (!data.source_location_id && !data.destination_location_id) {
      errors.push("At least one location (source or destination) must be specified");
    }
  }

  /**
   * Validate date
   * @private
   */
  private static validateDate(date: string, errors: string[], warnings: string[]): void {
    const occurredDate = new Date(date);
    const now = new Date();

    if (isNaN(occurredDate.getTime())) {
      errors.push("Invalid date format");
      return;
    }

    // Warn if future date
    if (occurredDate > now) {
      warnings.push("Movement date is in the future");
    }

    // Warn if very old date (more than 1 year ago)
    const oneYearAgo = new Date();
    oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);

    if (occurredDate < oneYearAgo) {
      warnings.push("Movement date is more than 1 year old");
    }
  }

  /**
   * Validate tracking fields
   * @private
   */
  private static validateTrackingFields(data: CreateStockMovementInput, warnings: string[]): void {
    // Check expiry date
    if (data.expiry_date) {
      const expiryDate = new Date(data.expiry_date);
      const now = new Date();

      if (expiryDate < now) {
        warnings.push("Product has expired");
      }

      // Warn if expiring soon (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(
        thirtyDaysFromNow.getDate() + MOVEMENT_VALIDATION.EXPIRY_WARNING_DAYS
      );

      if (expiryDate < thirtyDaysFromNow && expiryDate > now) {
        warnings.push("Product expires within 30 days");
      }
    }

    // Check manufacturing date
    if (data.manufacturing_date) {
      const mfgDate = new Date(data.manufacturing_date);
      const now = new Date();

      if (mfgDate > now) {
        warnings.push("Manufacturing date is in the future");
      }
    }

    // Check manufacturing date vs expiry date
    if (data.manufacturing_date && data.expiry_date) {
      const mfgDate = new Date(data.manufacturing_date);
      const expDate = new Date(data.expiry_date);

      if (mfgDate >= expDate) {
        warnings.push("Manufacturing date should be before expiry date");
      }
    }
  }

  /**
   * Create validation result object
   * @private
   */
  private static createResult(
    isValid: boolean,
    errors: string[],
    warnings: string[],
    requiredFields?: MovementValidationResult["requiredFields"],
    stockCheck?: MovementValidationResult["stockCheck"]
  ): MovementValidationResult {
    return {
      isValid,
      errors,
      warnings,
      requiredFields: requiredFields || {
        sourceLocation: false,
        destinationLocation: false,
        reference: false,
        approval: false,
      },
      stockCheck,
    };
  }
}
