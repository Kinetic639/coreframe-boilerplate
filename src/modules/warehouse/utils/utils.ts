import {
  getQrCodeWithDetails,
  canUserAssignQrCodes,
  assignQrCodeToLocation,
} from "@/lib/mock/qr-codes";
import { branchLocationsMap } from "@/lib/mock/branches";

export interface QrResolutionResult {
  success: boolean;
  action: "redirect" | "assign" | "error" | "unauthorized";
  redirectUrl?: string;
  qrCode?: any;
  availableLocations?: any[];
  message?: string;
}

export async function resolveQrCode(qrToken: string): Promise<QrResolutionResult> {
  // Get QR code with details
  const qrCodeWithDetails = getQrCodeWithDetails(qrToken);

  if (!qrCodeWithDetails) {
    return {
      success: false,
      action: "error",
      message: "Nieprawidłowy kod QR. Token nie został znaleziony w systemie.",
    };
  }

  // If QR code is assigned to a location
  if (qrCodeWithDetails.entity_id && qrCodeWithDetails.location) {
    // Check if user has access to this location
    // In real app, this would check RBAC permissions
    const hasAccess = true; // Mock - assume user has access

    if (!hasAccess) {
      return {
        success: false,
        action: "unauthorized",
        message: "Brak uprawnień do tej lokalizacji lub lokalizacja została usunięta.",
      };
    }

    return {
      success: true,
      action: "redirect",
      redirectUrl: `/dashboard/warehouse/locations/${qrCodeWithDetails.entity_id}`,
      qrCode: qrCodeWithDetails,
    };
  }

  // QR code is not assigned to any location
  if (!canUserAssignQrCodes()) {
    return {
      success: false,
      action: "unauthorized",
      message: "Kod QR nie został jeszcze przypisany, a Ty nie masz uprawnień do przypisywania.",
    };
  }

  // User can assign - get available locations
  const availableLocations = Object.values(branchLocationsMap)
    .flat()
    .map((location) => ({
      id: location.id,
      name: location.name,
      code: location.code,
      branch_id: location.branch_id,
    }));

  return {
    success: true,
    action: "assign",
    qrCode: qrCodeWithDetails,
    availableLocations,
    message: "Kod QR nie jest przypisany do żadnej lokalizacji. Możesz go przypisać poniżej.",
  };
}

export function assignQrToLocation(qrToken: string, locationId: string): boolean {
  return assignQrCodeToLocation(qrToken, locationId);
}

export function getQrCodeUrl(qrToken: string): string {
  // In production, this would be your actual domain
  const baseUrl =
    typeof window !== "undefined" ? window.location.origin : "https://app.twoja-domena.pl";
  return `${baseUrl}/qr/${qrToken}`;
}

export function generateQrCodeData(qrToken: string): string {
  return getQrCodeUrl(qrToken);
}
