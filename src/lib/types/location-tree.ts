import { Tables } from "../../../supabase/types/types";

export interface LocationTreeItem {
  id: string;
  name: string;
  icon_name?: string | null;
  code?: string | null;
  color?: string | null;
  children?: LocationTreeItem[];
  raw: Tables<"locations">;
  productCount?: number;
}
