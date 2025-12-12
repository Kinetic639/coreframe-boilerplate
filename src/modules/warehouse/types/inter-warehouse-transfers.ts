// =============================================
// Inter-Warehouse Transfer Types
// Type definitions for transfer requests and inter-warehouse movements
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

export type ItemStatus = "pending" | "in_transit" | "completed";

export interface TransferRequest {
  id: string;
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  transfer_number: string;
  status: TransferStatus;
  priority: TransferPriority;
  expected_date: string | null;
  shipped_at: string | null;
  received_at: string | null;
  shipping_method: string | null;
  carrier: string | null;
  tracking_number: string | null;
  requested_by: string | null;
  reviewed_by: string | null;
  reviewed_at: string | null;
  approved_by: string | null;
  approved_at: string | null;
  shipped_by: string | null;
  received_by: string | null;
  notes: string | null;
  comment: string | null;
  requires_confirmation: boolean;
  metadata: Record<string, unknown>;
  created_at: string;
}

export interface TransferRequestItem {
  id: string;
  transfer_request_id: string;
  product_id: string;
  variant_id: string | null;
  product_variant_id: string; // Legacy field for compatibility
  quantity: number;
  received_quantity: number;
  unit_id: string;
  from_location_id: string | null;
  to_location_id: string | null;
  item_status: ItemStatus;
  item_notes: string | null;
  comment: string | null;
  created_at: string;
}

export interface Branch {
  id: string;
  name: string;
  code?: string;
}

export interface Location {
  id: string;
  name: string;
  code?: string;
}

export interface Product {
  id: string;
  name: string;
  sku: string;
}

export interface User {
  id: string;
  email: string;
  first_name?: string;
  last_name?: string;
}

export interface TransferRequestItemWithRelations extends TransferRequestItem {
  product?: Product;
  variant?: { id: string; name: string; sku: string };
  from_location?: Location;
  to_location?: Location;
}

export interface TransferRequestWithRelations extends TransferRequest {
  items: TransferRequestItemWithRelations[];
  from_branch?: Branch;
  to_branch?: Branch;
  requested_by_user?: User;
  reviewed_by_user?: User;
  approved_by_user?: User;
  shipped_by_user?: User;
  received_by_user?: User;
}

export interface CreateTransferRequestInput {
  organization_id: string;
  from_branch_id: string;
  to_branch_id: string;
  priority?: TransferPriority;
  expected_date?: string;
  shipping_method?: string;
  notes?: string;
  items: Array<{
    product_id: string;
    variant_id?: string;
    quantity: number;
    unit_id: string;
    from_location_id: string;
    to_location_id: string;
  }>;
}

export interface UpdateTransferRequestInput {
  priority?: TransferPriority;
  expected_date?: string;
  shipping_method?: string;
  notes?: string;
}

export interface ApproveTransferInput {
  expected_date?: string;
  notes?: string;
}

export interface ShipTransferInput {
  carrier?: string;
  tracking_number?: string;
  shipping_method?: string;
  notes?: string;
}

export interface ReceiveTransferItemInput {
  item_id: string;
  received_quantity: number;
  notes?: string;
}

export interface ReceiveTransferInput {
  items: ReceiveTransferItemInput[];
  notes?: string;
}

export interface TransferFilters {
  organization_id?: string;
  from_branch_id?: string;
  to_branch_id?: string;
  status?: TransferStatus;
  priority?: TransferPriority;
  date_from?: string;
  date_to?: string;
  search?: string;
}

export interface TransferStats {
  total: number;
  by_status: Record<TransferStatus, number>;
  by_priority: Record<TransferPriority, number>;
  pending_approval: number;
  in_transit: number;
}

export interface TransferRequestResponse {
  success: boolean;
  transfer_id?: string;
  transfer?: TransferRequestWithRelations;
  error?: string;
}

export interface TransferActionResponse {
  success: boolean;
  movement_ids?: string[];
  error?: string;
}
