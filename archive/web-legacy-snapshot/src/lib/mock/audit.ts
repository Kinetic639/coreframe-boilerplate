// Mock audit data for development

export const mockAudits = [];
export const mockAuditSchedules = [];
export const mockAuditItems = [];

export function getAuditsByBranch(_branchId?: string) {
  return mockAudits;
}

export function getAuditSchedulesByBranch() {
  return mockAuditSchedules;
}

export function getAuditItemsByAuditId(_auditId: string) {
  return mockAuditItems;
}

export function getProductsForLocations(_locationIds: string[], _branchId: string) {
  return [];
}

export function calculateAuditStats(_locationIds: string[], _branchId: string) {
  return {
    totalLocations: 0,
    totalProducts: 0,
    estimatedDuration: 0,
  };
}
