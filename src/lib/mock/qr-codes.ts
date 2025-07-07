import { QrCode, QrScan, QrCodeWithDetails } from "@/lib/types/qr-codes";
import { getCurrentUser, mockUsers } from "./organization";
import { mockBranches, branchLocationsMap } from "./branches";

const currentUser = getCurrentUser();

// Mock QR codes - some assigned, some unassigned
export const mockQrCodes: QrCode[] = [
  // Assigned QR codes
  {
    id: "qr-001",
    qr_token: "WAR-MG-QR001",
    entity_type: "location",
    entity_id: "war-1", // Magazyn Główny Warszawa
    created_by: currentUser.id,
    created_at: "2024-01-10T09:00:00.000Z",
    assigned_at: "2024-01-10T09:15:00.000Z",
  },
  {
    id: "qr-002",
    qr_token: "WAR-A-QR002",
    entity_type: "location",
    entity_id: "war-2", // Sekcja A - Lakiery i Farby
    created_by: currentUser.id,
    created_at: "2024-01-10T09:30:00.000Z",
    assigned_at: "2024-01-10T09:45:00.000Z",
  },
  {
    id: "qr-003",
    qr_token: "KRA-CD-QR003",
    entity_type: "location",
    entity_id: "kra-1", // Centrum Dystrybucyjne Kraków
    created_by: mockUsers[1].id, // Anna Nowak
    created_at: "2024-01-12T14:00:00.000Z",
    assigned_at: "2024-01-12T14:30:00.000Z",
  },
  {
    id: "qr-004",
    qr_token: "GDA-TP-QR004",
    entity_type: "location",
    entity_id: "gda-1", // Terminal Portowy Gdańsk
    created_by: mockUsers[2].id, // Piotr Wiśniewski
    created_at: "2024-01-15T11:00:00.000Z",
    assigned_at: "2024-01-15T11:20:00.000Z",
  },
  {
    id: "qr-005",
    qr_token: "WRO-MA-QR005",
    entity_type: "location",
    entity_id: "wro-1", // Magazyn Automatyczny Wrocław
    created_by: mockUsers[3].id, // Maria Wójcik
    created_at: "2024-01-18T16:00:00.000Z",
    assigned_at: "2024-01-18T16:15:00.000Z",
  },

  // Unassigned QR codes (ready to be assigned)
  {
    id: "qr-006",
    qr_token: "QR-UNASSIGNED-001",
    entity_type: "location",
    entity_id: null,
    created_by: currentUser.id,
    created_at: "2024-01-20T10:00:00.000Z",
  },
  {
    id: "qr-007",
    qr_token: "QR-UNASSIGNED-002",
    entity_type: "location",
    entity_id: null,
    created_by: currentUser.id,
    created_at: "2024-01-20T10:05:00.000Z",
  },
  {
    id: "qr-008",
    qr_token: "QR-UNASSIGNED-003",
    entity_type: "location",
    entity_id: null,
    created_by: mockUsers[1].id, // Anna Nowak
    created_at: "2024-01-21T09:00:00.000Z",
  },
  {
    id: "qr-009",
    qr_token: "QR-UNASSIGNED-004",
    entity_type: "location",
    entity_id: null,
    created_by: mockUsers[2].id, // Piotr Wiśniewski
    created_at: "2024-01-21T09:30:00.000Z",
  },
  {
    id: "qr-010",
    qr_token: "QR-UNASSIGNED-005",
    entity_type: "location",
    entity_id: null,
    created_by: mockUsers[3].id, // Maria Wójcik
    created_at: "2024-01-21T10:00:00.000Z",
  },
];

