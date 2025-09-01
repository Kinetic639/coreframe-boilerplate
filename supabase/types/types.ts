export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  public: {
    Tables: {
      label_template_fields: {
        Row: {
          background_color: string | null;
          border_color: string | null;
          border_enabled: boolean | null;
          border_width: number | null;
          created_at: string | null;
          deleted_at: string | null;
          field_name: string;
          field_type: string;
          field_value: string | null;
          font_size: number | null;
          font_weight: string | null;
          height_mm: number;
          id: string;
          is_required: boolean | null;
          label_color: string | null;
          label_font_size: number | null;
          label_position: string | null;
          label_template_id: string | null;
          label_text: string | null;
          padding_bottom: number | null;
          padding_left: number | null;
          padding_right: number | null;
          padding_top: number | null;
          position_x: number;
          position_y: number;
          show_label: boolean | null;
          sort_order: number | null;
          text_align: string | null;
          text_color: string | null;
          updated_at: string | null;
          vertical_align: string | null;
          width_mm: number;
        };
        Insert: {
          background_color?: string | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          field_name: string;
          field_type: string;
          field_value?: string | null;
          font_size?: number | null;
          font_weight?: string | null;
          height_mm?: number;
          id?: string;
          is_required?: boolean | null;
          label_color?: string | null;
          label_font_size?: number | null;
          label_position?: string | null;
          label_template_id?: string | null;
          label_text?: string | null;
          padding_bottom?: number | null;
          padding_left?: number | null;
          padding_right?: number | null;
          padding_top?: number | null;
          position_x?: number;
          position_y?: number;
          show_label?: boolean | null;
          sort_order?: number | null;
          text_align?: string | null;
          text_color?: string | null;
          updated_at?: string | null;
          vertical_align?: string | null;
          width_mm?: number;
        };
        Update: {
          background_color?: string | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          field_name?: string;
          field_type?: string;
          field_value?: string | null;
          font_size?: number | null;
          font_weight?: string | null;
          height_mm?: number;
          id?: string;
          is_required?: boolean | null;
          label_color?: string | null;
          label_font_size?: number | null;
          label_position?: string | null;
          label_template_id?: string | null;
          label_text?: string | null;
          padding_bottom?: number | null;
          padding_left?: number | null;
          padding_right?: number | null;
          padding_top?: number | null;
          position_x?: number;
          position_y?: number;
          show_label?: boolean | null;
          sort_order?: number | null;
          text_align?: string | null;
          text_color?: string | null;
          updated_at?: string | null;
          vertical_align?: string | null;
          width_mm?: number;
        };
      };
      label_templates: {
        Row: {
          additional_info_position: string | null;
          background_color: string | null;
          border_color: string | null;
          border_enabled: boolean | null;
          border_width: number | null;
          category: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          dpi: number | null;
          height_mm: number;
          id: string;
          is_default: boolean | null;
          is_system: boolean | null;
          label_text_position: string | null;
          label_text_size: number | null;
          label_type: string;
          layout_direction: string | null;
          name: string;
          organization_id: string | null;
          orientation: string | null;
          qr_position: string | null;
          qr_size_mm: number | null;
          section_balance: string | null;
          show_additional_info: boolean | null;
          show_barcode: boolean | null;
          show_code: boolean | null;
          show_hierarchy: boolean | null;
          show_label_text: boolean | null;
          template_config: Json;
          text_color: string | null;
          updated_at: string | null;
          width_mm: number;
        };
        Insert: {
          additional_info_position?: string | null;
          background_color?: string | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dpi?: number | null;
          height_mm: number;
          id?: string;
          is_default?: boolean | null;
          is_system?: boolean | null;
          label_text_position?: string | null;
          label_text_size?: number | null;
          label_type: string;
          layout_direction?: string | null;
          name: string;
          organization_id?: string | null;
          orientation?: string | null;
          qr_position?: string | null;
          qr_size_mm?: number | null;
          section_balance?: string | null;
          show_additional_info?: boolean | null;
          show_barcode?: boolean | null;
          show_code?: boolean | null;
          show_hierarchy?: boolean | null;
          show_label_text?: boolean | null;
          template_config?: Json;
          text_color?: string | null;
          updated_at?: string | null;
          width_mm: number;
        };
        Update: {
          additional_info_position?: string | null;
          background_color?: string | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dpi?: number | null;
          height_mm?: number;
          id?: string;
          is_default?: boolean | null;
          is_system?: boolean | null;
          label_text_position?: string | null;
          label_text_size?: number | null;
          label_type?: string;
          layout_direction?: string | null;
          name?: string;
          organization_id?: string | null;
          orientation?: string | null;
          qr_position?: string | null;
          qr_size_mm?: number | null;
          section_balance?: string | null;
          show_additional_info?: boolean | null;
          show_barcode?: boolean | null;
          show_code?: boolean | null;
          show_hierarchy?: boolean | null;
          show_label_text?: boolean | null;
          template_config?: Json;
          text_color?: string | null;
          updated_at?: string | null;
          width_mm?: number;
        };
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      [_ in never]: never;
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

export type Tables<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  PublicTableNameOrOptions extends keyof Database["public"]["Tables"] | { schema: keyof Database },
  TableName extends PublicTableNameOrOptions extends { schema: keyof Database }
    ? keyof Database[PublicTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = PublicTableNameOrOptions extends { schema: keyof Database }
  ? Database[PublicTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : PublicTableNameOrOptions extends keyof Database["public"]["Tables"]
    ? Database["public"]["Tables"][PublicTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;
