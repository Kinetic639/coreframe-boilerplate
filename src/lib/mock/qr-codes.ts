// Mock QR codes data for development

export const mockQrCodes = [];

export function getQrCodeWithDetails(_qrId: string) {
  return null;
}

export function canUserAssignQrCodes(_userId: string) {
  return true;
}

export function assignQrCodeToLocation(_qrId: string, _locationId: string) {
  return Promise.resolve(true);
}