// Mock QR scan history
export const mockQrScans: QrScan[] = [
  {
    id: "scan-001",
    qr_token: "WAR-MG-QR001",
    user_id: currentUser.id,
    scanned_at: "2024-01-22T09:15:00.000Z",
    ip_address: "192.168.1.100",
    user_agent: "Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X)",
  },
  {
    id: "scan-002",
    qr_token: "WAR-A-QR002",
    user_id: mockUsers[4].id, // Tomasz Kamiński
    scanned_at: "2024-01-22T10:30:00.000Z",
    ip_address: "192.168.1.101",
    user_agent: "Mozilla/5.0 (Android 14; Mobile)",
  },
  {
    id: "scan-003",
    qr_token: "KRA-CD-QR003",
    user_id: mockUsers[1].id, // Anna Nowak
    scanned_at: "2024-01-22T14:45:00.000Z",
    ip_address: "192.168.2.50",
    user_agent: "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
  },
];

// Helper functions
export function getQrCodeByToken(qrToken: string): QrCode | undefined {
  return mockQrCodes.find((qr) => qr.qr_token === qrToken);
}

export function getQrCodeWithDetails(qrToken: string): QrCodeWithDetails | undefined {
  const qrCode = getQrCodeByToken(qrToken);
  if (!qrCode) return undefined;

  let location = undefined;
  if (qrCode.entity_id) {
    // Find location across all branches
    for (const [branchId, locations] of Object.entries(branchLocationsMap)) {
      const foundLocation = locations.find((loc) => loc.id === qrCode.entity_id);
      if (foundLocation) {
        const branch = mockBranches.find((b) => b.id === branchId);
        location = {
          id: foundLocation.id,
          name: foundLocation.name,
          code: foundLocation.code || undefined,
          branch_name: branch?.name || "Unknown Branch",
          organization_name: "GCZ - Grupa Cichy-Zasada",
        };
        break;
      }
    }
  }

  const createdByUser = mockUsers.find((user) => user.id === qrCode.created_by);

  return {
    ...qrCode,
    location,
    created_by_user: createdByUser
      ? {
          id: createdByUser.id,
          first_name: createdByUser.first_name || "",
          last_name: createdByUser.last_name || "",
          email: createdByUser.email,
        }
      : undefined,
  };
}

export function getAllQrCodes(): QrCode[] {
  return mockQrCodes;
}

export function getQrCodesByEntityType(entityType: string): QrCode[] {
  return mockQrCodes.filter((qr) => qr.entity_type === entityType);
}

export function getUnassignedQrCodes(): QrCode[] {
  return mockQrCodes.filter((qr) => qr.entity_id === null);
}

export function getAssignedQrCodes(): QrCode[] {
  return mockQrCodes.filter((qr) => qr.entity_id !== null);
}

export function getQrScansByToken(qrToken: string): QrScan[] {
  return mockQrScans.filter((scan) => scan.qr_token === qrToken);
}

export function addQrCode(qrCode: Omit<QrCode, "id" | "created_at">): QrCode {
  const newQrCode: QrCode = {
    ...qrCode,
    id: `qr-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
    created_at: new Date().toISOString(),
  };

  mockQrCodes.push(newQrCode);
  return newQrCode;
}

export function assignQrCodeToLocation(qrToken: string, locationId: string): boolean {
  const qrCode = mockQrCodes.find((qr) => qr.qr_token === qrToken);
  if (!qrCode) return false;

  qrCode.entity_id = locationId;
  qrCode.assigned_at = new Date().toISOString();
  return true;
}

export function generateQrToken(): string {
  const timestamp = Date.now().toString(36);
  const random = Math.random().toString(36).substr(2, 6);
  return `QR-${timestamp}-${random}`.toUpperCase();
}

// Mock permissions - in real app this would come from RBAC
export function canUserManageQrCodes(): boolean {
  // For demo purposes, allow all users to manage QR codes
  // In real app, check user roles and permissions
  return true;
}

export function canUserAssignQrCodes(): boolean {
  // For demo purposes, allow all users to assign QR codes
  // In real app, check specific permissions like 'manage:locations'
  return true;
}
