export interface AuditSchedule {
  id: string;
  name: string;
  frequency: "weekly" | "monthly" | "quarterly" | "yearly";
  location_ids: string[];
  start_date: string;
  next_audit_date: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Audit {
  id: string;
  schedule_id?: string;
  name: string;
  location_ids: string[];
  status: "pending" | "in_progress" | "completed" | "cancelled";
  started_at?: string;
  completed_at?: string;
  conducted_by: string;
  total_products: number;
  checked_products: number;
  corrections_count: number;
  total_value_change: number;
  branch_id: string;
  created_at: string;
  updated_at: string;
}

export interface AuditItem {
  id: string;
  audit_id: string;
  product_id: string;
  location_id: string;
  system_quantity: number;
  physical_quantity: number;
  difference: number;
  unit_price: number;
  value_change: number;
  notes?: string;
  checked_at: string;
}

export interface AuditProgress {
  currentLocationIndex: number;
  currentProductIndex: number;
  totalLocations: number;
  totalProducts: number;
  checkedProducts: number;
  corrections: AuditItem[];
}
