// =============================================
// Transfer Request Types & Interfaces
// Complete type definitions for warehouse transfers
// =============================================

export type TransferStatus =
  | "draft"
  | "pending"
  | "approved"
  | "in_transit"
  | "completed"
  | "cancelled"
  | "rejected";

export type TransferPriority = "normal" | "high" | "urgent";

export type TransferItemStatus = "pending" | "in_transit" | "completed";

export interface TransferRequest {
  id: string;
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  transfer_number: string;
  status: TransferStatus;
  priority: TransferPriority;
  expected_date: string | null;
  requires_confirmation: boolean;

  // Users
  requested_by: string | null;
  reviewed_by: string | null;
  approved_by: string | null;
  shipped_by: string | null;
  received_by: string | null;

  // Timestamps
  created_at: string;
  reviewed_at: string | null;
  approved_at: string | null;
  shipped_at: string | null;
  received_at: string | null;

  // Shipping info
  shipping_method: string | null;
  carrier: string | null;
  tracking_number: string | null;

  // Notes
  comment: string | null;
  notes: string | null;
  metadata: Record<string, any>;
}

export interface TransferRequestItem {
  id: string;
  transfer_request_id: string;
  product_id: string;
  variant_id: string | null;
  quantity: number;
  received_quantity: number;
  from_location_id: string | null;
  to_location_id: string | null;
  item_status: TransferItemStatus;
  comment: string | null;
  item_notes: string | null;
  created_at: string;

  // Legacy fields (for compatibility)
  product_variant_id?: string;
  unit_id?: string;
}

export interface TransferRequestWithDetails extends TransferRequest {
  items: TransferRequestItemWithDetails[];
  from_branch?: {
    id: string;
    name: string;
  };
  to_branch?: {
    id: string;
    name: string;
  };
  requested_by_user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
  approved_by_user?: {
    id: string;
    email: string;
    full_name: string | null;
  };
}

export interface TransferRequestItemWithDetails extends TransferRequestItem {
  product: {
    id: string;
    name: string;
    sku: string | null;
    unit: string;
    track_inventory: boolean;
  };
  variant?: {
    id: string;
    name: string;
    sku: string | null;
  } | null;
  from_location?: {
    id: string;
    name: string;
    code: string;
  } | null;
  to_location?: {
    id: string;
    name: string;
    code: string;
  } | null;
}

export interface CreateTransferRequestInput {
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  priority?: TransferPriority;
  expected_date?: string;
  shipping_method?: string;
  carrier?: string;
  notes?: string;
  items: CreateTransferRequestItemInput[];
}

export interface CreateTransferRequestItemInput {
  product_id: string;
  variant_id?: string | null;
  quantity: number;
  from_location_id?: string | null;
  to_location_id?: string | null;
  item_notes?: string;
}

export interface UpdateTransferRequestInput {
  priority?: TransferPriority;
  expected_date?: string;
  shipping_method?: string;
  carrier?: string;
  tracking_number?: string;
  notes?: string;
}

export interface ApproveTransferInput {
  approved_by: string;
  notes?: string;
}

export interface ShipTransferInput {
  shipped_by: string;
  shipping_method?: string;
  carrier?: string;
  tracking_number?: string;
  notes?: string;
}

export interface ReceiveTransferInput {
  received_by: string;
  items: ReceiveTransferItemInput[];
  notes?: string;
}

export interface ReceiveTransferItemInput {
  item_id: string;
  received_quantity: number;
  to_location_id?: string;
  notes?: string;
}

export interface TransferFilters {
  status?: TransferStatus | TransferStatus[];
  priority?: TransferPriority;
  from_branch_id?: string;
  to_branch_id?: string;
  expected_date_from?: string;
  expected_date_to?: string;
  search?: string;
}

export interface TransferStats {
  total: number;
  by_status: Record<TransferStatus, number>;
  by_priority: Record<TransferPriority, number>;
  pending_approval: number;
  in_transit: number;
  overdue: number;
}
