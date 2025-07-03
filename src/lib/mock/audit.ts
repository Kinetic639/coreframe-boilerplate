import { AuditSchedule, Audit, AuditItem } from "@/lib/types/audit";
import { getCurrentUser } from "./organization";
import { mockProducts, getInventoryDataByProductId } from "./products";
import { branchLocationsMap } from "./branches";

const currentUser = getCurrentUser();

// Mock audit schedules
export const mockAuditSchedules: AuditSchedule[] = [
  {
    id: "schedule-001",
    name: "Audyt tygodniowy - Sekcja A",
    frequency: "weekly",
    location_ids: ["war-2", "war-5", "war-6"],
    start_date: "2024-01-01T00:00:00.000Z",
    next_audit_date: "2024-01-22T09:00:00.000Z",
    is_active: true,
    created_by: currentUser.id,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-15T00:00:00.000Z",
  },
  {
    id: "schedule-002",
    name: "Audyt miesięczny - Cały magazyn główny",
    frequency: "monthly",
    location_ids: ["war-1"],
    start_date: "2024-01-01T00:00:00.000Z",
    next_audit_date: "2024-02-01T08:00:00.000Z",
    is_active: true,
    created_by: currentUser.id,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-01T00:00:00.000Z",
  },
  {
    id: "schedule-003",
    name: "Audyt kwartalny - Narzędzia",
    frequency: "quarterly",
    location_ids: ["war-3", "war-8"],
    start_date: "2024-01-01T00:00:00.000Z",
    next_audit_date: "2024-04-01T10:00:00.000Z",
    is_active: false,
    created_by: currentUser.id,
    created_at: "2024-01-01T00:00:00.000Z",
    updated_at: "2024-01-10T00:00:00.000Z",
  },
];

// Mock completed audits
export const mockAudits: Audit[] = [
  {
    id: "audit-001",
    schedule_id: "schedule-001",
    name: "Audyt tygodniowy - Sekcja A (15.01.2024)",
    location_ids: ["war-2", "war-5", "war-6"],
    status: "completed",
    started_at: "2024-01-15T09:00:00.000Z",
    completed_at: "2024-01-15T11:30:00.000Z",
    conducted_by: currentUser.id,
    total_products: 45,
    checked_products: 45,
    corrections_count: 8,
    total_value_change: -234.5,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    created_at: "2024-01-15T09:00:00.000Z",
    updated_at: "2024-01-15T11:30:00.000Z",
  },
  {
    id: "audit-002",
    name: "Audyt doraźny - Regał A1",
    location_ids: ["war-5"],
    status: "completed",
    started_at: "2024-01-12T14:00:00.000Z",
    completed_at: "2024-01-12T15:15:00.000Z",
    conducted_by: currentUser.id,
    total_products: 15,
    checked_products: 15,
    corrections_count: 3,
    total_value_change: 89.25,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    created_at: "2024-01-12T14:00:00.000Z",
    updated_at: "2024-01-12T15:15:00.000Z",
  },
  {
    id: "audit-003",
    schedule_id: "schedule-002",
    name: "Audyt miesięczny - Cały magazyn główny (01.01.2024)",
    location_ids: ["war-1"],
    status: "completed",
    started_at: "2024-01-01T08:00:00.000Z",
    completed_at: "2024-01-01T16:45:00.000Z",
    conducted_by: currentUser.id,
    total_products: 156,
    checked_products: 156,
    corrections_count: 23,
    total_value_change: -1245.75,
    branch_id: "550e8400-e29b-41d4-a716-446655440001",
    created_at: "2024-01-01T08:00:00.000Z",
    updated_at: "2024-01-01T16:45:00.000Z",
  },
];

// Mock audit items for completed audits
export const mockAuditItems: AuditItem[] = [
  {
    id: "item-001",
    audit_id: "audit-001",
    product_id: "prod-001",
    location_id: "war-5",
    system_quantity: 25,
    physical_quantity: 23,
    difference: -2,
    unit_price: 45.5,
    value_change: -91.0,
    notes: "Brak 2 litrów - prawdopodobnie uszkodzone opakowanie",
    checked_at: "2024-01-15T09:15:00.000Z",
  },
  {
    id: "item-002",
    audit_id: "audit-001",
    product_id: "prod-003",
    location_id: "war-6",
    system_quantity: 12,
    physical_quantity: 15,
    difference: 3,
    unit_price: 52.3,
    value_change: 156.9,
    notes: "Znaleziono dodatkowe 3 litry na tylnej półce",
    checked_at: "2024-01-15T09:45:00.000Z",
  },
  {
    id: "item-003",
    audit_id: "audit-002",
    product_id: "prod-002",
    location_id: "war-5",
    system_quantity: 8,
    physical_quantity: 10,
    difference: 2,
    unit_price: 38.9,
    value_change: 77.8,
    checked_at: "2024-01-12T14:30:00.000Z",
  },
];

// Helper functions
export function getAuditSchedulesByBranch(branchId: string): AuditSchedule[] {
  console.log(branchId);

  return mockAuditSchedules;
}

export function getAuditsByBranch(branchId: string): Audit[] {
  return mockAudits.filter((audit) => audit.branch_id === branchId);
}

export function getAuditItemsByAuditId(auditId: string): AuditItem[] {
  return mockAuditItems.filter((item) => item.audit_id === auditId);
}

export function getProductsForLocations(locationIds: string[], branchId: string) {
  const branchLocationIds = branchLocationsMap[branchId]?.map((loc) => loc.id) || [];

  // Get all descendant location IDs
  const getAllDescendantIds = (parentIds: string[]): string[] => {
    const allIds = [...parentIds];
    const locations = branchLocationsMap[branchId] || [];

    for (const parentId of parentIds) {
      const children = locations.filter((loc) => loc.parent_id === parentId);
      if (children.length > 0) {
        const childIds = children.map((child) => child.id);
        allIds.push(...childIds);
        allIds.push(...getAllDescendantIds(childIds));
      }
    }

    return [...new Set(allIds)];
  };

  const allLocationIds = getAllDescendantIds(locationIds);
  const validLocationIds = allLocationIds.filter((id) => branchLocationIds.includes(id));

  // Mock products in these locations
  const productsInLocations = mockProducts.slice(
    0,
    Math.min(mockProducts.length, validLocationIds.length * 8)
  );

  return productsInLocations.map((product) => {
    const inventory = getInventoryDataByProductId(product.id);
    const locationId = validLocationIds[Math.floor(Math.random() * validLocationIds.length)];
    const quantity = Math.floor(Math.random() * 50) + 1;

    return {
      ...product,
      location_id: locationId,
      system_quantity: quantity,
      unit_price: inventory?.purchase_price || 0,
    };
  });
}

export function calculateAuditStats(locationIds: string[], branchId: string) {
  const products = getProductsForLocations(locationIds, branchId);
  const locations =
    branchLocationsMap[branchId]?.filter((loc) =>
      locationIds.some((id) => id === loc.id || loc.parent_id === id)
    ) || [];

  return {
    totalLocations: locations.length,
    totalProducts: products.length,
    estimatedDuration: Math.ceil(products.length * 2), // 2 minutes per product
  };
}
