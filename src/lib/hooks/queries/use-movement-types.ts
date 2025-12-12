import { useQuery, useMutation } from "@tanstack/react-query";
import {
  getMovementTypes,
  getMovementTypesByCategory,
  getMovementTypeByCode,
  getManualEntryTypes,
  getDocumentGeneratingTypes,
  getMovementTypesGroupedByCategory,
  getMovementTypeSummaries,
  validateMovementRequirements,
  requiresApproval,
  generatesDocument,
  getPolishDocumentType,
  searchMovementTypes,
  getReceiptTypes,
  getIssueTypes,
  getTransferTypes,
  getAdjustmentTypes,
  getReservationTypes,
  getEcommerceTypes,
  getStatistics,
} from "@/app/[locale]/dashboard/warehouse/movement-types/_actions";
import type {
  MovementTypeFilters,
  PolishDocumentType,
  MovementCategory,
  MovementValidationInput,
} from "@/server/schemas/movement-types.schema";

/**
 * Hook to fetch all movement types
 */
export function useMovementTypes(filters?: MovementTypeFilters) {
  return useQuery({
    queryKey: ["movement-types", filters],
    queryFn: async () => {
      return await getMovementTypes(filters);
    },
    staleTime: 30 * 60 * 1000, // 30 minutes (system data, rarely changes)
  });
}

/**
 * Hook to fetch movement types by category
 */
export function useMovementTypesByCategory(category: MovementCategory) {
  return useQuery({
    queryKey: ["movement-types-by-category", category],
    queryFn: async () => {
      return await getMovementTypesByCategory(category);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch single movement type by code
 */
export function useMovementTypeByCode(code: string | null) {
  return useQuery({
    queryKey: ["movement-type", code],
    queryFn: async () => {
      if (!code) return null;
      return await getMovementTypeByCode(code);
    },
    enabled: !!code,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch manual entry types
 */
export function useManualEntryTypes() {
  return useQuery({
    queryKey: ["movement-types-manual-entry"],
    queryFn: async () => {
      return await getManualEntryTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch document generating types
 */
export function useDocumentGeneratingTypes(documentType?: PolishDocumentType) {
  return useQuery({
    queryKey: ["movement-types-document-generating", documentType],
    queryFn: async () => {
      return await getDocumentGeneratingTypes(documentType);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch movement types grouped by category
 */
export function useMovementTypesGroupedByCategory() {
  return useQuery({
    queryKey: ["movement-types-grouped"],
    queryFn: async () => {
      return await getMovementTypesGroupedByCategory();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch movement type summaries
 */
export function useMovementTypeSummaries(
  locale: "pl" | "en" = "en",
  filters?: MovementTypeFilters
) {
  return useQuery({
    queryKey: ["movement-type-summaries", locale, filters],
    queryFn: async () => {
      return await getMovementTypeSummaries(locale, filters);
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to validate movement requirements
 */
export function useValidateMovementRequirements() {
  return useMutation({
    mutationFn: async (input: MovementValidationInput) => {
      return await validateMovementRequirements(input);
    },
  });
}

/**
 * Hook to check if movement type requires approval
 */
export function useRequiresApproval(code: string | null) {
  return useQuery({
    queryKey: ["movement-type-requires-approval", code],
    queryFn: async () => {
      if (!code) return false;
      return await requiresApproval(code);
    },
    enabled: !!code,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to check if movement type generates document
 */
export function useGeneratesDocument(code: string | null) {
  return useQuery({
    queryKey: ["movement-type-generates-document", code],
    queryFn: async () => {
      if (!code) return false;
      return await generatesDocument(code);
    },
    enabled: !!code,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to get Polish document type
 */
export function usePolishDocumentType(code: string | null) {
  return useQuery({
    queryKey: ["movement-type-polish-document", code],
    queryFn: async () => {
      if (!code) return null;
      return await getPolishDocumentType(code);
    },
    enabled: !!code,
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to search movement types
 */
export function useSearchMovementTypes(searchTerm: string) {
  return useQuery({
    queryKey: ["movement-types-search", searchTerm],
    queryFn: async () => {
      return await searchMovementTypes(searchTerm);
    },
    enabled: searchTerm.length >= 2,
    staleTime: 10 * 60 * 1000, // Shorter stale time for search results
  });
}

/**
 * Hook to fetch receipt types
 */
export function useReceiptTypes() {
  return useQuery({
    queryKey: ["movement-types-receipt"],
    queryFn: async () => {
      return await getReceiptTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch issue types
 */
export function useIssueTypes() {
  return useQuery({
    queryKey: ["movement-types-issue"],
    queryFn: async () => {
      return await getIssueTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch transfer types
 */
export function useTransferTypes() {
  return useQuery({
    queryKey: ["movement-types-transfer"],
    queryFn: async () => {
      return await getTransferTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch adjustment types
 */
export function useAdjustmentTypes() {
  return useQuery({
    queryKey: ["movement-types-adjustment"],
    queryFn: async () => {
      return await getAdjustmentTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch reservation types
 */
export function useReservationTypes() {
  return useQuery({
    queryKey: ["movement-types-reservation"],
    queryFn: async () => {
      return await getReservationTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch e-commerce types
 */
export function useEcommerceTypes() {
  return useQuery({
    queryKey: ["movement-types-ecommerce"],
    queryFn: async () => {
      return await getEcommerceTypes();
    },
    staleTime: 30 * 60 * 1000,
  });
}

/**
 * Hook to fetch movement type statistics
 */
export function useStatistics() {
  return useQuery({
    queryKey: ["movement-types-statistics"],
    queryFn: async () => {
      return await getStatistics();
    },
    staleTime: 30 * 60 * 1000,
  });
}
