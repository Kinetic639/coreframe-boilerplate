export interface StockAlert {
  id: string;
  name: string;
  status: "low_stock" | "out_of_stock" | "recently_stocked";
  current_stock: number;
  min_quantity: number;
}

export interface Movement {
  id: string;
  type: "inbound" | "outbound" | "correction" | "manual";
  product_name: string;
  quantity: number;
  location_name: string;
  timestamp: string;
  user: string;
}

export interface Task {
  id: string;
  title: string;
  due_date: string;
  type: "audit" | "relocation" | "meeting";
}

export interface SystemMessage {
  id: string;
  title: string;
  content: string;
  created_at: string;
  created_by: string;
  visibility: "organization" | "branch" | "user";
  pinned?: boolean;
}

export interface QuickAction {
  id: string;
  label: string;
  href: string;
  icon: string;
}

export interface ActivityLog {
  id: string;
  timestamp: string;
  user: string;
  action: string;
  details: string;
  type: "system" | "user";
}

export interface UserPreference {
  user_id: string;
  notes: string;
}
