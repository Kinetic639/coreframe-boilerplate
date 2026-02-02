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
          ip_address: unknown;
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
          ip_address?: unknown;
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
          ip_address?: unknown;
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
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
      business_account_contacts: {
        Row: {
          business_account_id: string;
          contact_id: string;
          created_at: string;
          deleted_at: string | null;
          department: string | null;
          id: string;
          is_primary: boolean | null;
          notes: string | null;
          position: string | null;
          updated_at: string;
        };
        Insert: {
          business_account_id: string;
          contact_id: string;
          created_at?: string;
          deleted_at?: string | null;
          department?: string | null;
          id?: string;
          is_primary?: boolean | null;
          notes?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Update: {
          business_account_id?: string;
          contact_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          department?: string | null;
          id?: string;
          is_primary?: boolean | null;
          notes?: string | null;
          position?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "business_account_contacts_business_account_id_fkey";
            columns: ["business_account_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "business_account_contacts_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      business_accounts: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          city: string | null;
          company_registration_number: string | null;
          contact_id: string | null;
          country: string | null;
          created_at: string | null;
          deleted_at: string | null;
          delivery_terms: string | null;
          email: string | null;
          entity_type: string;
          first_name: string | null;
          id: string;
          is_active: boolean | null;
          last_name: string | null;
          name: string;
          notes: string | null;
          organization_id: string;
          partner_type: string;
          payment_terms: string | null;
          phone: string | null;
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
          contact_id?: string | null;
          country?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          delivery_terms?: string | null;
          email?: string | null;
          entity_type?: string;
          first_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_name?: string | null;
          name: string;
          notes?: string | null;
          organization_id: string;
          partner_type?: string;
          payment_terms?: string | null;
          phone?: string | null;
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
          contact_id?: string | null;
          country?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          delivery_terms?: string | null;
          email?: string | null;
          entity_type?: string;
          first_name?: string | null;
          id?: string;
          is_active?: boolean | null;
          last_name?: string | null;
          name?: string;
          notes?: string | null;
          organization_id?: string;
          partner_type?: string;
          payment_terms?: string | null;
          phone?: string | null;
          postal_code?: string | null;
          state_province?: string | null;
          tags?: string[] | null;
          tax_number?: string | null;
          updated_at?: string | null;
          website?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "suppliers_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      chat_participants: {
        Row: {
          branch_id: string;
          chat_id: string;
          id: string;
          is_admin: boolean | null;
          joined_at: string;
          left_at: string | null;
          organization_id: string;
          user_id: string;
        };
        Insert: {
          branch_id: string;
          chat_id: string;
          id?: string;
          is_admin?: boolean | null;
          joined_at?: string;
          left_at?: string | null;
          organization_id: string;
          user_id: string;
        };
        Update: {
          branch_id?: string;
          chat_id?: string;
          id?: string;
          is_admin?: boolean | null;
          joined_at?: string;
          left_at?: string | null;
          organization_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chat_participants_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "chat_participants_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_participants_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_participants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chat_participants_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      chats: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string;
          id: string;
          is_active: boolean | null;
          last_message_at: string | null;
          name: string | null;
          organization_id: string;
          type: string | null;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by: string;
          id?: string;
          is_active?: boolean | null;
          last_message_at?: string | null;
          name?: string | null;
          organization_id: string;
          type?: string | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string;
          id?: string;
          is_active?: boolean | null;
          last_message_at?: string | null;
          name?: string | null;
          organization_id?: string;
          type?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "chats_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "chats_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "chats_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_addresses: {
        Row: {
          address_line_1: string | null;
          address_line_2: string | null;
          address_type: string;
          attention_to: string | null;
          city: string | null;
          contact_id: string;
          country: string | null;
          created_at: string;
          deleted_at: string | null;
          fax_number: string | null;
          id: string;
          is_default: boolean | null;
          phone: string | null;
          postal_code: string | null;
          state_province: string | null;
          updated_at: string;
        };
        Insert: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          address_type?: string;
          attention_to?: string | null;
          city?: string | null;
          contact_id: string;
          country?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          fax_number?: string | null;
          id?: string;
          is_default?: boolean | null;
          phone?: string | null;
          postal_code?: string | null;
          state_province?: string | null;
          updated_at?: string;
        };
        Update: {
          address_line_1?: string | null;
          address_line_2?: string | null;
          address_type?: string;
          attention_to?: string | null;
          city?: string | null;
          contact_id?: string;
          country?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          fax_number?: string | null;
          id?: string;
          is_default?: boolean | null;
          phone?: string | null;
          postal_code?: string | null;
          state_province?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_addresses_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_custom_field_definitions: {
        Row: {
          applies_to: string[] | null;
          created_at: string;
          deleted_at: string | null;
          display_order: number | null;
          field_label: string;
          field_name: string;
          field_options: Json | null;
          field_type: string;
          help_text: string | null;
          id: string;
          is_active: boolean | null;
          is_required: boolean | null;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          applies_to?: string[] | null;
          created_at?: string;
          deleted_at?: string | null;
          display_order?: number | null;
          field_label: string;
          field_name: string;
          field_options?: Json | null;
          field_type: string;
          help_text?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_required?: boolean | null;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          applies_to?: string[] | null;
          created_at?: string;
          deleted_at?: string | null;
          display_order?: number | null;
          field_label?: string;
          field_name?: string;
          field_options?: Json | null;
          field_type?: string;
          help_text?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_required?: boolean | null;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "contact_custom_field_definitions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_custom_field_values: {
        Row: {
          contact_id: string;
          created_at: string;
          field_definition_id: string;
          id: string;
          updated_at: string;
          value_boolean: boolean | null;
          value_date: string | null;
          value_number: number | null;
          value_text: string | null;
        };
        Insert: {
          contact_id: string;
          created_at?: string;
          field_definition_id: string;
          id?: string;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Update: {
          contact_id?: string;
          created_at?: string;
          field_definition_id?: string;
          id?: string;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_custom_field_values_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contact_custom_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "contact_custom_field_definitions";
            referencedColumns: ["id"];
          },
        ];
      };
      contact_documents: {
        Row: {
          contact_id: string;
          deleted_at: string | null;
          description: string | null;
          document_type: string | null;
          file_name: string;
          file_size: number | null;
          file_type: string | null;
          id: string;
          storage_path: string;
          uploaded_at: string;
          uploaded_by: string | null;
        };
        Insert: {
          contact_id: string;
          deleted_at?: string | null;
          description?: string | null;
          document_type?: string | null;
          file_name: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          storage_path: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Update: {
          contact_id?: string;
          deleted_at?: string | null;
          description?: string | null;
          document_type?: string | null;
          file_name?: string;
          file_size?: number | null;
          file_type?: string | null;
          id?: string;
          storage_path?: string;
          uploaded_at?: string;
          uploaded_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contact_documents_contact_id_fkey";
            columns: ["contact_id"];
            isOneToOne: false;
            referencedRelation: "contacts";
            referencedColumns: ["id"];
          },
        ];
      };
      contacts: {
        Row: {
          branch_id: string | null;
          contact_type: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          display_name: string;
          fax: string | null;
          first_name: string | null;
          id: string;
          last_name: string | null;
          mobile_phone: string | null;
          notes: string | null;
          organization_id: string;
          owner_user_id: string | null;
          primary_email: string | null;
          salutation: string | null;
          tags: string[] | null;
          updated_at: string;
          visibility_scope: string;
          website: string | null;
          work_phone: string | null;
        };
        Insert: {
          branch_id?: string | null;
          contact_type?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_name: string;
          fax?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          mobile_phone?: string | null;
          notes?: string | null;
          organization_id: string;
          owner_user_id?: string | null;
          primary_email?: string | null;
          salutation?: string | null;
          tags?: string[] | null;
          updated_at?: string;
          visibility_scope?: string;
          website?: string | null;
          work_phone?: string | null;
        };
        Update: {
          branch_id?: string | null;
          contact_type?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_name?: string;
          fax?: string | null;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
          mobile_phone?: string | null;
          notes?: string | null;
          organization_id?: string;
          owner_user_id?: string | null;
          primary_email?: string | null;
          salutation?: string | null;
          tags?: string[] | null;
          updated_at?: string;
          visibility_scope?: string;
          website?: string | null;
          work_phone?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "contacts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "contacts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "contacts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      context_configurations: {
        Row: {
          access_level: string | null;
          api_enabled: boolean | null;
          color: string | null;
          context_name: string;
          context_type: string | null;
          cors_origins: string[] | null;
          created_at: string | null;
          display_label: Json;
          icon: string | null;
          id: string;
          is_active: boolean | null;
          metadata: Json | null;
          organization_id: string | null;
          rate_limits: Json | null;
          updated_at: string | null;
        };
        Insert: {
          access_level?: string | null;
          api_enabled?: boolean | null;
          color?: string | null;
          context_name: string;
          context_type?: string | null;
          cors_origins?: string[] | null;
          created_at?: string | null;
          display_label: Json;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          organization_id?: string | null;
          rate_limits?: Json | null;
          updated_at?: string | null;
        };
        Update: {
          access_level?: string | null;
          api_enabled?: boolean | null;
          color?: string | null;
          context_name?: string;
          context_type?: string | null;
          cors_origins?: string[] | null;
          created_at?: string | null;
          display_label?: Json;
          icon?: string | null;
          id?: string;
          is_active?: boolean | null;
          metadata?: Json | null;
          organization_id?: string | null;
          rate_limits?: Json | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "context_configurations_organization_id_fkey";
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
      field_visibility_rules: {
        Row: {
          context_config_id: string | null;
          created_at: string | null;
          field_name: string;
          field_transformations: Json | null;
          id: string;
          visibility_level: string | null;
        };
        Insert: {
          context_config_id?: string | null;
          created_at?: string | null;
          field_name: string;
          field_transformations?: Json | null;
          id?: string;
          visibility_level?: string | null;
        };
        Update: {
          context_config_id?: string | null;
          created_at?: string | null;
          field_name?: string;
          field_transformations?: Json | null;
          id?: string;
          visibility_level?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "field_visibility_rules_context_config_id_fkey";
            columns: ["context_config_id"];
            isOneToOne: false;
            referencedRelation: "context_configurations";
            referencedColumns: ["id"];
          },
        ];
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
      label_batches_extended: {
        Row: {
          batch_description: string | null;
          batch_name: string;
          branch_id: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          generated_at: string | null;
          generated_filename: string | null;
          id: string;
          labels_count: number;
          labels_data: Json;
          organization_id: string;
          page_preset: Json;
          pdf_generated: boolean | null;
          pdf_path: string | null;
          pdf_template: Json;
          template_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          batch_description?: string | null;
          batch_name: string;
          branch_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          generated_at?: string | null;
          generated_filename?: string | null;
          id?: string;
          labels_count: number;
          labels_data: Json;
          organization_id: string;
          page_preset: Json;
          pdf_generated?: boolean | null;
          pdf_path?: string | null;
          pdf_template: Json;
          template_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          batch_description?: string | null;
          batch_name?: string;
          branch_id?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          generated_at?: string | null;
          generated_filename?: string | null;
          id?: string;
          labels_count?: number;
          labels_data?: Json;
          organization_id?: string;
          page_preset?: Json;
          pdf_generated?: boolean | null;
          pdf_path?: string | null;
          pdf_template?: Json;
          template_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "label_batches_extended_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "label_batches_extended_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_extended_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_extended_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "label_batches_extended_template_id_fkey";
            columns: ["template_id"];
            isOneToOne: false;
            referencedRelation: "label_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      label_template_fields: {
        Row: {
          background_color: string | null;
          border_color: string | null;
          border_enabled: boolean | null;
          border_width: number | null;
          created_at: string | null;
          deleted_at: string | null;
          field_name: string;
          field_padding_bottom: number | null;
          field_padding_left: number | null;
          field_padding_right: number | null;
          field_padding_top: number | null;
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
          letter_spacing: number | null;
          line_height: number | null;
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
          text_decoration: string | null;
          text_transform: string | null;
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
          field_padding_bottom?: number | null;
          field_padding_left?: number | null;
          field_padding_right?: number | null;
          field_padding_top?: number | null;
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
          letter_spacing?: number | null;
          line_height?: number | null;
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
          text_decoration?: string | null;
          text_transform?: string | null;
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
          field_padding_bottom?: number | null;
          field_padding_left?: number | null;
          field_padding_right?: number | null;
          field_padding_top?: number | null;
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
          letter_spacing?: number | null;
          line_height?: number | null;
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
          text_decoration?: string | null;
          text_transform?: string | null;
          updated_at?: string | null;
          vertical_align?: string | null;
          width_mm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "label_template_fields_label_template_id_fkey";
            columns: ["label_template_id"];
            isOneToOne: false;
            referencedRelation: "label_templates";
            referencedColumns: ["id"];
          },
        ];
      };
      label_templates: {
        Row: {
          additional_info_position: string | null;
          background_color: string | null;
          bleed_mm: number | null;
          border_color: string | null;
          border_enabled: boolean | null;
          border_width: number | null;
          category: string | null;
          created_at: string | null;
          created_by: string | null;
          debug_grid: boolean | null;
          deleted_at: string | null;
          description: string | null;
          dpi: number | null;
          embed_fonts: boolean | null;
          font_family: string | null;
          height_mm: number;
          id: string;
          is_default: boolean | null;
          is_system: boolean | null;
          label_padding_bottom: number | null;
          label_padding_left: number | null;
          label_padding_right: number | null;
          label_padding_top: number | null;
          label_text_position: string | null;
          label_text_size: number | null;
          label_type: string;
          layout_direction: string | null;
          name: string;
          organization_id: string | null;
          orientation: string | null;
          qr_position: string | null;
          qr_size_mm: number | null;
          safe_area_mm: number | null;
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
          bleed_mm?: number | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          debug_grid?: boolean | null;
          deleted_at?: string | null;
          description?: string | null;
          dpi?: number | null;
          embed_fonts?: boolean | null;
          font_family?: string | null;
          height_mm: number;
          id?: string;
          is_default?: boolean | null;
          is_system?: boolean | null;
          label_padding_bottom?: number | null;
          label_padding_left?: number | null;
          label_padding_right?: number | null;
          label_padding_top?: number | null;
          label_text_position?: string | null;
          label_text_size?: number | null;
          label_type: string;
          layout_direction?: string | null;
          name: string;
          organization_id?: string | null;
          orientation?: string | null;
          qr_position?: string | null;
          qr_size_mm?: number | null;
          safe_area_mm?: number | null;
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
          bleed_mm?: number | null;
          border_color?: string | null;
          border_enabled?: boolean | null;
          border_width?: number | null;
          category?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          debug_grid?: boolean | null;
          deleted_at?: string | null;
          description?: string | null;
          dpi?: number | null;
          embed_fonts?: boolean | null;
          font_family?: string | null;
          height_mm?: number;
          id?: string;
          is_default?: boolean | null;
          is_system?: boolean | null;
          label_padding_bottom?: number | null;
          label_padding_left?: number | null;
          label_padding_right?: number | null;
          label_padding_top?: number | null;
          label_text_position?: string | null;
          label_text_size?: number | null;
          label_type?: string;
          layout_direction?: string | null;
          name?: string;
          organization_id?: string | null;
          orientation?: string | null;
          qr_position?: string | null;
          qr_size_mm?: number | null;
          safe_area_mm?: number | null;
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
          branch_id: string;
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
          organization_id: string;
          parent_id: string | null;
          qr_assigned_at: string | null;
          qr_assigned_by: string | null;
          qr_label_id: string | null;
          sort_order: number;
          updated_at: string | null;
        };
        Insert: {
          branch_id: string;
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
          organization_id: string;
          parent_id?: string | null;
          qr_assigned_at?: string | null;
          qr_assigned_by?: string | null;
          qr_label_id?: string | null;
          sort_order?: number;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string;
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
          organization_id?: string;
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
      message_status: {
        Row: {
          branch_id: string;
          id: string;
          message_id: string;
          organization_id: string;
          status: string;
          status_at: string;
          user_id: string;
        };
        Insert: {
          branch_id: string;
          id?: string;
          message_id: string;
          organization_id: string;
          status: string;
          status_at?: string;
          user_id: string;
        };
        Update: {
          branch_id?: string;
          id?: string;
          message_id?: string;
          organization_id?: string;
          status?: string;
          status_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "message_status_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "message_status_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_status_message_id_fkey";
            columns: ["message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_status_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "message_status_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      messages: {
        Row: {
          branch_id: string;
          chat_id: string;
          content: string;
          content_type: string | null;
          created_at: string;
          deleted_at: string | null;
          edited_at: string | null;
          id: string;
          lexical_state: Json | null;
          message_type: string | null;
          organization_id: string;
          reply_to_message_id: string | null;
          sender_id: string;
        };
        Insert: {
          branch_id: string;
          chat_id: string;
          content: string;
          content_type?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          lexical_state?: Json | null;
          message_type?: string | null;
          organization_id: string;
          reply_to_message_id?: string | null;
          sender_id: string;
        };
        Update: {
          branch_id?: string;
          chat_id?: string;
          content?: string;
          content_type?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          edited_at?: string | null;
          id?: string;
          lexical_state?: Json | null;
          message_type?: string | null;
          organization_id?: string;
          reply_to_message_id?: string | null;
          sender_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "messages_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "messages_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_chat_id_fkey";
            columns: ["chat_id"];
            isOneToOne: false;
            referencedRelation: "chats";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_reply_to_message_id_fkey";
            columns: ["reply_to_message_id"];
            isOneToOne: false;
            referencedRelation: "messages";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "messages_sender_id_fkey";
            columns: ["sender_id"];
            isOneToOne: false;
            referencedRelation: "users";
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
          accounting_entry: Json | null;
          affects_stock: number;
          allows_manual_entry: boolean | null;
          category: string | null;
          code: string;
          cost_impact: string | null;
          created_at: string | null;
          creates_reservation: boolean | null;
          deleted_at: string | null;
          deleted_by: string | null;
          description: string | null;
          generates_document: boolean | null;
          id: string;
          is_system: boolean | null;
          metadata: Json | null;
          name: string;
          name_en: string | null;
          name_pl: string | null;
          polish_document_type: string | null;
          requires_approval: boolean | null;
          requires_destination_location: boolean | null;
          requires_movement_request: boolean | null;
          requires_reference: boolean | null;
          requires_source_location: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          accounting_entry?: Json | null;
          affects_stock: number;
          allows_manual_entry?: boolean | null;
          category?: string | null;
          code: string;
          cost_impact?: string | null;
          created_at?: string | null;
          creates_reservation?: boolean | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          generates_document?: boolean | null;
          id?: string;
          is_system?: boolean | null;
          metadata?: Json | null;
          name: string;
          name_en?: string | null;
          name_pl?: string | null;
          polish_document_type?: string | null;
          requires_approval?: boolean | null;
          requires_destination_location?: boolean | null;
          requires_movement_request?: boolean | null;
          requires_reference?: boolean | null;
          requires_source_location?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          accounting_entry?: Json | null;
          affects_stock?: number;
          allows_manual_entry?: boolean | null;
          category?: string | null;
          code?: string;
          cost_impact?: string | null;
          created_at?: string | null;
          creates_reservation?: boolean | null;
          deleted_at?: string | null;
          deleted_by?: string | null;
          description?: string | null;
          generates_document?: boolean | null;
          id?: string;
          is_system?: boolean | null;
          metadata?: Json | null;
          name?: string;
          name_en?: string | null;
          name_pl?: string | null;
          polish_document_type?: string | null;
          requires_approval?: boolean | null;
          requires_destination_location?: boolean | null;
          requires_movement_request?: boolean | null;
          requires_reference?: boolean | null;
          requires_source_location?: boolean | null;
          updated_at?: string | null;
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
      organization_subscriptions: {
        Row: {
          created_at: string | null;
          current_period_end: string;
          current_period_start: string;
          dev_expires_at: string | null;
          id: string;
          is_development: boolean | null;
          organization_id: string | null;
          plan_id: string | null;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_end: string | null;
          trial_start: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_period_end?: string;
          current_period_start?: string;
          dev_expires_at?: string | null;
          id?: string;
          is_development?: boolean | null;
          organization_id?: string | null;
          plan_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_period_end?: string;
          current_period_start?: string;
          dev_expires_at?: string | null;
          id?: string;
          is_development?: boolean | null;
          organization_id?: string | null;
          plan_id?: string | null;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_end?: string | null;
          trial_start?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_subscriptions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_subscriptions_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
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
      price_lists: {
        Row: {
          created_at: string;
          currency_code: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean | null;
          name: string;
          organization_id: string;
          percentage_adjustment: number | null;
          rounding_method: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          currency_code?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name: string;
          organization_id: string;
          percentage_adjustment?: number | null;
          rounding_method?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          currency_code?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean | null;
          name?: string;
          organization_id?: string;
          percentage_adjustment?: number | null;
          rounding_method?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "price_lists_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_barcodes: {
        Row: {
          barcode: string;
          created_at: string | null;
          id: string;
          is_primary: boolean | null;
          product_id: string | null;
          variant_id: string | null;
        };
        Insert: {
          barcode: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          product_id?: string | null;
          variant_id?: string | null;
        };
        Update: {
          barcode?: string;
          created_at?: string | null;
          id?: string;
          is_primary?: boolean | null;
          product_id?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_barcodes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_barcodes_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_branch_settings: {
        Row: {
          branch_id: string;
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          lead_time_days: number | null;
          max_stock_level: number | null;
          min_stock_level: number | null;
          organization_id: string;
          preferred_receiving_location_id: string | null;
          product_id: string;
          reorder_calculation_method: string | null;
          reorder_point: number | null;
          reorder_quantity: number | null;
          send_low_stock_alerts: boolean | null;
          track_inventory: boolean | null;
          updated_at: string | null;
        };
        Insert: {
          branch_id: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          lead_time_days?: number | null;
          max_stock_level?: number | null;
          min_stock_level?: number | null;
          organization_id: string;
          preferred_receiving_location_id?: string | null;
          product_id: string;
          reorder_calculation_method?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          send_low_stock_alerts?: boolean | null;
          track_inventory?: boolean | null;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string;
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          lead_time_days?: number | null;
          max_stock_level?: number | null;
          min_stock_level?: number | null;
          organization_id?: string;
          preferred_receiving_location_id?: string | null;
          product_id?: string;
          reorder_calculation_method?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          send_low_stock_alerts?: boolean | null;
          track_inventory?: boolean | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_branch_settings_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "product_branch_settings_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_branch_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_branch_settings_preferred_receiving_location_id_fkey";
            columns: ["preferred_receiving_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_branch_settings_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_categories: {
        Row: {
          color: string | null;
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          icon_name: string | null;
          id: string;
          is_default: boolean | null;
          is_preferred: boolean | null;
          level: number | null;
          name: string;
          organization_id: string;
          parent_id: string | null;
          sort_order: number | null;
          updated_at: string | null;
        };
        Insert: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          icon_name?: string | null;
          id?: string;
          is_default?: boolean | null;
          is_preferred?: boolean | null;
          level?: number | null;
          name: string;
          organization_id: string;
          parent_id?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Update: {
          color?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          icon_name?: string | null;
          id?: string;
          is_default?: boolean | null;
          is_preferred?: boolean | null;
          level?: number | null;
          name?: string;
          organization_id?: string;
          parent_id?: string | null;
          sort_order?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_categories_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_categories_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
        ];
      };
      product_custom_field_definitions: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          display_order: number | null;
          dropdown_options: Json | null;
          field_name: string;
          field_type: string;
          id: string;
          organization_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          dropdown_options?: Json | null;
          field_name: string;
          field_type: string;
          id?: string;
          organization_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          dropdown_options?: Json | null;
          field_name?: string;
          field_type?: string;
          id?: string;
          organization_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_custom_field_definitions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      product_custom_field_values: {
        Row: {
          created_at: string | null;
          field_definition_id: string;
          id: string;
          product_id: string | null;
          updated_at: string | null;
          value_boolean: boolean | null;
          value_date: string | null;
          value_number: number | null;
          value_text: string | null;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          field_definition_id: string;
          id?: string;
          product_id?: string | null;
          updated_at?: string | null;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          field_definition_id?: string;
          id?: string;
          product_id?: string | null;
          updated_at?: string | null;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_number?: number | null;
          value_text?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_custom_field_values_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "product_custom_field_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_custom_field_values_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_custom_field_values_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_group_attributes: {
        Row: {
          created_at: string | null;
          display_order: number | null;
          id: string;
          option_group_id: string;
          product_id: string;
        };
        Insert: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id: string;
          product_id: string;
        };
        Update: {
          created_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id?: string;
          product_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_group_attributes_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_group_attributes_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
        ];
      };
      product_images: {
        Row: {
          alt_text: string | null;
          created_at: string | null;
          display_order: number | null;
          file_name: string;
          id: string;
          is_primary: boolean | null;
          product_id: string | null;
          storage_path: string;
          variant_id: string | null;
        };
        Insert: {
          alt_text?: string | null;
          created_at?: string | null;
          display_order?: number | null;
          file_name: string;
          id?: string;
          is_primary?: boolean | null;
          product_id?: string | null;
          storage_path: string;
          variant_id?: string | null;
        };
        Update: {
          alt_text?: string | null;
          created_at?: string | null;
          display_order?: number | null;
          file_name?: string;
          id?: string;
          is_primary?: boolean | null;
          product_id?: string | null;
          storage_path?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_images_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_images_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_groups: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          display_order: number | null;
          id: string;
          name: string;
          product_id: string;
          template_group_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          name: string;
          product_id: string;
          template_group_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          name?: string;
          product_id?: string;
          template_group_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_groups_template_group_id_fkey";
            columns: ["template_group_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      product_option_values: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          display_order: number | null;
          id: string;
          product_option_group_id: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          product_option_group_id: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          product_option_group_id?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "product_option_values_product_option_group_id_fkey";
            columns: ["product_option_group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      product_supplier_price_history: {
        Row: {
          change_reason: string | null;
          created_at: string | null;
          created_by: string | null;
          currency_code: string | null;
          effective_date: string;
          end_date: string | null;
          id: string;
          product_supplier_id: string;
          unit_price: number;
        };
        Insert: {
          change_reason?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          effective_date?: string;
          end_date?: string | null;
          id?: string;
          product_supplier_id: string;
          unit_price: number;
        };
        Update: {
          change_reason?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          effective_date?: string;
          end_date?: string | null;
          id?: string;
          product_supplier_id?: string;
          unit_price?: number;
        };
        Relationships: [
          {
            foreignKeyName: "product_supplier_price_history_product_supplier_id_fkey";
            columns: ["product_supplier_id"];
            isOneToOne: false;
            referencedRelation: "product_suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      product_suppliers: {
        Row: {
          allow_partial_package: boolean | null;
          created_at: string | null;
          created_by: string | null;
          currency_code: string | null;
          deleted_at: string | null;
          id: string;
          is_active: boolean | null;
          is_preferred: boolean | null;
          last_order_date: string | null;
          last_order_price: number | null;
          lead_time_days: number | null;
          min_order_qty: number | null;
          min_order_quantity: number | null;
          notes: string | null;
          order_in_multiples_of: number | null;
          order_multiple: number | null;
          package_quantity: number | null;
          package_unit: string | null;
          price_valid_from: string | null;
          price_valid_until: string | null;
          priority_rank: number | null;
          product_id: string;
          supplier_id: string;
          supplier_lead_time_days: number | null;
          supplier_price: number | null;
          supplier_product_description: string | null;
          supplier_product_name: string | null;
          supplier_sku: string | null;
          unit_price: number;
          updated_at: string | null;
        };
        Insert: {
          allow_partial_package?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_preferred?: boolean | null;
          last_order_date?: string | null;
          last_order_price?: number | null;
          lead_time_days?: number | null;
          min_order_qty?: number | null;
          min_order_quantity?: number | null;
          notes?: string | null;
          order_in_multiples_of?: number | null;
          order_multiple?: number | null;
          package_quantity?: number | null;
          package_unit?: string | null;
          price_valid_from?: string | null;
          price_valid_until?: string | null;
          priority_rank?: number | null;
          product_id: string;
          supplier_id: string;
          supplier_lead_time_days?: number | null;
          supplier_price?: number | null;
          supplier_product_description?: string | null;
          supplier_product_name?: string | null;
          supplier_sku?: string | null;
          unit_price: number;
          updated_at?: string | null;
        };
        Update: {
          allow_partial_package?: boolean | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean | null;
          is_preferred?: boolean | null;
          last_order_date?: string | null;
          last_order_price?: number | null;
          lead_time_days?: number | null;
          min_order_qty?: number | null;
          min_order_quantity?: number | null;
          notes?: string | null;
          order_in_multiples_of?: number | null;
          order_multiple?: number | null;
          package_quantity?: number | null;
          package_unit?: string | null;
          price_valid_from?: string | null;
          price_valid_until?: string | null;
          priority_rank?: number | null;
          product_id?: string;
          supplier_id?: string;
          supplier_lead_time_days?: number | null;
          supplier_price?: number | null;
          supplier_product_description?: string | null;
          supplier_product_name?: string | null;
          supplier_sku?: string | null;
          unit_price?: number;
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
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variant_options: {
        Row: {
          created_at: string | null;
          id: string;
          product_option_group_id: string;
          product_option_value_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          product_option_group_id: string;
          product_option_value_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          product_option_group_id?: string;
          product_option_value_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "product_variant_options_product_option_group_id_fkey";
            columns: ["product_option_group_id"];
            isOneToOne: false;
            referencedRelation: "product_option_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "product_variant_options_product_option_value_id_fkey";
            columns: ["product_option_value_id"];
            isOneToOne: false;
            referencedRelation: "product_option_values";
            referencedColumns: ["id"];
          },
        ];
      };
      product_variants: {
        Row: {
          cost_price: number | null;
          created_at: string | null;
          deleted_at: string | null;
          ean: string | null;
          id: string;
          is_active: boolean | null;
          isbn: string | null;
          name: string;
          product_id: string;
          reorder_point: number | null;
          selling_price: number | null;
          sku: string;
          upc: string | null;
          updated_at: string | null;
        };
        Insert: {
          cost_price?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          ean?: string | null;
          id?: string;
          is_active?: boolean | null;
          isbn?: string | null;
          name: string;
          product_id: string;
          reorder_point?: number | null;
          selling_price?: number | null;
          sku: string;
          upc?: string | null;
          updated_at?: string | null;
        };
        Update: {
          cost_price?: number | null;
          created_at?: string | null;
          deleted_at?: string | null;
          ean?: string | null;
          id?: string;
          is_active?: boolean | null;
          isbn?: string | null;
          name?: string;
          product_id?: string;
          reorder_point?: number | null;
          selling_price?: number | null;
          sku?: string;
          upc?: string | null;
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
        ];
      };
      products: {
        Row: {
          brand: string | null;
          category_id: string | null;
          cost_price: number | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          dimensions_height: number | null;
          dimensions_length: number | null;
          dimensions_unit: string | null;
          dimensions_width: number | null;
          ean: string | null;
          id: string;
          inventory_account: string | null;
          isbn: string | null;
          manufacturer: string | null;
          max_stock_level: number | null;
          mpn: string | null;
          name: string;
          opening_stock: number | null;
          opening_stock_rate: number | null;
          organization_id: string;
          preferred_business_account_id: string | null;
          product_type: string;
          purchase_account: string | null;
          purchase_description: string | null;
          reorder_calculation_method: string | null;
          reorder_point: number | null;
          reorder_quantity: number | null;
          returnable_item: boolean | null;
          sales_account: string | null;
          sales_description: string | null;
          selling_price: number | null;
          send_low_stock_alerts: boolean | null;
          sku: string | null;
          status: string | null;
          track_inventory: boolean | null;
          unit: string | null;
          upc: string | null;
          updated_at: string | null;
          weight: number | null;
          weight_unit: string | null;
        };
        Insert: {
          brand?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dimensions_height?: number | null;
          dimensions_length?: number | null;
          dimensions_unit?: string | null;
          dimensions_width?: number | null;
          ean?: string | null;
          id?: string;
          inventory_account?: string | null;
          isbn?: string | null;
          manufacturer?: string | null;
          max_stock_level?: number | null;
          mpn?: string | null;
          name: string;
          opening_stock?: number | null;
          opening_stock_rate?: number | null;
          organization_id: string;
          preferred_business_account_id?: string | null;
          product_type: string;
          purchase_account?: string | null;
          purchase_description?: string | null;
          reorder_calculation_method?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          returnable_item?: boolean | null;
          sales_account?: string | null;
          sales_description?: string | null;
          selling_price?: number | null;
          send_low_stock_alerts?: boolean | null;
          sku?: string | null;
          status?: string | null;
          track_inventory?: boolean | null;
          unit?: string | null;
          upc?: string | null;
          updated_at?: string | null;
          weight?: number | null;
          weight_unit?: string | null;
        };
        Update: {
          brand?: string | null;
          category_id?: string | null;
          cost_price?: number | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dimensions_height?: number | null;
          dimensions_length?: number | null;
          dimensions_unit?: string | null;
          dimensions_width?: number | null;
          ean?: string | null;
          id?: string;
          inventory_account?: string | null;
          isbn?: string | null;
          manufacturer?: string | null;
          max_stock_level?: number | null;
          mpn?: string | null;
          name?: string;
          opening_stock?: number | null;
          opening_stock_rate?: number | null;
          organization_id?: string;
          preferred_business_account_id?: string | null;
          product_type?: string;
          purchase_account?: string | null;
          purchase_description?: string | null;
          reorder_calculation_method?: string | null;
          reorder_point?: number | null;
          reorder_quantity?: number | null;
          returnable_item?: boolean | null;
          sales_account?: string | null;
          sales_description?: string | null;
          selling_price?: number | null;
          send_low_stock_alerts?: boolean | null;
          sku?: string | null;
          status?: string | null;
          track_inventory?: boolean | null;
          unit?: string | null;
          upc?: string | null;
          updated_at?: string | null;
          weight?: number | null;
          weight_unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "products_category_id_fkey";
            columns: ["category_id"];
            isOneToOne: false;
            referencedRelation: "product_categories";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "products_preferred_business_account_id_fkey";
            columns: ["preferred_business_account_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_order_items: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          discount_amount: number | null;
          discount_percent: number | null;
          expected_location_id: string | null;
          id: string;
          line_total: number | null;
          notes: string | null;
          product_id: string | null;
          product_name: string;
          product_sku: string | null;
          product_supplier_id: string | null;
          product_variant_id: string | null;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_pending: number | null;
          quantity_received: number | null;
          subtotal: number | null;
          supplier_sku: string | null;
          tax_amount: number | null;
          tax_rate: number | null;
          unit_of_measure: string | null;
          unit_price: number;
          updated_at: string | null;
          variant_name: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          expected_location_id?: string | null;
          id?: string;
          line_total?: number | null;
          notes?: string | null;
          product_id?: string | null;
          product_name: string;
          product_sku?: string | null;
          product_supplier_id?: string | null;
          product_variant_id?: string | null;
          purchase_order_id: string;
          quantity_ordered: number;
          quantity_pending?: number | null;
          quantity_received?: number | null;
          subtotal?: number | null;
          supplier_sku?: string | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          unit_of_measure?: string | null;
          unit_price: number;
          updated_at?: string | null;
          variant_name?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          expected_location_id?: string | null;
          id?: string;
          line_total?: number | null;
          notes?: string | null;
          product_id?: string | null;
          product_name?: string;
          product_sku?: string | null;
          product_supplier_id?: string | null;
          product_variant_id?: string | null;
          purchase_order_id?: string;
          quantity_ordered?: number;
          quantity_pending?: number | null;
          quantity_received?: number | null;
          subtotal?: number | null;
          supplier_sku?: string | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          unit_of_measure?: string | null;
          unit_price?: number;
          updated_at?: string | null;
          variant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_order_items_expected_location_id_fkey";
            columns: ["expected_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_supplier_id_fkey";
            columns: ["product_supplier_id"];
            isOneToOne: false;
            referencedRelation: "product_suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_order_items_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "purchase_orders_summary";
            referencedColumns: ["id"];
          },
        ];
      };
      purchase_orders: {
        Row: {
          amount_paid: number | null;
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string | null;
          created_by: string | null;
          currency_code: string | null;
          deleted_at: string | null;
          delivery_location_id: string | null;
          discount_amount: number | null;
          expected_delivery_date: string | null;
          id: string;
          internal_notes: string | null;
          notes: string | null;
          organization_id: string;
          payment_status: string | null;
          payment_terms: string | null;
          po_date: string;
          po_number: string;
          shipping_cost: number | null;
          status: string;
          subtotal: number | null;
          supplier_email: string | null;
          supplier_id: string;
          supplier_name: string;
          supplier_phone: string | null;
          supplier_reference: string | null;
          tax_amount: number | null;
          total_amount: number | null;
          tracking_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          amount_paid?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          deleted_at?: string | null;
          delivery_location_id?: string | null;
          discount_amount?: number | null;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          notes?: string | null;
          organization_id: string;
          payment_status?: string | null;
          payment_terms?: string | null;
          po_date?: string;
          po_number: string;
          shipping_cost?: number | null;
          status?: string;
          subtotal?: number | null;
          supplier_email?: string | null;
          supplier_id: string;
          supplier_name: string;
          supplier_phone?: string | null;
          supplier_reference?: string | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          amount_paid?: number | null;
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          deleted_at?: string | null;
          delivery_location_id?: string | null;
          discount_amount?: number | null;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          notes?: string | null;
          organization_id?: string;
          payment_status?: string | null;
          payment_terms?: string | null;
          po_date?: string;
          po_number?: string;
          shipping_cost?: number | null;
          status?: string;
          subtotal?: number | null;
          supplier_email?: string | null;
          supplier_id?: string;
          supplier_name?: string;
          supplier_phone?: string | null;
          supplier_reference?: string | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_delivery_location_id_fkey";
            columns: ["delivery_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
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
          ip_address: unknown;
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
          ip_address?: unknown;
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
          ip_address?: unknown;
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
      receipt_documents: {
        Row: {
          branch_id: string;
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          id: string;
          organization_id: string;
          pz_document_number: string | null;
          pz_document_url: string | null;
          quality_check_passed: boolean | null;
          quality_notes: string | null;
          receipt_date: string;
          receipt_number: string;
          receipt_type: string | null;
          received_by: string | null;
          receiving_notes: string | null;
          status: string | null;
          total_movements: number | null;
          total_value: number | null;
          updated_at: string | null;
        };
        Insert: {
          branch_id: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          organization_id: string;
          pz_document_number?: string | null;
          pz_document_url?: string | null;
          quality_check_passed?: boolean | null;
          quality_notes?: string | null;
          receipt_date?: string;
          receipt_number: string;
          receipt_type?: string | null;
          received_by?: string | null;
          receiving_notes?: string | null;
          status?: string | null;
          total_movements?: number | null;
          total_value?: number | null;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          id?: string;
          organization_id?: string;
          pz_document_number?: string | null;
          pz_document_url?: string | null;
          quality_check_passed?: boolean | null;
          quality_notes?: string | null;
          receipt_date?: string;
          receipt_number?: string;
          receipt_type?: string | null;
          received_by?: string | null;
          receiving_notes?: string | null;
          status?: string | null;
          total_movements?: number | null;
          total_value?: number | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_documents_branch_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "receipt_documents_branch_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_org_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      receipt_movements: {
        Row: {
          created_at: string | null;
          movement_id: string;
          receipt_id: string;
        };
        Insert: {
          created_at?: string | null;
          movement_id: string;
          receipt_id: string;
        };
        Update: {
          created_at?: string | null;
          movement_id?: string;
          receipt_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_movements_movement_id_fkey";
            columns: ["movement_id"];
            isOneToOne: false;
            referencedRelation: "receipt_details";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "receipt_movements_movement_id_fkey";
            columns: ["movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_movements_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipt_details";
            referencedColumns: ["receipt_id"];
          },
          {
            foreignKeyName: "receipt_movements_receipt_id_fkey";
            columns: ["receipt_id"];
            isOneToOne: false;
            referencedRelation: "receipt_documents";
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
          scope_type: string;
        };
        Insert: {
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_basic?: boolean;
          name: string;
          organization_id?: string | null;
          scope_type?: string;
        };
        Update: {
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_basic?: boolean;
          name?: string;
          organization_id?: string | null;
          scope_type?: string;
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
      sales_order_items: {
        Row: {
          created_at: string | null;
          discount_amount: number | null;
          discount_percent: number | null;
          id: string;
          line_total: number | null;
          location_id: string | null;
          notes: string | null;
          product_id: string | null;
          product_name: string;
          product_sku: string | null;
          product_variant_id: string | null;
          quantity_fulfilled: number | null;
          quantity_ordered: number;
          reservation_id: string | null;
          sales_order_id: string;
          subtotal: number | null;
          tax_amount: number | null;
          tax_rate: number | null;
          unit_of_measure: string | null;
          unit_price: number;
          updated_at: string | null;
          variant_name: string | null;
        };
        Insert: {
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          id?: string;
          line_total?: number | null;
          location_id?: string | null;
          notes?: string | null;
          product_id?: string | null;
          product_name: string;
          product_sku?: string | null;
          product_variant_id?: string | null;
          quantity_fulfilled?: number | null;
          quantity_ordered: number;
          reservation_id?: string | null;
          sales_order_id: string;
          subtotal?: number | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          unit_of_measure?: string | null;
          unit_price: number;
          updated_at?: string | null;
          variant_name?: string | null;
        };
        Update: {
          created_at?: string | null;
          discount_amount?: number | null;
          discount_percent?: number | null;
          id?: string;
          line_total?: number | null;
          location_id?: string | null;
          notes?: string | null;
          product_id?: string | null;
          product_name?: string;
          product_sku?: string | null;
          product_variant_id?: string | null;
          quantity_fulfilled?: number | null;
          quantity_ordered?: number;
          reservation_id?: string | null;
          sales_order_id?: string;
          subtotal?: number | null;
          tax_amount?: number | null;
          tax_rate?: number | null;
          unit_of_measure?: string | null;
          unit_price?: number;
          updated_at?: string | null;
          variant_name?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_order_items_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "stock_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_order_items_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
        ];
      };
      sales_orders: {
        Row: {
          branch_id: string | null;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string | null;
          created_by: string | null;
          currency_code: string | null;
          customer_email: string | null;
          customer_id: string | null;
          customer_name: string;
          customer_notes: string | null;
          customer_phone: string | null;
          deleted_at: string | null;
          delivered_date: string | null;
          delivery_address_line1: string | null;
          delivery_address_line2: string | null;
          delivery_city: string | null;
          delivery_country: string | null;
          delivery_postal_code: string | null;
          delivery_state: string | null;
          discount_amount: number | null;
          expected_delivery_date: string | null;
          id: string;
          internal_notes: string | null;
          order_date: string;
          order_number: string;
          organization_id: string;
          shipped_date: string | null;
          shipping_cost: number | null;
          status: string;
          subtotal: number | null;
          tax_amount: number | null;
          total_amount: number | null;
          tracking_number: string | null;
          updated_at: string | null;
        };
        Insert: {
          branch_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name: string;
          customer_notes?: string | null;
          customer_phone?: string | null;
          deleted_at?: string | null;
          delivered_date?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_city?: string | null;
          delivery_country?: string | null;
          delivery_postal_code?: string | null;
          delivery_state?: string | null;
          discount_amount?: number | null;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          order_date?: string;
          order_number: string;
          organization_id: string;
          shipped_date?: string | null;
          shipping_cost?: number | null;
          status?: string;
          subtotal?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
        };
        Update: {
          branch_id?: string | null;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency_code?: string | null;
          customer_email?: string | null;
          customer_id?: string | null;
          customer_name?: string;
          customer_notes?: string | null;
          customer_phone?: string | null;
          deleted_at?: string | null;
          delivered_date?: string | null;
          delivery_address_line1?: string | null;
          delivery_address_line2?: string | null;
          delivery_city?: string | null;
          delivery_country?: string | null;
          delivery_postal_code?: string | null;
          delivery_state?: string | null;
          discount_amount?: number | null;
          expected_delivery_date?: string | null;
          id?: string;
          internal_notes?: string | null;
          order_date?: string;
          order_number?: string;
          organization_id?: string;
          shipped_date?: string | null;
          shipping_cost?: number | null;
          status?: string;
          subtotal?: number | null;
          tax_amount?: number | null;
          total_amount?: number | null;
          tracking_number?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "sales_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "sales_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_customer_id_fkey";
            columns: ["customer_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "sales_orders_organization_id_fkey";
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
      stock_alerts: {
        Row: {
          acknowledged_at: string | null;
          acknowledged_by: string | null;
          alert_type: string;
          available_stock: number;
          branch_id: string;
          calculation_method: string | null;
          calculation_notes: string | null;
          created_at: string | null;
          current_stock: number;
          id: string;
          location_id: string | null;
          notification_sent: boolean | null;
          notification_sent_at: string | null;
          notification_type: string | null;
          organization_id: string;
          product_id: string;
          product_variant_id: string | null;
          quantity_on_hand: number | null;
          reorder_point: number;
          reserved_quantity: number | null;
          resolution_notes: string | null;
          resolved_at: string | null;
          resolved_by: string | null;
          severity: string;
          status: string | null;
          suggested_order_quantity: number | null;
          suggested_packages: number | null;
          suggested_supplier_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_type: string;
          available_stock: number;
          branch_id: string;
          calculation_method?: string | null;
          calculation_notes?: string | null;
          created_at?: string | null;
          current_stock: number;
          id?: string;
          location_id?: string | null;
          notification_sent?: boolean | null;
          notification_sent_at?: string | null;
          notification_type?: string | null;
          organization_id: string;
          product_id: string;
          product_variant_id?: string | null;
          quantity_on_hand?: number | null;
          reorder_point: number;
          reserved_quantity?: number | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity: string;
          status?: string | null;
          suggested_order_quantity?: number | null;
          suggested_packages?: number | null;
          suggested_supplier_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          acknowledged_at?: string | null;
          acknowledged_by?: string | null;
          alert_type?: string;
          available_stock?: number;
          branch_id?: string;
          calculation_method?: string | null;
          calculation_notes?: string | null;
          created_at?: string | null;
          current_stock?: number;
          id?: string;
          location_id?: string | null;
          notification_sent?: boolean | null;
          notification_sent_at?: string | null;
          notification_type?: string | null;
          organization_id?: string;
          product_id?: string;
          product_variant_id?: string | null;
          quantity_on_hand?: number | null;
          reorder_point?: number;
          reserved_quantity?: number | null;
          resolution_notes?: string | null;
          resolved_at?: string | null;
          resolved_by?: string | null;
          severity?: string;
          status?: string | null;
          suggested_order_quantity?: number | null;
          suggested_packages?: number | null;
          suggested_supplier_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_alerts_acknowledged_by_fkey";
            columns: ["acknowledged_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_alerts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_product_variant_id_fkey";
            columns: ["product_variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_resolved_by_fkey";
            columns: ["resolved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_alerts_suggested_supplier_id_fkey";
            columns: ["suggested_supplier_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_movements: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          batch_number: string | null;
          branch_id: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          category: string;
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          currency: string | null;
          deleted_at: string | null;
          destination_location_id: string | null;
          document_generated_at: string | null;
          document_number: string | null;
          document_url: string | null;
          expiry_date: string | null;
          id: string;
          lot_number: string | null;
          manufacturing_date: string | null;
          metadata: Json | null;
          movement_number: string;
          movement_type_code: string;
          notes: string | null;
          occurred_at: string;
          organization_id: string;
          parent_movement_id: string | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_number: string | null;
          reference_type: string | null;
          requires_approval: boolean | null;
          serial_number: string | null;
          source_location_id: string | null;
          status: string;
          total_cost: number | null;
          transfer_request_id: string | null;
          unit_cost: number | null;
          unit_of_measure: string | null;
          updated_at: string | null;
          updated_by: string | null;
          variant_id: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          batch_number?: string | null;
          branch_id: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          category?: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          destination_location_id?: string | null;
          document_generated_at?: string | null;
          document_number?: string | null;
          document_url?: string | null;
          expiry_date?: string | null;
          id?: string;
          lot_number?: string | null;
          manufacturing_date?: string | null;
          metadata?: Json | null;
          movement_number?: string;
          movement_type_code: string;
          notes?: string | null;
          occurred_at?: string;
          organization_id: string;
          parent_movement_id?: string | null;
          product_id: string;
          quantity: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          requires_approval?: boolean | null;
          serial_number?: string | null;
          source_location_id?: string | null;
          status?: string;
          total_cost?: number | null;
          transfer_request_id?: string | null;
          unit_cost?: number | null;
          unit_of_measure?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          variant_id?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          batch_number?: string | null;
          branch_id?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          category?: string;
          completed_at?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          destination_location_id?: string | null;
          document_generated_at?: string | null;
          document_number?: string | null;
          document_url?: string | null;
          expiry_date?: string | null;
          id?: string;
          lot_number?: string | null;
          manufacturing_date?: string | null;
          metadata?: Json | null;
          movement_number?: string;
          movement_type_code?: string;
          notes?: string | null;
          occurred_at?: string;
          organization_id?: string;
          parent_movement_id?: string | null;
          product_id?: string;
          quantity?: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          requires_approval?: boolean | null;
          serial_number?: string | null;
          source_location_id?: string | null;
          status?: string;
          total_cost?: number | null;
          transfer_request_id?: string | null;
          unit_cost?: number | null;
          unit_of_measure?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_movement_type_code_fkey";
            columns: ["movement_type_code"];
            isOneToOne: false;
            referencedRelation: "movement_types";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_parent_movement_id_fkey";
            columns: ["parent_movement_id"];
            isOneToOne: false;
            referencedRelation: "receipt_details";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "stock_movements_parent_movement_id_fkey";
            columns: ["parent_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_transfer_request_id_fkey";
            columns: ["transfer_request_id"];
            isOneToOne: false;
            referencedRelation: "transfer_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_reservations: {
        Row: {
          auto_release: boolean | null;
          branch_id: string;
          cancellation_reason: string | null;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string | null;
          created_by: string | null;
          deleted_at: string | null;
          expires_at: string | null;
          fulfilled_at: string | null;
          fulfilled_by: string | null;
          id: string;
          location_id: string;
          metadata: Json | null;
          notes: string | null;
          organization_id: string;
          priority: number | null;
          product_id: string;
          quantity: number;
          reference_id: string | null;
          reference_number: string | null;
          reference_type: string;
          released_quantity: number;
          reservation_number: string;
          reserved_for: string;
          reserved_quantity: number;
          sales_order_id: string | null;
          sales_order_item_id: string | null;
          status: string;
          updated_at: string | null;
          variant_id: string | null;
        };
        Insert: {
          auto_release?: boolean | null;
          branch_id: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          fulfilled_at?: string | null;
          fulfilled_by?: string | null;
          id?: string;
          location_id: string;
          metadata?: Json | null;
          notes?: string | null;
          organization_id: string;
          priority?: number | null;
          product_id: string;
          quantity: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string;
          released_quantity?: number;
          reservation_number?: string;
          reserved_for: string;
          reserved_quantity?: number;
          sales_order_id?: string | null;
          sales_order_item_id?: string | null;
          status?: string;
          updated_at?: string | null;
          variant_id?: string | null;
        };
        Update: {
          auto_release?: boolean | null;
          branch_id?: string;
          cancellation_reason?: string | null;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string | null;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          fulfilled_at?: string | null;
          fulfilled_by?: string | null;
          id?: string;
          location_id?: string;
          metadata?: Json | null;
          notes?: string | null;
          organization_id?: string;
          priority?: number | null;
          product_id?: string;
          quantity?: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string;
          released_quantity?: number;
          reservation_number?: string;
          reserved_for?: string;
          reserved_quantity?: number;
          sales_order_id?: string | null;
          sales_order_item_id?: string | null;
          status?: string;
          updated_at?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_reservations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_reservations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_fulfilled_by_fkey";
            columns: ["fulfilled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_sales_order_id_fkey";
            columns: ["sales_order_id"];
            isOneToOne: false;
            referencedRelation: "sales_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_reservations_sales_order_item_id_fkey";
            columns: ["sales_order_item_id"];
            isOneToOne: false;
            referencedRelation: "sales_order_items";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_snapshots: {
        Row: {
          average_cost: number | null;
          branch_id: string;
          id: string;
          last_movement_at: string | null;
          last_movement_id: string | null;
          location_id: string;
          organization_id: string;
          product_id: string;
          quantity_available: number | null;
          quantity_on_hand: number;
          quantity_reserved: number;
          total_value: number | null;
          updated_at: string | null;
          variant_id: string | null;
        };
        Insert: {
          average_cost?: number | null;
          branch_id: string;
          id?: string;
          last_movement_at?: string | null;
          last_movement_id?: string | null;
          location_id: string;
          organization_id: string;
          product_id: string;
          quantity_available?: number | null;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          total_value?: number | null;
          updated_at?: string | null;
          variant_id?: string | null;
        };
        Update: {
          average_cost?: number | null;
          branch_id?: string;
          id?: string;
          last_movement_at?: string | null;
          last_movement_id?: string | null;
          location_id?: string;
          organization_id?: string;
          product_id?: string;
          quantity_available?: number | null;
          quantity_on_hand?: number;
          quantity_reserved?: number;
          total_value?: number | null;
          updated_at?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_snapshots_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_snapshots_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_snapshots_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_snapshots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      subscription_plans: {
        Row: {
          created_at: string | null;
          description: Json | null;
          display_name: Json;
          enabled_contexts: string[] | null;
          enabled_modules: string[] | null;
          features: Json | null;
          id: string;
          is_active: boolean | null;
          limits: Json | null;
          name: string;
          price_monthly: number | null;
          price_yearly: number | null;
          sort_order: number | null;
          stripe_product_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          description?: Json | null;
          display_name: Json;
          enabled_contexts?: string[] | null;
          enabled_modules?: string[] | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean | null;
          limits?: Json | null;
          name: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          sort_order?: number | null;
          stripe_product_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          description?: Json | null;
          display_name?: Json;
          enabled_contexts?: string[] | null;
          enabled_modules?: string[] | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean | null;
          limits?: Json | null;
          name?: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          sort_order?: number | null;
          stripe_product_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      subscription_usage: {
        Row: {
          created_at: string | null;
          current_value: number | null;
          feature_key: string;
          id: string;
          organization_id: string | null;
          period_end: string;
          period_start: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          current_value?: number | null;
          feature_key: string;
          id?: string;
          organization_id?: string | null;
          period_end: string;
          period_start: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          current_value?: number | null;
          feature_key?: string;
          id?: string;
          organization_id?: string | null;
          period_end?: string;
          period_start?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "subscription_usage_organization_id_fkey";
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
          item_notes: string | null;
          item_status: string | null;
          product_id: string | null;
          product_variant_id: string;
          quantity: number;
          received_quantity: number | null;
          to_location_id: string | null;
          transfer_request_id: string;
          unit_id: string;
          variant_id: string | null;
        };
        Insert: {
          comment?: string | null;
          created_at?: string | null;
          from_location_id?: string | null;
          id?: string;
          item_notes?: string | null;
          item_status?: string | null;
          product_id?: string | null;
          product_variant_id: string;
          quantity: number;
          received_quantity?: number | null;
          to_location_id?: string | null;
          transfer_request_id: string;
          unit_id: string;
          variant_id?: string | null;
        };
        Update: {
          comment?: string | null;
          created_at?: string | null;
          from_location_id?: string | null;
          id?: string;
          item_notes?: string | null;
          item_status?: string | null;
          product_id?: string | null;
          product_variant_id?: string;
          quantity?: number;
          received_quantity?: number | null;
          to_location_id?: string | null;
          transfer_request_id?: string;
          unit_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_request_items_from_location_id_fkey";
            columns: ["from_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_request_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_request_items_to_location_id_fkey";
            columns: ["to_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_request_items_transfer_request_id_fkey";
            columns: ["transfer_request_id"];
            isOneToOne: false;
            referencedRelation: "transfer_requests";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_request_items_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      transfer_requests: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          carrier: string | null;
          comment: string | null;
          created_at: string | null;
          expected_date: string | null;
          from_branch_id: string;
          id: string;
          metadata: Json | null;
          notes: string | null;
          organization_id: string;
          priority: string | null;
          received_at: string | null;
          received_by: string | null;
          requested_by: string | null;
          requires_confirmation: boolean;
          reviewed_at: string | null;
          reviewed_by: string | null;
          shipped_at: string | null;
          shipped_by: string | null;
          shipping_method: string | null;
          status: string;
          to_branch_id: string;
          tracking_number: string | null;
          transfer_number: string | null;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          carrier?: string | null;
          comment?: string | null;
          created_at?: string | null;
          expected_date?: string | null;
          from_branch_id: string;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          organization_id: string;
          priority?: string | null;
          received_at?: string | null;
          received_by?: string | null;
          requested_by?: string | null;
          requires_confirmation?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shipped_at?: string | null;
          shipped_by?: string | null;
          shipping_method?: string | null;
          status: string;
          to_branch_id: string;
          tracking_number?: string | null;
          transfer_number?: string | null;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          carrier?: string | null;
          comment?: string | null;
          created_at?: string | null;
          expected_date?: string | null;
          from_branch_id?: string;
          id?: string;
          metadata?: Json | null;
          notes?: string | null;
          organization_id?: string;
          priority?: string | null;
          received_at?: string | null;
          received_by?: string | null;
          requested_by?: string | null;
          requires_confirmation?: boolean;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          shipped_at?: string | null;
          shipped_by?: string | null;
          shipping_method?: string | null;
          status?: string;
          to_branch_id?: string;
          tracking_number?: string | null;
          transfer_number?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "transfer_requests_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_from_branch_id_fkey";
            columns: ["from_branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "transfer_requests_from_branch_id_fkey";
            columns: ["from_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_shipped_by_fkey";
            columns: ["shipped_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "transfer_requests_to_branch_id_fkey";
            columns: ["to_branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "transfer_requests_to_branch_id_fkey";
            columns: ["to_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
        ];
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
      units_of_measure: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          organization_id: string;
          symbol: string | null;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          symbol?: string | null;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          symbol?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "units_of_measure_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      user_effective_permissions: {
        Row: {
          compiled_at: string;
          created_at: string;
          id: string;
          organization_id: string;
          permission_slug: string;
          source_id: string | null;
          source_type: string;
          user_id: string;
        };
        Insert: {
          compiled_at?: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          permission_slug: string;
          source_id?: string | null;
          source_type?: string;
          user_id: string;
        };
        Update: {
          compiled_at?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          permission_slug?: string;
          source_id?: string | null;
          source_type?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_effective_permissions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
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
          created_at: string;
          deleted_at: string | null;
          effect: string;
          id: string;
          organization_id: string | null;
          permission_id: string;
          permission_slug: string | null;
          scope: string;
          scope_id: string | null;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          allowed: boolean;
          created_at?: string;
          deleted_at?: string | null;
          effect?: string;
          id?: string;
          organization_id?: string | null;
          permission_id: string;
          permission_slug?: string | null;
          scope: string;
          scope_id?: string | null;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          allowed?: boolean;
          created_at?: string;
          deleted_at?: string | null;
          effect?: string;
          id?: string;
          organization_id?: string | null;
          permission_id?: string;
          permission_slug?: string | null;
          scope?: string;
          scope_id?: string | null;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_permission_overrides_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_permission_overrides_permission_id_fkey";
            columns: ["permission_id"];
            isOneToOne: false;
            referencedRelation: "permissions";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preference_audit: {
        Row: {
          change_type: string;
          changed_by: string | null;
          created_at: string | null;
          id: string;
          ip_address: unknown;
          new_values: Json | null;
          old_values: Json | null;
          user_agent: string | null;
          user_id: string;
        };
        Insert: {
          change_type: string;
          changed_by?: string | null;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          new_values?: Json | null;
          old_values?: Json | null;
          user_agent?: string | null;
          user_id: string;
        };
        Update: {
          change_type?: string;
          changed_by?: string | null;
          created_at?: string | null;
          id?: string;
          ip_address?: unknown;
          new_values?: Json | null;
          old_values?: Json | null;
          user_agent?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preference_audit_changed_by_fkey";
            columns: ["changed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "user_preference_audit_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      user_preferences: {
        Row: {
          created_at: string | null;
          dashboard_settings: Json | null;
          date_format: string | null;
          default_branch_id: string | null;
          deleted_at: string | null;
          display_name: string | null;
          id: string;
          last_branch_id: string | null;
          locale: string | null;
          module_settings: Json | null;
          notification_settings: Json | null;
          organization_id: string | null;
          phone: string | null;
          preferences: Json | null;
          time_format: string | null;
          timezone: string | null;
          updated_at: string | null;
          updated_by: string | null;
          user_id: string;
        };
        Insert: {
          created_at?: string | null;
          dashboard_settings?: Json | null;
          date_format?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          display_name?: string | null;
          id?: string;
          last_branch_id?: string | null;
          locale?: string | null;
          module_settings?: Json | null;
          notification_settings?: Json | null;
          organization_id?: string | null;
          phone?: string | null;
          preferences?: Json | null;
          time_format?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          user_id: string;
        };
        Update: {
          created_at?: string | null;
          dashboard_settings?: Json | null;
          date_format?: string | null;
          default_branch_id?: string | null;
          deleted_at?: string | null;
          display_name?: string | null;
          id?: string;
          last_branch_id?: string | null;
          locale?: string | null;
          module_settings?: Json | null;
          notification_settings?: Json | null;
          organization_id?: string | null;
          phone?: string | null;
          preferences?: Json | null;
          time_format?: string | null;
          timezone?: string | null;
          updated_at?: string | null;
          updated_by?: string | null;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_preferences_default_branch_id_fkey";
            columns: ["default_branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
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
            foreignKeyName: "user_preferences_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
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
          avatar_url: string | null;
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
          avatar_url?: string | null;
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
          avatar_url?: string | null;
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
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
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
      variant_attribute_values: {
        Row: {
          created_at: string | null;
          id: string;
          option_group_id: string;
          option_value_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          option_group_id: string;
          option_value_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          option_group_id?: string;
          option_value_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "variant_attribute_values_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variant_attribute_values_option_value_id_fkey";
            columns: ["option_value_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_values";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "variant_attribute_values_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      variant_option_group_values: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          display_order: number | null;
          id: string;
          option_group_id: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variant_option_group_values_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
      variant_option_groups: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_template: boolean | null;
          name: string;
          organization_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_template?: boolean | null;
          name: string;
          organization_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_template?: boolean | null;
          name?: string;
          organization_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "variant_option_groups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      variant_option_values: {
        Row: {
          created_at: string | null;
          deleted_at: string | null;
          display_order: number | null;
          id: string;
          option_group_id: string;
          updated_at: string | null;
          value: string;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id: string;
          updated_at?: string | null;
          value: string;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          display_order?: number | null;
          id?: string;
          option_group_id?: string;
          updated_at?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "variant_option_values_option_group_id_fkey";
            columns: ["option_group_id"];
            isOneToOne: false;
            referencedRelation: "variant_option_groups";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      branch_stock_summary: {
        Row: {
          avg_locations_per_product: number | null;
          branch_id: string | null;
          branch_name: string | null;
          last_movement_at: string | null;
          organization_id: string | null;
          total_available_quantity: number | null;
          total_inventory_value: number | null;
          total_products: number | null;
          total_quantity_on_hand: number | null;
          total_reserved_quantity: number | null;
          total_variants: number | null;
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
      permission_staleness_report: {
        Row: {
          email: string | null;
          freshness_status: string | null;
          last_compiled_at: string | null;
          membership_status: string | null;
          org_name: string | null;
          permission_count: number | null;
          seconds_since_compile: number | null;
        };
        Relationships: [];
      };
      pg_all_foreign_keys: {
        Row: {
          fk_columns: unknown[] | null;
          fk_constraint_name: unknown;
          fk_schema_name: unknown;
          fk_table_name: unknown;
          fk_table_oid: unknown;
          is_deferrable: boolean | null;
          is_deferred: boolean | null;
          match_type: string | null;
          on_delete: string | null;
          on_update: string | null;
          pk_columns: unknown[] | null;
          pk_constraint_name: unknown;
          pk_index_name: unknown;
          pk_schema_name: unknown;
          pk_table_name: unknown;
          pk_table_oid: unknown;
        };
        Relationships: [];
      };
      product_available_inventory: {
        Row: {
          available_quantity: number | null;
          average_cost: number | null;
          branch_id: string | null;
          last_movement_at: string | null;
          location_id: string | null;
          organization_id: string | null;
          product_id: string | null;
          quantity_on_hand: number | null;
          reserved_quantity: number | null;
          total_movements: number | null;
          total_value: number | null;
          updated_at: string | null;
          variant_id: string | null;
        };
        Relationships: [];
      };
      product_available_inventory_by_branch: {
        Row: {
          active_reservations_count: number | null;
          available_quantity: number | null;
          branch_id: string | null;
          last_movement_at: string | null;
          latest_reservation_expiry: string | null;
          locations_count: number | null;
          organization_id: string | null;
          product_id: string | null;
          quantity_on_hand: number | null;
          reserved_quantity: number | null;
          total_value: number | null;
          variant_id: string | null;
        };
        Relationships: [];
      };
      purchase_orders_summary: {
        Row: {
          amount_paid: number | null;
          branch_id: string | null;
          created_at: string | null;
          created_by: string | null;
          currency_code: string | null;
          expected_delivery_date: string | null;
          id: string | null;
          is_fully_received: boolean | null;
          item_count: number | null;
          organization_id: string | null;
          payment_status: string | null;
          po_date: string | null;
          po_number: string | null;
          status: string | null;
          supplier_id: string | null;
          supplier_name: string | null;
          total_amount: number | null;
          total_quantity_ordered: number | null;
          total_quantity_pending: number | null;
          total_quantity_received: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "business_accounts";
            referencedColumns: ["id"];
          },
        ];
      };
      receipt_details: {
        Row: {
          batch_number: string | null;
          branch_id: string | null;
          completed_at: string | null;
          created_at: string | null;
          created_by: string | null;
          created_by_email: string | null;
          created_by_first_name: string | null;
          created_by_last_name: string | null;
          destination_location_id: string | null;
          expiry_date: string | null;
          movement_id: string | null;
          movement_number: string | null;
          movement_status: string | null;
          movement_type_code: string | null;
          organization_id: string | null;
          parent_movement_id: string | null;
          product_id: string | null;
          pz_document_number: string | null;
          pz_document_url: string | null;
          quality_check_passed: boolean | null;
          quality_notes: string | null;
          quantity: number | null;
          receipt_date: string | null;
          receipt_id: string | null;
          receipt_number: string | null;
          receipt_type: string | null;
          received_by: string | null;
          received_by_email: string | null;
          received_by_first_name: string | null;
          received_by_last_name: string | null;
          receiving_notes: string | null;
          serial_number: string | null;
          source_location_id: string | null;
          status: string | null;
          total_cost: number | null;
          total_movements: number | null;
          total_value: number | null;
          unit: string | null;
          unit_cost: number | null;
          variant_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "receipt_documents_branch_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "receipt_documents_branch_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_org_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "receipt_documents_received_by_fkey";
            columns: ["received_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_movement_type_code_fkey";
            columns: ["movement_type_code"];
            isOneToOne: false;
            referencedRelation: "movement_types";
            referencedColumns: ["code"];
          },
          {
            foreignKeyName: "stock_movements_parent_movement_id_fkey";
            columns: ["parent_movement_id"];
            isOneToOne: false;
            referencedRelation: "receipt_details";
            referencedColumns: ["movement_id"];
          },
          {
            foreignKeyName: "stock_movements_parent_movement_id_fkey";
            columns: ["parent_movement_id"];
            isOneToOne: false;
            referencedRelation: "stock_movements";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_inventory: {
        Row: {
          available_quantity: number | null;
          available_to_promise: number | null;
          average_cost: number | null;
          branch_id: string | null;
          last_movement_at: string | null;
          location_id: string | null;
          organization_id: string | null;
          product_id: string | null;
          reserved_quantity: number | null;
          total_movements: number | null;
          total_value: number | null;
          variant_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      stock_inventory_by_branch: {
        Row: {
          branch_id: string | null;
          last_movement_at: string | null;
          locations_count: number | null;
          organization_id: string | null;
          product_id: string | null;
          quantity_on_hand: number | null;
          total_movements: number | null;
          total_value: number | null;
          variant_id: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branch_stock_summary";
            referencedColumns: ["branch_id"];
          },
          {
            foreignKeyName: "stock_movements_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "stock_movements_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "product_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      tap_funky: {
        Row: {
          args: string | null;
          is_definer: boolean | null;
          is_strict: boolean | null;
          is_visible: boolean | null;
          kind: unknown;
          langoid: unknown;
          name: unknown;
          oid: unknown;
          owner: unknown;
          returns: string | null;
          returns_set: boolean | null;
          schema: unknown;
          volatility: string | null;
        };
        Relationships: [];
      };
    };
    Functions: {
      _cleanup: { Args: never; Returns: boolean };
      _contract_on: { Args: { "": string }; Returns: unknown };
      _currtest: { Args: never; Returns: number };
      _db_privs: { Args: never; Returns: unknown[] };
      _extensions: { Args: never; Returns: unknown[] };
      _get: { Args: { "": string }; Returns: number };
      _get_latest: { Args: { "": string }; Returns: number[] };
      _get_note: { Args: { "": string }; Returns: string };
      _is_verbose: { Args: never; Returns: boolean };
      _prokind: { Args: { p_oid: unknown }; Returns: unknown };
      _query: { Args: { "": string }; Returns: string };
      _refine_vol: { Args: { "": string }; Returns: string };
      _table_privs: { Args: never; Returns: unknown[] };
      _temptypes: { Args: { "": string }; Returns: string };
      _todo: { Args: never; Returns: string };
      adjust_for_packaging: {
        Args: { p_product_supplier_id: string; p_raw_quantity: number };
        Returns: {
          adjusted_quantity: number;
          adjustment_reason: string;
          packages: number;
        }[];
      };
      calculate_current_stock: {
        Args: {
          p_branch_id: string;
          p_location_id: string;
          p_organization_id: string;
          p_product_id: string;
          p_variant_id: string;
        };
        Returns: number;
      };
      calculate_order_quantity: {
        Args: {
          p_branch_id?: string;
          p_product_id: string;
          p_supplier_id?: string;
        };
        Returns: {
          adjusted_quantity: number;
          base_quantity: number;
          calculation_notes: string;
          final_quantity: number;
          package_unit: string;
          packages: number;
        }[];
      };
      calculate_reserved_stock: {
        Args: {
          p_branch_id: string;
          p_location_id: string;
          p_organization_id: string;
          p_product_id: string;
          p_variant_id: string;
        };
        Returns: number;
      };
      cancel_reservation: {
        Args: { p_cancelled_by?: string; p_reservation_id: string };
        Returns: boolean;
      };
      check_product_availability: {
        Args: {
          p_location_id: string;
          p_product_id: string;
          p_quantity: number;
          p_variant_id: string;
        };
        Returns: {
          available_quantity: number;
          is_available: boolean;
          on_hand_quantity: number;
          reserved_quantity: number;
        }[];
      };
      check_stock_availability: {
        Args: {
          p_location_id: string;
          p_product_id: string;
          p_quantity: number;
          p_variant_id: string;
        };
        Returns: boolean;
      };
      check_stock_levels_and_alert: {
        Args: { p_organization_id?: string };
        Returns: {
          alerts_created: number;
          alerts_resolved: number;
          alerts_updated: number;
          notifications_pending: number;
        }[];
      };
      col_is_null:
        | {
            Args: {
              column_name: unknown;
              description?: string;
              schema_name: unknown;
              table_name: unknown;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: unknown;
              description?: string;
              table_name: unknown;
            };
            Returns: string;
          };
      col_not_null:
        | {
            Args: {
              column_name: unknown;
              description?: string;
              schema_name: unknown;
              table_name: unknown;
            };
            Returns: string;
          }
        | {
            Args: {
              column_name: unknown;
              description?: string;
              table_name: unknown;
            };
            Returns: string;
          };
      compare_variants: { Args: { p_variant_ids: string[] }; Returns: Json };
      compile_all_user_permissions: {
        Args: { p_user_id: string };
        Returns: undefined;
      };
      compile_org_permissions: {
        Args: { p_organization_id: string };
        Returns: undefined;
      };
      compile_user_permissions: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: undefined;
      };
      create_direct_chat: {
        Args: { br_id: string; org_id: string; other_user_id: string };
        Returns: string;
      };
      create_sales_order_reservation: {
        Args: {
          p_branch_id: string;
          p_created_by: string;
          p_expires_at?: string;
          p_location_id: string;
          p_organization_id: string;
          p_product_id: string;
          p_quantity: number;
          p_sales_order_id: string;
          p_sales_order_item_id: string;
          p_variant_id: string;
        };
        Returns: string;
      };
      create_stock_movement: {
        Args: {
          p_batch_number?: string;
          p_branch_id: string;
          p_created_by?: string;
          p_currency?: string;
          p_destination_location_id?: string;
          p_expiry_date?: string;
          p_lot_number?: string;
          p_manufacturing_date?: string;
          p_metadata?: Json;
          p_movement_type_code: string;
          p_notes?: string;
          p_occurred_at?: string;
          p_organization_id: string;
          p_product_id: string;
          p_quantity: number;
          p_reference_id?: string;
          p_reference_number?: string;
          p_reference_type?: string;
          p_serial_number?: string;
          p_source_location_id?: string;
          p_unit_cost?: number;
          p_variant_id?: string;
        };
        Returns: string;
      };
      create_variant_batch: {
        Args: { p_product_id: string; p_variants: Json };
        Returns: Json;
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      diag:
        | {
            Args: { msg: unknown };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          }
        | {
            Args: { msg: string };
            Returns: {
              error: true;
            } & "Could not choose the best candidate function between: public.diag(msg => text), public.diag(msg => anyelement). Try renaming the parameters or the function itself in the database so function overloading can be resolved";
          };
      diag_test_name: { Args: { "": string }; Returns: string };
      do_tap: { Args: never; Returns: string[] } | { Args: { "": string }; Returns: string[] };
      expire_old_reservations: { Args: never; Returns: number };
      fail: { Args: never; Returns: string } | { Args: { "": string }; Returns: string };
      findfuncs: { Args: { "": string }; Returns: string[] };
      finish: { Args: { exception_on_failure?: boolean }; Returns: string[] };
      generate_document_number: {
        Args: {
          p_branch_id: string;
          p_organization_id: string;
          p_polish_doc_type: string;
        };
        Returns: string;
      };
      generate_movement_number: {
        Args: { p_movement_type_code: string; p_organization_id: string };
        Returns: string;
      };
      generate_receipt_number: {
        Args: { p_branch_id: string; p_organization_id: string };
        Returns: string;
      };
      generate_transfer_number: {
        Args: { p_branch_id: string; p_date?: string; p_org_id: string };
        Returns: string;
      };
      generate_variant_combinations: {
        Args: { p_matrix: Json; p_options?: Json; p_product_id: string };
        Returns: Json;
      };
      generate_variant_skus: {
        Args: { p_pattern?: string; p_product_id: string };
        Returns: {
          generated_sku: string;
          variant_id: string;
        }[];
      };
      get_alert_summary: {
        Args: { p_organization_id: string };
        Returns: {
          affected_branches: number;
          affected_products: number;
          critical_count: number;
          info_count: number;
          notification_enabled_count: number;
          out_of_stock_count: number;
          pending_notifications: number;
          total_active: number;
          warning_count: number;
        }[];
      };
      get_all_templates_for_org: {
        Args: { p_organization_id?: string };
        Returns: {
          attributes: Json;
          color: string;
          created_at: string;
          description: string;
          icon: string;
          is_system: boolean;
          metadata: Json;
          organization_id: string;
          template_id: string;
          template_name: string;
          template_slug: string;
          updated_at: string;
        }[];
      };
      get_invitation_stats: { Args: { org_id: string }; Returns: Json };
      get_low_stock_by_supplier: {
        Args: { p_organization_id: string };
        Returns: {
          product_count: number;
          products: Json;
          supplier_id: string;
          supplier_name: string;
          total_packages: number;
          total_suggested_quantity: number;
        }[];
      };
      get_movement_types_by_category: {
        Args: { p_category: string };
        Returns: {
          affects_stock: number;
          allows_manual_entry: boolean;
          category: string;
          code: string;
          cost_impact: string;
          generates_document: boolean;
          id: string;
          is_system: boolean;
          name: string;
          name_en: string;
          name_pl: string;
          polish_document_type: string;
          requires_approval: boolean;
          requires_destination_location: boolean;
          requires_reference: boolean;
          requires_source_location: boolean;
        }[];
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
      get_organization_templates: {
        Args: { p_organization_id: string };
        Returns: {
          attributes: Json;
          color: string;
          created_at: string;
          description: string;
          icon: string;
          metadata: Json;
          template_id: string;
          template_name: string;
          template_slug: string;
          updated_at: string;
        }[];
      };
      get_organization_user_stats: { Args: { org_id: string }; Returns: Json };
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
      get_organization_users_mvp: {
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
      get_pending_po_quantity: {
        Args: { p_product_id: string; p_variant_id?: string };
        Returns: number;
      };
      get_permissions_for_roles: {
        Args: { role_ids: string[] };
        Returns: string[];
      };
      get_product_attribute_value: {
        Args: {
          p_attribute_key: string;
          p_context_scope?: string;
          p_locale?: string;
          p_product_id: string;
          p_variant_id?: string;
        };
        Returns: Json;
      };
      get_stock_level: {
        Args: {
          p_branch_id?: string;
          p_location_id?: string;
          p_organization_id?: string;
          p_product_id: string;
          p_variant_id?: string;
        };
        Returns: number;
      };
      get_system_templates: {
        Args: never;
        Returns: {
          attributes: Json;
          color: string;
          created_at: string;
          description: string;
          icon: string;
          metadata: Json;
          template_id: string;
          template_name: string;
          template_slug: string;
          updated_at: string;
        }[];
      };
      get_template_by_id: {
        Args: { p_template_id: string };
        Returns: {
          attributes: Json;
          color: string;
          created_at: string;
          description: string;
          icon: string;
          is_system: boolean;
          metadata: Json;
          organization_id: string;
          parent_template_id: string;
          template_id: string;
          template_name: string;
          template_slug: string;
          updated_at: string;
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
      get_user_roles_for_hook: { Args: { user_uuid: string }; Returns: Json };
      get_variant_performance: {
        Args: { p_date_from?: string; p_date_to?: string; p_product_id: string };
        Returns: {
          current_stock: number;
          last_sale_date: string;
          performance_score: number;
          stock_value: number;
          total_quantity_sold: number;
          total_sales: number;
          variant_id: string;
          variant_name: string;
          variant_sku: string;
        }[];
      };
      get_variant_stock_summary: {
        Args: {
          p_branch_id?: string;
          p_organization_id?: string;
          p_variant_ids?: string[];
        };
        Returns: {
          last_movement_date: string;
          location_count: number;
          total_available: number;
          total_on_hand: number;
          total_reserved: number;
          total_value: number;
          variant_id: string;
          variant_name: string;
          variant_sku: string;
        }[];
      };
      handle_user_signup_hook: { Args: { event: Json }; Returns: Json };
      has_any_org_role: { Args: { org_id: string }; Returns: boolean };
      has_org_role: {
        Args: { org_id: string; role_name: string };
        Returns: boolean;
      };
      has_permission: {
        Args: { org_id: string; permission: string };
        Returns: boolean;
      };
      has_unique: { Args: { "": string }; Returns: string };
      in_todo: { Args: never; Returns: boolean };
      is_empty: { Args: { "": string }; Returns: string };
      is_org_creator: { Args: { org_id: string }; Returns: boolean };
      is_org_member: { Args: { org_id: string }; Returns: boolean };
      isnt_empty: { Args: { "": string }; Returns: string };
      jsonb_deep_merge: { Args: { source: Json; target: Json }; Returns: Json };
      lives_ok: { Args: { "": string }; Returns: string };
      mark_message_read: { Args: { p_message_id: string }; Returns: boolean };
      no_plan: { Args: never; Returns: boolean[] };
      num_failed: { Args: never; Returns: number };
      os_name: { Args: never; Returns: string };
      pass: { Args: never; Returns: string } | { Args: { "": string }; Returns: string };
      pg_version: { Args: never; Returns: string };
      pg_version_num: { Args: never; Returns: number };
      pgtap_version: { Args: never; Returns: number };
      refresh_stock_snapshot: {
        Args: {
          p_branch_id: string;
          p_location_id: string;
          p_organization_id: string;
          p_product_id: string;
          p_variant_id: string;
        };
        Returns: undefined;
      };
      release_reservation: {
        Args: { p_quantity_to_release?: number; p_reservation_id: string };
        Returns: boolean;
      };
      restore_movement_type: {
        Args: { p_movement_type_code: string };
        Returns: boolean;
      };
      runtests: { Args: never; Returns: string[] } | { Args: { "": string }; Returns: string[] };
      send_message: {
        Args: {
          p_chat_id: string;
          p_content: string;
          p_content_type?: string;
          p_lexical_state?: Json;
          p_reply_to_message_id?: string;
        };
        Returns: string;
      };
      skip:
        | { Args: { "": string }; Returns: string }
        | { Args: { how_many: number; why: string }; Returns: string };
      soft_delete_movement_type: {
        Args: { p_deleted_by?: string; p_movement_type_code: string };
        Returns: boolean;
      };
      throws_ok: { Args: { "": string }; Returns: string };
      todo:
        | { Args: { how_many: number }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] }
        | { Args: { why: string }; Returns: boolean[] }
        | { Args: { how_many: number; why: string }; Returns: boolean[] };
      todo_end: { Args: never; Returns: boolean[] };
      todo_start:
        | { Args: never; Returns: boolean[] }
        | { Args: { "": string }; Returns: boolean[] };
      update_variant_pricing: {
        Args: { p_pricing_updates: Json };
        Returns: Json;
      };
      user_has_effective_permission: {
        Args: {
          p_organization_id: string;
          p_permission_slug: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      validate_location_branch: {
        Args: { p_expected_branch_id: string; p_location_id: string };
        Returns: boolean;
      };
      validate_movement_requirements: {
        Args: {
          p_has_destination_location: boolean;
          p_has_reference: boolean;
          p_has_source_location: boolean;
          p_movement_type_code: string;
        };
        Returns: boolean;
      };
    };
    Enums: {
      movement_category: "physical" | "logical" | "adjustment";
    };
    CompositeTypes: {
      _time_trial_type: {
        a_time: number | null;
      };
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
    Enums: {
      movement_category: ["physical", "logical", "adjustment"],
    },
  },
} as const;
