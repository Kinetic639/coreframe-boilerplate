import { useMutation } from "@tanstack/react-query";
import {
  validateMovement,
  validateBatch,
  quickValidate,
} from "@/app/[locale]/dashboard/warehouse/movements/validation/_actions";
import type { CreateStockMovementInput } from "@/server/schemas/stock-movements.schema";

/**
 * Hook to validate single movement
 */
export function useValidateMovement() {
  return useMutation({
    mutationFn: async (input: CreateStockMovementInput) => {
      return await validateMovement(input);
    },
  });
}

/**
 * Hook to validate batch of movements
 */
export function useValidateBatch() {
  return useMutation({
    mutationFn: async (movements: CreateStockMovementInput[]) => {
      return await validateBatch({ movements });
    },
  });
}

/**
 * Hook to quick validate movement (without stock checks)
 */
export function useQuickValidate() {
  return useMutation({
    mutationFn: async (input: CreateStockMovementInput) => {
      return await quickValidate(input);
    },
  });
}
