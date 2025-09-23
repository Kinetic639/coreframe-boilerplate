// Mock products extended data for development

export interface ProductWithDetails {
  id: string;
  name: string;
  variants: any[];
  suppliers: any[];
}

export const mockProductsExtended = [];

export function getProductsWithStockByBranch(_branchId: string) {
  return mockProductsExtended;
}
