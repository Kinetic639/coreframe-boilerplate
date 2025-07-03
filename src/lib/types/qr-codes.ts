export type EntityType = "location"; // Future: "product", "order", etc.

export interface QrCode {
  id: string; // UUID
  qr_token: string; // Public token in QR code (e.g., 'abc123xyz')
  entity_type: EntityType;
  entity_id: string | null; // ID of the resource (e.g., location_id)
  created_by: string; // User ID who created the token
  created_at: string;
  assigned_at?: string; // When it was assigned to a resource
  deleted_at?: string;
}

export interface QrScan {
  id: string;
  qr_token: string;
  user_id: string;
  scanned_at: string;
  ip_address?: string;
  user_agent?: string;
}

export interface QrCodeWithDetails extends QrCode {
  location?: {
    id: string;
    name: string;
    code?: string;
    branch_name: string;
    organization_name: string;
  };
  created_by_user?: {
    id: string;
    first_name: string;
    last_name: string;
    email: string;
  };
}
