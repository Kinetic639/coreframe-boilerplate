// =============================================
// Movement Validation Service
// Phase 2: Stock Movement Validation
// Validates movement data before creation/update
// =============================================

import { movementTypesService } from "./movement-types-service";
import { stockMovementsService } from "./stock-movements-service";
import type { CreateStockMovementData, MovementValidationResult } from "../types/stock-movements";
import type { MovementType } from "../types/movement-types";

/**
 * Service for validating stock movements
 * Implements comprehensive business rule validation
 */
export class MovementValidationService {
  /**
   * Validate movement data before creation
   * Performs all necessary checks in a single pass for performance
   */
  async validateMovement(data: CreateStockMovementData): Promise<MovementValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Fetch movement type (single query)
    let movementType: MovementType | null = null;
    try {
      movementType = await movementTypesService.getMovementTypeByCode(data.movement_type_code);

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
    if (data.unit_cost !== undefined) {
      this.validateCost(data.unit_cost, errors);
    }

    // Location validation
    this.validateLocations(data, movementType, errors);

    // Stock availability check (for issue movements)
    let stockCheck;
    if (movementType.category === "issue" && data.source_location_id && data.product_id) {
      try {
        const available = await stockMovementsService.getStockLevel(
          data.product_id,
          data.variant_id,
          data.source_location_id,
          data.organization_id,
          data.branch_id
        );

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
   * Validate required fields based on movement type
   */
  private validateRequiredFields(
    data: CreateStockMovementData,
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
   */
  private validateQuantity(quantity: number, errors: string[], warnings: string[]): void {
    const MAX = 999999.9999; // MOVEMENT_VALIDATION.MAX_QUANTITY
    const MIN = 0.0001; // MOVEMENT_VALIDATION.MIN_QUANTITY

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

    if (quantity < MIN) {
      errors.push(`Quantity must be at least ${MIN}`);
    }

    if (quantity > MAX) {
      errors.push(`Quantity cannot exceed ${MAX}`);
    }

    // Warning for very large quantities
    if (quantity > 10000) {
      warnings.push("Large quantity detected. Please verify.");
    }

    // Warning for very small quantities
    if (quantity < 1 && quantity >= MIN) {
      warnings.push("Small quantity detected. Please verify decimal point.");
    }
  }

  /**
   * Validate cost
   */
  private validateCost(cost: number, errors: string[]): void {
    const MAX = 9999999999.99; // MOVEMENT_VALIDATION.MAX_COST

    if (cost < 0) {
      errors.push("Cost cannot be negative");
    }

    if (cost > MAX) {
      errors.push(`Cost cannot exceed ${MAX}`);
    }

    if (isNaN(cost)) {
      errors.push("Cost must be a valid number");
    }
  }

  /**
   * Validate locations
   */
  private validateLocations(
    data: CreateStockMovementData,
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
   */
  private validateDate(date: string, errors: string[], warnings: string[]): void {
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
   */
  private validateTrackingFields(data: CreateStockMovementData, warnings: string[]): void {
    // Check expiry date
    if (data.expiry_date) {
      const expiryDate = new Date(data.expiry_date);
      const now = new Date();

      if (expiryDate < now) {
        warnings.push("Product has expired");
      }

      // Warn if expiring soon (within 30 days)
      const thirtyDaysFromNow = new Date();
      thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

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
   * Batch validation for multiple movements
   */
  async validateBatch(movements: CreateStockMovementData[]): Promise<MovementValidationResult[]> {
    const validations = await Promise.all(
      movements.map((movement) => this.validateMovement(movement))
    );

    return validations;
  }

  /**
   * Quick validation (without stock checks)
   * Useful for form validation before submission
   */
  async quickValidate(data: CreateStockMovementData): Promise<MovementValidationResult> {
    const errors: string[] = [];
    const warnings: string[] = [];

    // Basic field validation only
    if (!data.movement_type_code) {
      errors.push("Movement type is required");
    }

    if (!data.product_id) {
      errors.push("Product is required");
    }

    if (!data.organization_id) {
      errors.push("Organization is required");
    }

    if (!data.branch_id) {
      errors.push("Branch is required");
    }

    this.validateQuantity(data.quantity, errors, warnings);

    if (data.unit_cost !== undefined) {
      this.validateCost(data.unit_cost, errors);
    }

    return this.createResult(errors.length === 0, errors, warnings);
  }

  /**
   * Create validation result object
   * @private
   */
  private createResult(
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

// Export singleton instance
export const movementValidationService = new MovementValidationService();
