export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "12.2.3 (519615d)";
  };
  public: {
    Tables: {
      activities: {
        Row: {
          action_id: string | null;
          branch_id: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string;
          entity_id: string | null;
          entity_type_id: string | null;
          id: string;
          ip_address: unknown | null;
          metadata: Json | null;
          module_id: string | null;
          organization_id: string;
          session_id: string | null;
          status: string | null;
          updated_at: string | null;
          url: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          action_id?: string | null;
          branch_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description: string;
          entity_id?: string | null;
          entity_type_id?: string | null;
          id?: string;
          ip_address?: unknown | null;
          metadata?: Json | null;
          module_id?: string | null;
          organization_id: string;
          session_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          action_id?: string | null;
          branch_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string;
          entity_id?: string | null;
          entity_type_id?: string | null;
          id?: string;
          ip_address?: unknown | null;
          metadata?: Json | null;
          module_id?: string | null;
          organization_id?: string;
          session_id?: string | null;
          status?: string | null;
          updated_at?: string | null;
          url?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activities_action_id_fkey";
            columns: ["action_id"];
            isOneToOne: false;
            referencedRelation: "activity_actions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_entity_type_id_fkey";
            columns: ["entity_type_id"];
            isOneToOne: false;
            referencedRelation: "activity_entity_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "activity_modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "activities_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_actions: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          slug?: string;
        };
        Relationships: [];
      };
      activity_entity_types: {
        Row: {
          created_at: string | null;
          description: string | null;
          id: string;
          module_id: string | null;
          slug: string;
          table_name: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          module_id?: string | null;
          slug: string;
          table_name?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: string | null;
          id?: string;
          module_id?: string | null;
          slug?: string;
          table_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "activity_entity_types_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "activity_modules";
            referencedColumns: ["id"];
          },
        ];
      };
      activity_modules: {
        Row: {
          created_at: string | null;
          id: string;
          name: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          name: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          name?: string;
          slug?: string;
        };
        Relationships: [];
      };
      auth_debug: {
        Row: {
          created_at: string | null;
          id: number;
          log_data: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: number;
          log_data?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: number;
          log_data?: string | null;
        };
        Relationships: [];
      };
      auth_hook_debug: {
        Row: {
          created_at: string | null;
          debug_info: Json | null;
          event_data: Json | null;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          debug_info?: Json | null;
          event_data?: Json | null;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          debug_info?: Json | null;
          event_data?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      branches: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          organization_id: string;
          slug: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          slug?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "branches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      debug_logs: {
        Row: {
          created_at: string | null;
          event_data: Json | null;
          id: string;
        };
        Insert: {
          created_at?: string | null;
          event_data?: Json | null;
          id?: string;
        };
        Update: {
          created_at?: string | null;
          event_data?: Json | null;
          id?: string;
        };
        Relationships: [];
      };
      hook_execution_log: {
        Row: {
          executed_at: string | null;
          id: number;
          roles_found: number | null;
          user_id: string | null;
        };
        Insert: {
          executed_at?: string | null;
          id?: number;
          roles_found?: number | null;
          user_id?: string | null;
        };
        Update: {
          executed_at?: string | null;
          id?: number;
          roles_found?: number | null;
          user_id?: string | null;
        };
        Relationships: [];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          branch_id: string | null;
          created_at: string | null;
          deleted_at: string | null;
          email: string;
          expires_at: string | null;
          id: string;
          invited_by: string;
          organization_id: string | null;
          role_id: string | null;
          status: string;
          team_id: string | null;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email: string;
          expires_at?: string | null;
          id?: string;
          invited_by: string;
          organization_id?: string | null;
          role_id?: string | null;
          status?: string;
          team_id?: string | null;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          branch_id?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          expires_at?: string | null;
          id?: string;
          invited_by?: string;
          organization_id?: string | null;
          role_id?: string | null;
          status?: string;
          team_id?: string | null;
          token?: string;
        };
        Relationships: [
          {
            foreignKeyName: "invitations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_invited_by_fkey";
            columns: ["invited_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitations_team_id_fkey";
            columns: ["team_id"];
            isOneToOne: false;
            referencedRelation: "teams";
            referencedColumns: ["id"];
          },
        ];
      };
      label_batches: {
        Row: {
          batch_description: string | null;
          batch_name: string;
          batch_status: string | null;
          branch_id: string;
          created_at: string | null;
          created_by: string | null;
          generated_at: string | null;
          id: string;
          label_template_id: string | null;
          label_type: string;
          labels_per_sheet: number | null;
          organization_id: string;
          pdf_generated: boolean | null;
          pdf_path: string | null;
          quantity: number;
          sheet_layout: string | null;
        };
        Insert: {
          batch_description?: string | null;
          batch_name: string;
          batch_status?: string | null;
          branch_id: string;
          created_at?: string | null;
          created_by?: string | null;
          generated_at?: string | null;
          id?: string;
          label_template_id?: string | null;
          label_type: string;
          labels_per_sheet?: number | null;
          organization_id: string;
          pdf_generated?: boolean | null;
          pdf_path?: string | null;
          quantity: number;
          sheet_layout?: string | null;
        };
        Update: {
          batch_description?: string | null;
          batch_name?: string;
          batch_status?: string | null;
          branch_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          generated_at?: string | null;
          id?: string;
          label_template_id?: string | null;
          label_type?: string;
          labels_per_sheet?: number | null;
          organization_id?: string;
          pdf_generated?: boolean | null;
          pdf_path?: string | null;
          quantity?: number;
          sheet_layout?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "label_batches_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_label_template_id_fkey";
            columns: ["label_template_id"];
            isOneToOne: false;
            referencedRelation: "label_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      label_templates: {
        Row: {
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
          qr_position: string | null;
          qr_size_mm: number | null;
          section_balance: string | null;
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
          qr_position?: string | null;
          qr_size_mm?: number | null;
          section_balance?: string | null;
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
          qr_position?: string | null;
          qr_size_mm?: number | null;
          section_balance?: string | null;
          show_barcode?: boolean | null;
          show_code?: boolean | null;
          show_hierarchy?: boolean | null;
          show_label_text?: boolean | null;
          template_config?: Json;
          text_color?: string | null;
          updated_at?: string | null;
          width_mm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "label_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      locations: {
        Row: {
          branch_id: string | null;
          code: string | null;
          color: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          has_qr_assigned: boolean | null;
          icon_name: string | null;
          id: string;
          image_url: string | null;
          is_virtual: boolean;
          level: number;
          name: string;
          organization_id: string | null;
          parent_id: string | null;
          qr_assigned_at: string | null;
          qr_assigned_by: string | null;
          qr_label_id: string | null;
          sort_order: number;
          updated_at: string | null;
        };
        Insert: {
          branch_id?: string | null;
          code?: string | null;
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          has_qr_assigned?: boolean | null;
          icon_name?: string | null;
          id?: string;
          image_url?: string | null;
          is_virtual?: boolean;
          level?: number;
          name: string;
          organization_id?: string | null;
          parent_id?: string | null;
          qr_assigned_at?: string | null;
          qr_assigned_by?: string | null;
          qr_label_id?: string | null;
          sort_order?: number;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string | null;
          code?: string | null;
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          has_qr_assigned?: boolean | null;
          icon_name?: string | null;
          id?: string;
          image_url?: string | null;
          is_virtual?: boolean;
          level?: number;
          name?: string;
          organization_id?: string | null;
          parent_id?: string | null;
          qr_assigned_at?: string | null;
          qr_assigned_by?: string | null;
          qr_label_id?: string | null;
          sort_order?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "locations_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locations_qr_assigned_by_fkey";
            columns: ["qr_assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "locations_qr_label_id_fkey";
            columns: ["qr_label_id"];
            isOneToOne: false;
            referencedRelation: "qr_labels";
            referencedColumns: ["id"];
          },
        ];
      };
      modules: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          label: string;
          settings: Json | null;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          label: string;
          settings?: Json | null;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          label?: string;
          settings?: Json | null;
          slug?: string;
        };
        Relationships: [];
      };
      movement_types: {
        Row: {
          available_to_user: boolean;
          created_at: string | null;
          direction: string;
          id: string;
          name: string;
          requires_confirmation: boolean;
          slug: string;
          system: boolean;
        };
        Insert: {
          available_to_user?: boolean;
          created_at?: string | null;
          direction: string;
          id?: string;
          name: string;
          requires_confirmation?: boolean;
          slug: string;
          system?: boolean;
        };
        Update: {
          available_to_user?: boolean;
          created_at?: string | null;
          direction?: string;
          id?: string;
          name?: string;
          requires_confirmation?: boolean;
          slug?: string;
          system?: boolean;
        };
        Relationships: [];
      };
      news_posts: {
        Row: {
          author_id: string | null;
          badges: string[] | null;
          branch_id: string | null;
          content: Json;
          created_at: string | null;
          excerpt: string | null;
          id: string;
          organization_id: string;
          priority: string | null;
          published_at: string | null;
          title: string;
          updated_at: string | null;
        };
        Insert: {
          author_id?: string | null;
          badges?: string[] | null;
          branch_id?: string | null;
          content: Json;
          created_at?: string | null;
          excerpt?: string | null;
          id?: string;
          organization_id: string;
          priority?: string | null;
          published_at?: string | null;
          title: string;
          updated_at?: string | null;
        };
        Update: {
          author_id?: string | null;
          badges?: string[] | null;
          branch_id?: string | null;
          content?: Json;
          created_at?: string | null;
          excerpt?: string | null;
          id?: string;
          organization_id?: string;
          priority?: string | null;
          published_at?: string | null;
          title?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "news_posts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "news_posts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_members: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          joined_at: string | null;
          organization_id: string;
          status: string;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          joined_at?: string | null;
          organization_id: string;
          status?: string;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          joined_at?: string | null;
          organization_id?: string;
          status?: string;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "organization_members_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_members_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_profiles: {
        Row: {
          bio: string | null;
          created_at: string | null;
          font_color: string | null;
          logo_url: string | null;
          name: string | null;
          name_2: string | null;
          organization_id: string;
          slug: string | null;
          theme_color: string | null;
          website: string | null;
        };
        Insert: {
          bio?: string | null;
          created_at?: string | null;
          font_color?: string | null;
          logo_url?: string | null;
          name?: string | null;
          name_2?: string | null;
          organization_id: string;
          slug?: string | null;
          theme_color?: string | null;
          website?: string | null;
        };
        Update: {
          bio?: string | null;
          created_at?: string | null;
          font_color?: string | null;
          logo_url?: string | null;
          name?: string | null;
          name_2?: string | null;
          organization_id?: string;
          slug?: string | null;
          theme_color?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_profiles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organizations: {
        Row: {
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          name_2: string | null;
          slug: string | null;
        };
        Insert: {
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          name_2?: string | null;
          slug?: string | null;
        };
        Update: {
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          name_2?: string | null;
          slug?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organizations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      permissions: {
        Row: {
          action: string;
          category: string;
          conflicts_with: string[] | null;
          created_at: string | null;
          deleted_at: string | null;
          dependencies: string[] | null;
          description: string | null;
          id: string;
          is_dangerous: boolean | null;
          is_system: boolean | null;
          label: string | null;
          metadata: Json | null;
          name: string | null;
          priority: number | null;
          requires_mfa: boolean | null;
          resource_type: string | null;
          scope_types: string[] | null;
          slug: string;
          subcategory: string | null;
          updated_at: string | null;
        };
        Insert: {
          action: string;
          category: string;
          conflicts_with?: string[] | null;
          created_at?: string | null;
          deleted_at?: string | null;
          dependencies?: string[] | null;
          description?: string | null;
          id?: string;
          is_dangerous?: boolean | null;
          is_system?: boolean | null;
          label?: string | null;
          metadata?: Json | null;
          name?: string | null;
          priority?: number | null;
          requires_mfa?: boolean | null;
          resource_type?: string | null;
          scope_types?: string[] | null;
          slug: string;
          subcategory?: string | null;
          updated_at?: string | null;
        };
        Update: {
          action?: string;
          category?: string;
          conflicts_with?: string[] | null;
          created_at?: string | null;
          deleted_at?: string | null;
          dependencies?: string[] | null;
          description?: string | null;
          id?: string;
          is_dangerous?: boolean | null;
          is_system?: boolean | null;
          label?: string | null;
          metadata?: Json | null;
          name?: string | null;
          priority?: number | null;
          requires_mfa?: boolean | null;
          resource_type?: string | null;
          scope_types?: string[] | null;
          slug?: string;
          subcategory?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      product_ecommerce_data: {
        Row: {
          category: string | null;
          created_at: string | null;
          deleted_at: string | null;
          discount_end: string | null;
          discount_start: string | null;
          discounted_price: number | null;
          ecommerce_image_ids: string[] | null;
          id: string;
          price: number | null;
          product_id: string | null;
          tags: string[] | null;
          updated_at: string | null;
          visibility: boolean | null;
        };
        Insert: {
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          discount_end?: string | null;
          discount_start?: string | null;
          discounted_price?: number | null;
          ecommerce_image_ids?: string[] | null;
          id?: string;
          price?: number | null;
          product_id?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
          visibility?: boolean | null;
        };
        Update: {
          category?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          discount_end?: string | null;
          discount_start?: string | null;
          discounted_price?: number | null;
          ecommerce_image_ids?: string[] | null;
          id?: string;
          price?: number | null;
          product_id?: string | null;
          tags?: string[] | null;
          updated_at?: string | null;
          visibility?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_ecommerce_data_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_inventory_data: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          dimensions: Json | null;
          id: string;
          inventory_image_ids: string[] | null;
          packaging_type: string | null;
          product_id: string | null;
          purchase_price: number | null;
          updated_at: string | null;
          vat_rate: number | null;
          weight: number | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          dimensions?: Json | null;
          id?: string;
          inventory_image_ids?: string[] | null;
          packaging_type?: string | null;
          product_id?: string | null;
          purchase_price?: number | null;
          updated_at?: string | null;
          vat_rate?: number | null;
          weight?: number | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          dimensions?: Json | null;
          id?: string;
          inventory_image_ids?: string[] | null;
          packaging_type?: string | null;
          product_id?: string | null;
          purchase_price?: number | null;
          updated_at?: string | null;
          vat_rate?: number | null;
          weight?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_inventory_data_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_inventory_summary: {
        Row: {
          branch_id: string;
          id: string;
          location_id: string;
          organization_id: string;
          product_variant_id: string;
          quantity: number;
          unit_id: string;
        };
        Insert: {
          branch_id: string;
          id?: string;
          location_id: string;
          organization_id: string;
          product_variant_id: string;
          quantity?: number;
          unit_id: string;
        };
        Update: {
          branch_id?: string;
          id?: string;
          location_id?: string;
          organization_id?: string;
          product_variant_id?: string;
          quantity?: number;
          unit_id?: string;
        };
        Relationships: [];
      };
      product_stock_locations: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          location_id: string | null;
          product_id: string | null;
          quantity: number;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          location_id?: string | null;
          product_id?: string | null;
          quantity?: number;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          location_id?: string | null;
          product_id?: string | null;
          quantity?: number;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_stock_locations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_stock_locations_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_suppliers: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          is_preferred: boolean | null;
          lead_time_days: number | null;
          minimum_order_quantity: number | null;
          notes: string | null;
          product_id: string;
          supplier_id: string;
          supplier_price: number | null;
          supplier_product_code: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_preferred?: boolean | null;
          lead_time_days?: number | null;
          minimum_order_quantity?: number | null;
          notes?: string | null;
          product_id: string;
          supplier_id: string;
          supplier_price?: number | null;
          supplier_product_code?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_preferred?: boolean | null;
          lead_time_days?: number | null;
          minimum_order_quantity?: number | null;
          notes?: string | null;
          product_id?: string;
          supplier_id?: string;
          supplier_price?: number | null;
          supplier_product_code?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_suppliers_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_suppliers_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_types: {
        Row: {
          created_at: string | null;
          icon: string | null;
          id: string;
          name: string;
          organization_id: string;
          slug: string;
        };
        Insert: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          slug: string;
        };
        Update: {
          created_at?: string | null;
          icon?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          slug?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_units: {
        Row: {
          conversion_factor: number;
          created_at: string;
          id: string;
          is_active: boolean;
          is_default: boolean;
          product_id: string;
          sort_order: number | null;
          unit_id: string;
          unit_name: string;
          unit_type: string;
        };
        Insert: {
          conversion_factor: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          product_id: string;
          sort_order?: number | null;
          unit_id: string;
          unit_name: string;
          unit_type: string;
        };
        Update: {
          conversion_factor?: number;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          is_default?: boolean;
          product_id?: string;
          sort_order?: number | null;
          unit_id?: string;
          unit_name?: string;
          unit_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_units_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_units_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          attributes: Json | null;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          product_id: string | null;
          qr_label_id: string | null;
          sku: string | null;
          updated_at: string | null;
        };
        Insert: {
          attributes?: Json | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          product_id?: string | null;
          qr_label_id?: string | null;
          sku?: string | null;
          updated_at?: string | null;
        };
        Update: {
          attributes?: Json | null;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          product_id?: string | null;
          qr_label_id?: string | null;
          sku?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variants_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variants_qr_label_id_fkey";
            columns: ["qr_label_id"];
            isOneToOne: false;
            referencedRelation: "qr_labels";
            referencedColumns: ["id"];
          },
        ];
      };
      products: {
        Row: {
          barcode: string | null;
          base_unit_id: string | null;
          code: string | null;
          created_at: string | null;
          default_unit: string | null;
          deleted_at: string | null;
          description: string | null;
          has_qr_assigned: boolean | null;
          id: string;
          main_image_id: string | null;
          name: string;
          qr_assigned_at: string | null;
          qr_assigned_by: string | null;
          qr_label_id: string | null;
          sku: string | null;
          updated_at: string | null;
        };
        Insert: {
          barcode?: string | null;
          base_unit_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          default_unit?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          has_qr_assigned?: boolean | null;
          id?: string;
          main_image_id?: string | null;
          name: string;
          qr_assigned_at?: string | null;
          qr_assigned_by?: string | null;
          qr_label_id?: string | null;
          sku?: string | null;
          updated_at?: string | null;
        };
        Update: {
          barcode?: string | null;
          base_unit_id?: string | null;
          code?: string | null;
          created_at?: string | null;
          default_unit?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          has_qr_assigned?: boolean | null;
          id?: string;
          main_image_id?: string | null;
          name?: string;
          qr_assigned_at?: string | null;
          qr_assigned_by?: string | null;
          qr_label_id?: string | null;
          sku?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_base_unit_id_fkey";
            columns: ["base_unit_id"];
            isOneToOne: false;
            referencedRelation: "units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_qr_assigned_by_fkey";
            columns: ["qr_assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_qr_label_id_fkey";
            columns: ["qr_label_id"];
            isOneToOne: false;
            referencedRelation: "qr_labels";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_labels: {
        Row: {
          assigned_at: string | null;
          assigned_by: string | null;
          branch_id: string;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          is_active: boolean | null;
          is_printed: boolean | null;
          label_template_id: string | null;
          label_type: string;
          metadata: Json | null;
          organization_id: string;
          print_count: number | null;
          printed_at: string | null;
          qr_token: string;
          updated_at: string | null;
        };
        Insert: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          branch_id: string;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_printed?: boolean | null;
          label_template_id?: string | null;
          label_type: string;
          metadata?: Json | null;
          organization_id: string;
          print_count?: number | null;
          printed_at?: string | null;
          qr_token: string;
          updated_at?: string | null;
        };
        Update: {
          assigned_at?: string | null;
          assigned_by?: string | null;
          branch_id?: string;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_printed?: boolean | null;
          label_template_id?: string | null;
          label_type?: string;
          metadata?: Json | null;
          organization_id?: string;
          print_count?: number | null;
          printed_at?: string | null;
          qr_token?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "fk_qr_labels_template";
            columns: ["label_template_id"];
            isOneToOne: false;
            referencedRelation: "label_templates";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_labels_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_labels_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_labels_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_labels_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_scan_logs: {
        Row: {
          branch_id: string | null;
          error_message: string | null;
          id: string;
          ip_address: unknown | null;
          organization_id: string | null;
          qr_token: string;
          redirect_path: string | null;
          scan_context: Json | null;
          scan_result: string;
          scan_type: string;
          scanned_at: string | null;
          scanner_type: string | null;
          user_agent: string | null;
          user_id: string | null;
        };
        Insert: {
          branch_id?: string | null;
          error_message?: string | null;
          id?: string;
          ip_address?: unknown | null;
          organization_id?: string | null;
          qr_token: string;
          redirect_path?: string | null;
          scan_context?: Json | null;
          scan_result: string;
          scan_type: string;
          scanned_at?: string | null;
          scanner_type?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Update: {
          branch_id?: string | null;
          error_message?: string | null;
          id?: string;
          ip_address?: unknown | null;
          organization_id?: string | null;
          qr_token?: string;
          redirect_path?: string | null;
          scan_context?: Json | null;
          scan_result?: string;
          scan_type?: string;
          scanned_at?: string | null;
          scanner_type?: string | null;
          user_agent?: string | null;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "qr_scan_logs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_scan_logs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_scan_logs_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      role_permissions: {
        Row: {
          allowed: boolean;
          deleted_at: string | null;
          id: string;
          permission_id: string;
          role_id: string;
        };
        Insert: {
          allowed?: boolean;
          deleted_at?: string | null;
          id?: string;
          permission_id: string;
          role_id: string;
        };
        Update: {
          allowed?: boolean;
          deleted_at?: string | null;
          id?: string;
          permission_id?: string;
          role_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "role_permissions_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "role_permissions_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      roles: {
        Row: {
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_basic: boolean;
          name: string;
          organization_id: string | null;
        };
        Insert: {
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_basic?: boolean;
          name: string;
          organization_id?: string | null;
        };
        Update: {
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_basic?: boolean;
          name?: string;
          organization_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "roles_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      scanning_operation_items: {
        Row: {
          code_type: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          location_id: string | null;
          notes: string | null;
          operation_id: string | null;
          quantity: number | null;
          scan_data: Json | null;
          scan_result: string;
          scanned_at: string | null;
          scanned_by: string | null;
          scanned_code: string;
        };
        Insert: {
          code_type: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          location_id?: string | null;
          notes?: string | null;
          operation_id?: string | null;
          quantity?: number | null;
          scan_data?: Json | null;
          scan_result: string;
          scanned_at?: string | null;
          scanned_by?: string | null;
          scanned_code: string;
        };
        Update: {
          code_type?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          location_id?: string | null;
          notes?: string | null;
          operation_id?: string | null;
          quantity?: number | null;
          scan_data?: Json | null;
          scan_result?: string;
          scanned_at?: string | null;
          scanned_by?: string | null;
          scanned_code?: string;
        };
        Relationships: [
          {
            foreignKeyName: "scanning_operation_items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scanning_operation_items_operation_id_fkey";
            columns: ["operation_id"];
            isOneToOne: false;
            referencedRelation: "scanning_operations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scanning_operation_items_scanned_by_fkey";
            columns: ["scanned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      scanning_operations: {
        Row: {
          branch_id: string;
          completed_at: string | null;
          id: string;
          metadata: Json | null;
          operation_name: string;
          operation_status: string | null;
          operation_type: string;
          organization_id: string;
          scanned_items: number | null;
          started_at: string | null;
          started_by: string | null;
          total_items: number | null;
        };
        Insert: {
          branch_id: string;
          completed_at?: string | null;
          id?: string;
          metadata?: Json | null;
          operation_name: string;
          operation_status?: string | null;
          operation_type: string;
          organization_id: string;
          scanned_items?: number | null;
          started_at?: string | null;
          started_by?: string | null;
          total_items?: number | null;
        };
        Update: {
          branch_id?: string;
          completed_at?: string | null;
          id?: string;
          metadata?: Json | null;
          operation_name?: string;
          operation_status?: string | null;
          operation_type?: string;
          organization_id?: string;
          scanned_items?: number | null;
          started_at?: string | null;
          started_by?: string | null;
          total_items?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "scanning_operations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scanning_operations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "scanning_operations_started_by_fkey";
            columns: ["started_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      simple_debug_log: {
        Row: {
          data: Json | null;
          id: number;
          log_time: string | null;
          message: string | null;
        };
        Insert: {
          data?: Json | null;
          id?: number;
          log_time?: string | null;
          message?: string | null;
        };
        Update: {
          data?: Json | null;
          id?: number;
          log_time?: string | null;
          message?: string | null;
        };
        Relationships: [];
      };
      stock_movements: {
        Row: {
          branch_id: string;
          comment: string | null;
          created_at: string | null;
          created_by: string | null;
          from_location_id: string | null;
          id: string;
          movement_type_id: string;
          organization_id: string;
          product_variant_id: string;
          quantity: number;
          to_location_id: string | null;
          transfer_request_id: string | null;
          unit_id: string;
        };
        Insert: {
          branch_id: string;
          comment?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          from_location_id?: string | null;
          id?: string;
          movement_type_id: string;
          organization_id: string;
          product_variant_id: string;
          quantity: number;
          to_location_id?: string | null;
          transfer_request_id?: string | null;
          unit_id: string;
        };
        Update: {
          branch_id?: string;
          comment?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          from_location_id?: string | null;
          id?: string;
          movement_type_id?: string;
          organization_id?: string;
          product_variant_id?: string;
          quantity?: number;
          to_location_id?: string | null;
          transfer_request_id?: string | null;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_transfer_request_id_fkey";
            columns: ["transfer_request_id"];
            isOneToOne: false;
            referencedRelation: "transfer_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      supplier_contacts: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          department: string | null;
          email: string | null;
          first_name: string;
          id: string;
          is_active: boolean | null;
          is_primary: boolean | null;
          last_name: string;
          mobile: string | null;
          notes: string | null;
          phone: string | null;
          position: string | null;
          supplier_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          department?: string | null;
          email?: string | null;
          first_name: string;
          id?: string;
          is_active?: boolean | null;
          is_primary?: boolean | null;
          last_name: string;
          mobile?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          supplier_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          department?: string | null;
          email?: string | null;
          first_name?: string;
          id?: string;
          is_active?: boolean | null;
          is_primary?: boolean | null;
          last_name?: string;
          mobile?: string | null;
          notes?: string | null;
          phone?: string | null;
          position?: string | null;
          supplier_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "supplier_contacts_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      suppliers: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          company_registration_number: string | null;
          country: string | null;
          created_at: string | null;
          deleted_at: string | null;
          delivery_terms: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          notes: string | null;
          organization_id: string;
          payment_terms: string | null;
          postal_code: string | null;
          state_province: string | null;
          tags: string[] | null;
          tax_number: string | null;
          updated_at: string | null;
          website: string | null;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          company_registration_number?: string | null;
          country?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          delivery_terms?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          notes?: string | null;
          organization_id: string;
          payment_terms?: string | null;
          postal_code?: string | null;
          state_province?: string | null;
          tags?: string[] | null;
          tax_number?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          city?: string | null;
          company_registration_number?: string | null;
          country?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          delivery_terms?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          payment_terms?: string | null;
          postal_code?: string | null;
          state_province?: string | null;
          tags?: string[] | null;
          tax_number?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      teams: {
        Row: {
          branch_id: string;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
        };
        Relationships: [
          {
            foreignKeyName: "teams_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
      };
      transfer_request_items: {
        Row: {
          comment: string | null;
          created_at: string | null;
          from_location_id: string | null;
          id: string;
          product_variant_id: string;
          quantity: number;
          to_location_id: string | null;
          transfer_request_id: string;
          unit_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          from_location_id?: string | null;
          id?: string;
          product_variant_id: string;
          quantity: number;
          to_location_id?: string | null;
          transfer_request_id: string;
          unit_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          from_location_id?: string | null;
          id?: string;
          product_variant_id?: string;
          quantity?: number;
          to_location_id?: string | null;
          transfer_request_id?: string;
          unit_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_request_items_transfer_request_id_fkey";
            columns: ["transfer_request_id"];
            isOneToOne: false;
            referencedRelation: "transfer_requests";
            referencedColumns: ["id"];
          },
        ];
      };
      transfer_requests: {
        Row: {
          comment: string | null;
          created_at: string | null;
          from_branch_id: string;
          id: string;
          organization_id: string;
          requested_by: string | null;
          requires_confirmation: boolean;
          reviewed_at: string | null;
          reviewed_by: string | null;
          status: string;
          to_branch_id: string;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          from_branch_id: string;
          id?: string;
          organization_id: string;
          requested_by?: string | null;
          requires_confirmation?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status: string;
          to_branch_id: string;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          from_branch_id?: string;
          id?: string;
          organization_id?: string;
          requested_by?: string | null;
          requires_confirmation?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          status?: string;
          to_branch_id?: string;
        };
        Relationships: [];
      };
      units: {
        Row: {
          category: string;
          created_at: string;
          id: string;
          is_active: boolean;
          label: string;
          name: string;
          precision: number;
        };
        Insert: {
          category: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label: string;
          name: string;
          precision?: number;
        };
        Update: {
          category?: string;
          created_at?: string;
          id?: string;
          is_active?: boolean;
          label?: string;
          name?: string;
          precision?: number;
        };
        Relationships: [];
      };
      user_modules: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          module_id: string;
          setting_overrides: Json | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          module_id: string;
          setting_overrides?: Json | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          module_id?: string;
          setting_overrides?: Json | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_modules_module_id_fkey";
            columns: ["module_id"];
            isOneToOne: false;
            referencedRelation: "modules";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_modules_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_permission_overrides: {
        Row: {
          allowed: boolean;
          deleted_at: string | null;
          id: string;
          permission_id: string;
          scope: string;
          scope_id: string;
          user_id: string;
        };
        Insert: {
          allowed: boolean;
          deleted_at?: string | null;
          id?: string;
          permission_id: string;
          scope: string;
          scope_id: string;
          user_id: string;
        };
        Update: {
          allowed?: boolean;
          deleted_at?: string | null;
          id?: string;
          permission_id?: string;
          scope?: string;
          scope_id?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      user_preferences: {
        Row: {
          created_at: string | null;
          default_branch_id: string | null;
          deleted_at: string | null;
          id: string;
          last_branch_id: string | null;
          organization_id: string | null;
          preferences: Json | null;
          updated_at: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          last_branch_id?: string | null;
          organization_id?: string | null;
          preferences?: Json | null;
          updated_at?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          last_branch_id?: string | null;
          organization_id?: string | null;
          preferences?: Json | null;
          updated_at?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_branch_id_fkey";
            columns: ["default_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_last_branch_id_fkey";
            columns: ["last_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preferences_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: true;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_role_assignments: {
        Row: {
          deleted_at: string | null;
          id: string;
          role_id: string;
          scope: string;
          scope_id: string;
          user_id: string;
        };
        Insert: {
          deleted_at?: string | null;
          id?: string;
          role_id: string;
          scope: string;
          scope_id: string;
          user_id: string;
        };
        Update: {
          deleted_at?: string | null;
          id?: string;
          role_id?: string;
          scope?: string;
          scope_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_role_assignments_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      user_statuses: {
        Row: {
          id: string;
          label: string;
          slug: string;
        };
        Insert: {
          id?: string;
          label: string;
          slug: string;
        };
        Update: {
          id?: string;
          label?: string;
          slug?: string;
        };
        Relationships: [];
      };
      users: {
        Row: {
          created_at: string | null;
          default_branch_id: string | null;
          deleted_at: string | null;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
          status_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          email: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
          status_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          status_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "users_default_branch_id_fkey";
            columns: ["default_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "users_status_id_fkey";
            columns: ["status_id"];
            isOneToOne: false;
            referencedRelation: "user_statuses";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      authorize: {
        Args: {
          branch_id?: string;
          organization_id?: string;
          required_permissions?: string[];
          required_roles?: string[];
          user_id: string;
        };
        Returns: Json;
      };
      custom_access_token_hook: {
        Args: { event: Json };
        Returns: Json;
      };
      debug_roles: {
        Args: { uid: string };
        Returns: Json;
      };
      get_invitation_stats: {
        Args: { org_id: string };
        Returns: Json;
      };
      get_organization_invitations: {
        Args: { org_id: string };
        Returns: {
          accepted_at: string;
          branch: Json;
          branch_id: string;
          created_at: string;
          deleted_at: string;
          email: string;
          expires_at: string;
          id: string;
          invited_by: string;
          organization: Json;
          organization_id: string;
          rejected_at: string;
          role: Json;
          role_id: string;
          status: string;
          token: string;
          updated_at: string;
        }[];
      };
      get_organization_user_stats: {
        Args: { org_id: string };
        Returns: Json;
      };
      get_organization_users: {
        Args: { org_id: string };
        Returns: {
          avatar_url: string;
          branch: Json;
          created_at: string;
          default_branch_id: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          role: Json;
          status_id: string;
        }[];
      };
      get_permissions_for_roles: {
        Args: { role_ids: string[] };
        Returns: {
          slug: string;
        }[];
      };
      get_user_detail: {
        Args: { org_id: string; target_user_id: string };
        Returns: {
          branch: Json;
          created_at: string;
          default_branch_id: string;
          deleted_at: string;
          email: string;
          first_name: string;
          id: string;
          last_name: string;
          permission_overrides: Json;
          roles: Json;
          status_id: string;
        }[];
      };
      get_user_roles: {
        Args: { target_user_id: string };
        Returns: Json;
      };
      get_user_roles_for_hook: {
        Args: { user_uuid: string };
        Returns: Json;
      };
      handle_user_signup_hook: {
        Args: { event: Json };
        Returns: Json;
      };
      test_auth_context: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      test_jwt_claims: {
        Args: Record<PropertyKey, never>;
        Returns: Json;
      };
      user_has_permission: {
        Args: { permission_slug: string; user_id: string };
        Returns: boolean;
      };
    };
    Enums: {
      [_ in never]: never;
    };
    CompositeTypes: {
      [_ in never]: never;
    };
  };
};

type DatabaseWithoutInternals = Omit<Database, "__InternalSupabase">;

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">];

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R;
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
        Row: infer R;
      }
      ? R
      : never
    : never;

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I;
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Insert: infer I;
      }
      ? I
      : never
    : never;

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never,
> = DefaultSchemaTableNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U;
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
    ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
        Update: infer U;
      }
      ? U
      : never
    : never;

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never,
> = DefaultSchemaEnumNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
    ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
    : never;

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals;
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never,
> = PublicCompositeTypeNameOrOptions extends {
  schema: keyof DatabaseWithoutInternals;
}
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
    ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
    : never;

export const Constants = {
  public: {
    Enums: {},
  },
} as const;
