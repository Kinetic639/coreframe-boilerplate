import { Tables } from "../../../supabase/types/types";

export interface LocationTreeItem {
  id: string;
  name: string;
  icon_name?: string | null;
  code?: string | null;
  color?: string | null;
  description?: string | null;
  level?: number | null;
  sort_order?: number | null;
  created_at?: string | null;
  children?: LocationTreeItem[];
  raw: Tables<"locations">;
  productCount?: number;
}
