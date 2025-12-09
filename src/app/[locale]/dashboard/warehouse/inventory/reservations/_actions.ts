"use server";

import {
  createReservationSchema,
  releaseReservationSchema,
  cancelReservationSchema,
  reservationFiltersSchema,
  type CreateReservationInput,
  type ReleaseReservationInput,
  type CancelReservationInput,
  type ReservationFiltersInput,
} from "@/server/schemas/reservations.schema";
import { getUserContext } from "@/lib/utils/assert-auth";

// ==========================================
// RESERVATIONS SERVER ACTIONS
// ==========================================

/**
 * Validate stock availability for reservation
 */
export async function validateAvailabilityAction(
  productId: string,
  variantId: string | undefined,
  locationId: string,
  requestedQuantity: number
) {
  try {
    const { user, supabase } = await getUserContext();

    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId || !branchId) {
      return {
        success: false,
        error: "Organization or branch ID not found in user context",
      };
    }

    const validation = await ReservationsService.validateAvailability(
      supabase,
      organizationId,
      branchId,
      productId,
      variantId,
      locationId,
      requestedQuantity
    );

    return {
      success: true,
      data: validation,
    };
  } catch (error) {
    console.error("Error validating availability:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to validate availability",
    };
  }
}

/**
 * Create a new reservation
 */
export async function createReservationAction(input: CreateReservationInput) {
  try {
    const { user, supabase } = await getUserContext();

    // Validate input
    const validatedData = createReservationSchema.parse(input);

    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId || !branchId) {
      return {
        success: false,
        error: "Organization or branch ID not found in user context",
      };
    }

    const reservation = await ReservationsService.createReservation(supabase, validatedData, {
      organizationId,
      branchId,
      userId: user.id,
    });

    return {
      success: true,
      data: reservation,
    };
  } catch (error) {
    console.error("Error creating reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to create reservation",
    };
  }
}

/**
 * Release (fulfill) a reservation
 */
export async function releaseReservationAction(input: ReleaseReservationInput) {
  try {
    const { user, supabase } = await getUserContext();

    // Validate input
    const validatedData = releaseReservationSchema.parse(input);

    const reservation = await ReservationsService.releaseReservation(
      supabase,
      validatedData,
      user.id
    );

    return {
      success: true,
      data: reservation,
    };
  } catch (error) {
    console.error("Error releasing reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to release reservation",
    };
  }
}

/**
 * Cancel a reservation
 */
export async function cancelReservationAction(input: CancelReservationInput) {
  try {
    const { user, supabase } = await getUserContext();

    // Validate input
    const validatedData = cancelReservationSchema.parse(input);

    const reservation = await ReservationsService.cancelReservation(
      supabase,
      validatedData,
      user.id
    );

    return {
      success: true,
      data: reservation,
    };
  } catch (error) {
    console.error("Error cancelling reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to cancel reservation",
    };
  }
}

/**
 * Get reservation by ID
 */
export async function getReservationAction(id: string) {
  try {
    const { supabase } = await getUserContext();

    const reservation = await ReservationsService.getReservation(supabase, id);

    return {
      success: true,
      data: reservation,
    };
  } catch (error) {
    console.error("Error fetching reservation:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reservation",
    };
  }
}

/**
 * Get reservation with details
 */
export async function getReservationWithDetailsAction(id: string) {
  try {
    const { supabase } = await getUserContext();

    const reservation = await ReservationsService.getReservationWithDetails(supabase, id);

    return {
      success: true,
      data: reservation,
    };
  } catch (error) {
    console.error("Error fetching reservation details:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reservation details",
    };
  }
}

/**
 * Get reservations with filters
 */
export async function getReservationsAction(filters: ReservationFiltersInput) {
  try {
    const { user, supabase } = await getUserContext();

    // Validate filters
    const validatedFilters = reservationFiltersSchema.parse(filters);

    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID not found in user context",
      };
    }

    const reservations = await ReservationsService.getReservations(
      supabase,
      validatedFilters,
      organizationId,
      branchId
    );

    return {
      success: true,
      data: reservations,
    };
  } catch (error) {
    console.error("Error fetching reservations:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch reservations",
    };
  }
}

/**
 * Get expired reservations
 */
export async function getExpiredReservationsAction() {
  try {
    const { user, supabase } = await getUserContext();

    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId) {
      return {
        success: false,
        error: "Organization ID not found in user context",
      };
    }

    const reservations = await ReservationsService.getExpiredReservations(
      supabase,
      organizationId,
      branchId
    );

    return {
      success: true,
      data: reservations,
    };
  } catch (error) {
    console.error("Error fetching expired reservations:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch expired reservations",
    };
  }
}

/**
 * Get available inventory
 */
export async function getAvailableInventoryAction(
  productId: string,
  variantId: string | undefined,
  locationId: string
) {
  try {
    const { user, supabase } = await getUserContext();

    const organizationId = user.user_metadata?.active_org_id;
    const branchId = user.user_metadata?.active_branch_id;

    if (!organizationId || !branchId) {
      return {
        success: false,
        error: "Organization or branch ID not found in user context",
      };
    }

    const inventory = await ReservationsService.getAvailableInventory(
      supabase,
      organizationId,
      branchId,
      productId,
      variantId,
      locationId
    );

    return {
      success: true,
      data: inventory,
    };
  } catch (error) {
    console.error("Error fetching available inventory:", error);
    return {
      success: false,
      error: error instanceof Error ? error.message : "Failed to fetch available inventory",
    };
  }
}
