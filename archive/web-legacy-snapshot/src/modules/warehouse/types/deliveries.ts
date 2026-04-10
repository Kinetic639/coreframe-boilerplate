// =============================================
// Deliveries - TypeScript Definitions
// Leverages stock_movements with type 101 (GR from PO)
// =============================================

/**
 * Delivery status (maps to stock movement status)
 */
export type DeliveryStatus = "draft" | "pending" | "approved" | "completed" | "cancelled";

/**
 * Delivery item (product line in a delivery)
 */
export interface DeliveryItem {
  id?: string;
  product_id: string;
  variant_id?: string | null;
  expected_quantity: number;
  received_quantity?: number;
  unit_cost?: number;
  total_cost?: number;
  notes?: string;
  batch_number?: string;
  serial_number?: string;
  expiry_date?: string;
}

/**
 * Delivery record (aggregates related stock movements)
 */
export interface Delivery {
  id: string;
  delivery_number: string; // e.g., WH/OUT/00001
  organization_id: string;
  branch_id: string;

  // Delivery details
  status: DeliveryStatus;
  scheduled_date: string;
  source_document?: string; // e.g., PO0032
  delivery_address?: string; // Supplier or source
  operation_type: string; // e.g., "testerowanko: Delivery Orders"

  // Location (optional - products can be received without immediate location assignment)
  destination_location_id?: string;

  // Items (stock movements associated with this delivery)
  items: DeliveryItem[];

  // Users
  created_by: string | null;
  received_by?: string | null;

  // Timestamps
  created_at: string;
  received_at?: string | null;

  // Additional info
  shipping_policy?: string; // e.g., "As soon as possible"
  responsible_user_id?: string;
  notes?: string;
  metadata?: Record<string, unknown>;
}

/**
 * Delivery with relations populated
 */
export interface DeliveryWithRelations extends Delivery {
  destination_location?: {
    id: string;
    name: string;
    code: string;
  };
  created_by_user?: {
    id: string;
    email: string;
    name: string;
  };
  responsible_user?: {
    id: string;
    email: string;
    name: string;
  };
  items_with_details?: (DeliveryItem & {
    product?: {
      id: string;
      name: string;
      sku: string;
    };
    variant?: {
      id: string;
      name: string;
      sku: string;
    };
  })[];
}

/**
 * Data for creating a new delivery
 */
export interface CreateDeliveryData {
  organization_id: string;
  branch_id: string;
  destination_location_id?: string; // Optional: products can be received without assigning to location
  scheduled_date?: string;
  source_document?: string;
  delivery_address?: string;
  responsible_user_id?: string;
  supplier_id?: string; // Supplier/vendor for this delivery
  notes?: string;
  items: DeliveryItem[];
  requires_verification?: boolean; // If false, complete immediately without verification step
}

/**
 * Data for updating a delivery
 */
export interface UpdateDeliveryData {
  scheduled_date?: string;
  source_document?: string;
  delivery_address?: string;
  shipping_policy?: string;
  responsible_user_id?: string;
  notes?: string;
  items?: DeliveryItem[];
}

/**
 * Delivery filters for list view
 */
export interface DeliveryFilters {
  organization_id?: string;
  branch_id?: string;
  status?: DeliveryStatus;
  destination_location_id?: string;
  source_document?: string;
  date_from?: string;
  date_to?: string;
  search?: string; // Search in delivery_number, source_document, notes
}

/**
 * Paginated deliveries response
 */
export interface PaginatedDeliveries {
  data: DeliveryWithRelations[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
}

/**
 * Delivery validation result
 */
export interface DeliveryValidationResult {
  isValid: boolean;
  errors: string[];
  warnings: string[];
}

/**
 * Receive delivery data (mark as done)
 */
export interface ReceiveDeliveryData {
  delivery_id: string;
  received_by: string;
  items: {
    item_id: string;
    received_quantity: number;
    batch_number?: string;
    serial_number?: string;
    expiry_date?: string;
    notes?: string;
  }[];
}

/**
 * Status configuration for UI display
 */
export const DELIVERY_STATUS_CONFIG: Record<
  DeliveryStatus,
  {
    label: { pl: string; en: string };
    color: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  draft: {
    label: { pl: "Szkic", en: "Draft" },
    color: "bg-gray-100 text-gray-800 border-gray-300",
    variant: "outline",
  },
  pending: {
    label: { pl: "Oczekuje", en: "Pending" },
    color: "bg-yellow-100 text-yellow-800 border-yellow-300",
    variant: "outline",
  },
  approved: {
    label: { pl: "Zatwierdzone", en: "Approved" },
    color: "bg-blue-100 text-blue-800 border-blue-300",
    variant: "outline",
  },
  completed: {
    label: { pl: "Zakończone", en: "Completed" },
    color: "bg-green-100 text-green-800 border-green-300",
    variant: "default",
  },
  cancelled: {
    label: { pl: "Anulowane", en: "Cancelled" },
    color: "bg-red-100 text-red-800 border-red-300",
    variant: "destructive",
  },
};

/**
 * Helper type for delivery creation response
 */
export interface CreateDeliveryResponse {
  success: boolean;
  delivery_id?: string;
  delivery_number?: string;
  movement_ids?: string[];
  errors?: string[];
  warnings?: string[];
}

/**
 * Constants
 */
export const DELIVERY_DEFAULTS = {
  PAGE_SIZE: 50,
  OPERATION_TYPE: "Delivery Orders",
  SHIPPING_POLICY: "As soon as possible",
  STATUS: "draft" as DeliveryStatus,
} as const;
