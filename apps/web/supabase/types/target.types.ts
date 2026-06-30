export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
      admin_entitlements: {
        Row: {
          created_at: string;
          enabled: boolean;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [];
      };
      app_attachments: {
        Row: {
          bucket_id: string;
          checksum: string | null;
          content_type: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          deleted_by: string | null;
          file_name: string;
          id: string;
          metadata: Json;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          target_id: string;
          target_type: string;
        };
        Insert: {
          bucket_id?: string;
          checksum?: string | null;
          content_type: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name: string;
          id?: string;
          metadata?: Json;
          org_id: string;
          size_bytes: number;
          storage_path: string;
          target_id: string;
          target_type: string;
        };
        Update: {
          bucket_id?: string;
          checksum?: string | null;
          content_type?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          deleted_by?: string | null;
          file_name?: string;
          id?: string;
          metadata?: Json;
          org_id?: string;
          size_bytes?: number;
          storage_path?: string;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_attachments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_attachments_deleted_by_fkey";
            columns: ["deleted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_attachments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      app_calendar_events: {
        Row: {
          all_day: boolean;
          calendar_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          end_at: string | null;
          end_date: string | null;
          id: string;
          organization_id: string;
          start_at: string | null;
          start_date: string | null;
          timezone: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          all_day?: boolean;
          calendar_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description?: string | null;
          end_at?: string | null;
          end_date?: string | null;
          id?: string;
          organization_id: string;
          start_at?: string | null;
          start_date?: string | null;
          timezone?: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          all_day?: boolean;
          calendar_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          end_at?: string | null;
          end_date?: string | null;
          id?: string;
          organization_id?: string;
          start_at?: string | null;
          start_date?: string | null;
          timezone?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_calendar_events_calendar_id_fkey";
            columns: ["calendar_id"];
            isOneToOne: false;
            referencedRelation: "app_calendars";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendar_events_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendar_events_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendar_events_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_calendar_user_settings: {
        Row: {
          calendar_key: string;
          color: string | null;
          created_at: string;
          organization_id: string;
          position: number | null;
          updated_at: string;
          user_id: string;
          visible: boolean | null;
        };
        Insert: {
          calendar_key: string;
          color?: string | null;
          created_at?: string;
          organization_id: string;
          position?: number | null;
          updated_at?: string;
          user_id: string;
          visible?: boolean | null;
        };
        Update: {
          calendar_key?: string;
          color?: string | null;
          created_at?: string;
          organization_id?: string;
          position?: number | null;
          updated_at?: string;
          user_id?: string;
          visible?: boolean | null;
        };
        Relationships: [
          {
            foreignKeyName: "app_calendar_user_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendar_user_settings_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_calendars: {
        Row: {
          created_at: string;
          created_by: string;
          default_color: string;
          deleted_at: string | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
          updated_by: string | null;
          visibility: string;
        };
        Insert: {
          created_at?: string;
          created_by: string;
          default_color?: string;
          deleted_at?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string;
          default_color?: string;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_calendars_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendars_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_calendars_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_comment_events: {
        Row: {
          actor_id: string | null;
          comment_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          org_id: string;
          payload: Json;
          target_id: string;
          target_type: string;
        };
        Insert: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          org_id: string;
          payload?: Json;
          target_id: string;
          target_type: string;
        };
        Update: {
          actor_id?: string | null;
          comment_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          org_id?: string;
          payload?: Json;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_comment_events_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_comment_events_comment_id_fkey";
            columns: ["comment_id"];
            isOneToOne: false;
            referencedRelation: "app_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_comment_events_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      app_comments: {
        Row: {
          body_plain: string;
          body_rich: Json | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          kind: string;
          metadata: Json;
          org_id: string;
          parent_comment_id: string | null;
          target_id: string;
          target_type: string;
          updated_at: string;
          updated_by: string | null;
          visibility: string;
        };
        Insert: {
          body_plain: string;
          body_rich?: Json | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          metadata?: Json;
          org_id: string;
          parent_comment_id?: string | null;
          target_id: string;
          target_type: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Update: {
          body_plain?: string;
          body_rich?: Json | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          kind?: string;
          metadata?: Json;
          org_id?: string;
          parent_comment_id?: string | null;
          target_id?: string;
          target_type?: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "app_comments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_comments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_comments_parent_comment_id_fkey";
            columns: ["parent_comment_id"];
            isOneToOne: false;
            referencedRelation: "app_comments";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "app_comments_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      app_config: {
        Row: {
          announcement_banner_enabled: boolean;
          dev_mode_enabled: boolean;
          id: number;
          pricing_page_enabled: boolean;
          registration_enabled: boolean;
          updated_at: string;
        };
        Insert: {
          announcement_banner_enabled?: boolean;
          dev_mode_enabled?: boolean;
          id?: number;
          pricing_page_enabled?: boolean;
          registration_enabled?: boolean;
          updated_at?: string;
        };
        Update: {
          announcement_banner_enabled?: boolean;
          dev_mode_enabled?: boolean;
          id?: number;
          pricing_page_enabled?: boolean;
          registration_enabled?: boolean;
          updated_at?: string;
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
          public_warehouse_maps_enabled: boolean;
          slug: string | null;
        };
        Insert: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          public_warehouse_maps_enabled?: boolean;
          slug?: string | null;
        };
        Update: {
          created_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          public_warehouse_maps_enabled?: boolean;
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
      helpdesk_settings: {
        Row: {
          auto_close_days: number | null;
          created_at: string;
          default_priority: string;
          email_notifications: boolean;
          org_id: string;
          priority_configs: Json | null;
          status_configs: Json | null;
          ticket_prefix: string;
          updated_at: string;
        };
        Insert: {
          auto_close_days?: number | null;
          created_at?: string;
          default_priority?: string;
          email_notifications?: boolean;
          org_id: string;
          priority_configs?: Json | null;
          status_configs?: Json | null;
          ticket_prefix?: string;
          updated_at?: string;
        };
        Update: {
          auto_close_days?: number | null;
          created_at?: string;
          default_priority?: string;
          email_notifications?: boolean;
          org_id?: string;
          priority_configs?: Json | null;
          status_configs?: Json | null;
          ticket_prefix?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_settings_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_acceptors: {
        Row: {
          added_at: string;
          added_by: string | null;
          id: string;
          org_id: string;
          ticket_id: string;
          user_id: string;
        };
        Insert: {
          added_at?: string;
          added_by?: string | null;
          id?: string;
          org_id: string;
          ticket_id: string;
          user_id: string;
        };
        Update: {
          added_at?: string;
          added_by?: string | null;
          id?: string;
          org_id?: string;
          ticket_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_acceptors_added_by_fkey";
            columns: ["added_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_acceptors_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_acceptors_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_acceptors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_activity: {
        Row: {
          actor_id: string | null;
          created_at: string;
          event_type: string;
          id: string;
          org_id: string;
          payload: Json | null;
          ticket_id: string;
        };
        Insert: {
          actor_id?: string | null;
          created_at?: string;
          event_type: string;
          id?: string;
          org_id: string;
          payload?: Json | null;
          ticket_id: string;
        };
        Update: {
          actor_id?: string | null;
          created_at?: string;
          event_type?: string;
          id?: string;
          org_id?: string;
          payload?: Json | null;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_activity_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_activity_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_activity_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_assignees: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          completed_at: string | null;
          deleted_at: string | null;
          id: string;
          org_id: string;
          responded_at: string | null;
          role: string;
          status: string;
          ticket_id: string;
          user_id: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id: string;
          responded_at?: string | null;
          role?: string;
          status?: string;
          ticket_id: string;
          user_id: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          completed_at?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id?: string;
          responded_at?: string | null;
          role?: string;
          status?: string;
          ticket_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_assignees_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_assignees_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_assignees_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_tickets";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_assignees_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_comments: {
        Row: {
          body: string;
          body_rich: Json | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          id: string;
          is_internal: boolean;
          org_id: string;
          ticket_id: string;
          updated_at: string;
        };
        Insert: {
          body: string;
          body_rich?: Json | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          id?: string;
          is_internal?: boolean;
          org_id: string;
          ticket_id: string;
          updated_at?: string;
        };
        Update: {
          body?: string;
          body_rich?: Json | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          id?: string;
          is_internal?: boolean;
          org_id?: string;
          ticket_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_comments_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_comments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_comments_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_references: {
        Row: {
          context_snapshot: Json | null;
          created_at: string;
          created_by: string | null;
          id: string;
          source_id: string;
          source_module: string;
          source_type: string;
          ticket_id: string;
        };
        Insert: {
          context_snapshot?: Json | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source_id: string;
          source_module: string;
          source_type: string;
          ticket_id: string;
        };
        Update: {
          context_snapshot?: Json | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          source_id?: string;
          source_module?: string;
          source_type?: string;
          ticket_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_references_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_references_ticket_id_fkey";
            columns: ["ticket_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_tickets";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_type_acceptors: {
        Row: {
          created_at: string;
          created_by: string | null;
          id: string;
          org_id: string;
          ticket_type_id: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id: string;
          ticket_type_id: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          id?: string;
          org_id?: string;
          ticket_type_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_type_acceptors_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_acceptors_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_acceptors_ticket_type_id_fkey";
            columns: ["ticket_type_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_ticket_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_acceptors_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_type_default_responders: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          org_id: string;
          responder_user_id: string;
          ticket_type_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id: string;
          responder_user_id: string;
          ticket_type_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id?: string;
          responder_user_id?: string;
          ticket_type_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_type_default_responders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_default_responders_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_default_responders_responder_user_id_fkey";
            columns: ["responder_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_type_default_responders_ticket_type_id_fkey";
            columns: ["ticket_type_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_ticket_types";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_ticket_types: {
        Row: {
          allows_manual_assignees: boolean;
          branch_id: string | null;
          color: string;
          created_at: string;
          created_by: string | null;
          default_priority: string;
          deleted_at: string | null;
          description: string | null;
          icon: string;
          id: string;
          is_active: boolean;
          is_system: boolean;
          key: string | null;
          metadata: Json | null;
          name: string;
          org_id: string;
          requires_acceptance: boolean;
          scope: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          allows_manual_assignees?: boolean;
          branch_id?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          default_priority?: string;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          key?: string | null;
          metadata?: Json | null;
          name: string;
          org_id: string;
          requires_acceptance?: boolean;
          scope?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          allows_manual_assignees?: boolean;
          branch_id?: string | null;
          color?: string;
          created_at?: string;
          created_by?: string | null;
          default_priority?: string;
          deleted_at?: string | null;
          description?: string | null;
          icon?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          key?: string | null;
          metadata?: Json | null;
          name?: string;
          org_id?: string;
          requires_acceptance?: boolean;
          scope?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_ticket_types_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_types_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_ticket_types_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      helpdesk_tickets: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          assigned_to: string | null;
          branch_id: string | null;
          closed_at: string | null;
          closed_by: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          description_plain: string | null;
          description_rich: Json | null;
          due_at: string | null;
          due_date: string | null;
          id: string;
          org_id: string;
          priority: string;
          requested_by: string | null;
          requires_acceptance: boolean;
          resolved_at: string | null;
          status: string;
          ticket_number: string;
          ticket_type_id: string | null;
          title: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          assigned_to?: string | null;
          branch_id?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description?: string | null;
          description_plain?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          org_id: string;
          priority?: string;
          requested_by?: string | null;
          requires_acceptance?: boolean;
          resolved_at?: string | null;
          status?: string;
          ticket_number: string;
          ticket_type_id?: string | null;
          title: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          assigned_to?: string | null;
          branch_id?: string | null;
          closed_at?: string | null;
          closed_by?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          description_plain?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          org_id?: string;
          priority?: string;
          requested_by?: string | null;
          requires_acceptance?: boolean;
          resolved_at?: string | null;
          status?: string;
          ticket_number?: string;
          ticket_type_id?: string | null;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "helpdesk_tickets_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_closed_by_fkey";
            columns: ["closed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_requested_by_fkey";
            columns: ["requested_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "helpdesk_tickets_ticket_type_id_fkey";
            columns: ["ticket_type_id"];
            isOneToOne: false;
            referencedRelation: "helpdesk_ticket_types";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_allocation_lines: {
        Row: {
          allocated_quantity: number;
          allocation_id: string;
          branch_id: string;
          created_at: string;
          fulfilled_quantity: number;
          id: string;
          location_id: string;
          lot_id: string | null;
          organization_id: string;
          product_id: string;
          reservation_line_id: string | null;
          serial_id: string | null;
          variant_id: string;
        };
        Insert: {
          allocated_quantity: number;
          allocation_id: string;
          branch_id: string;
          created_at?: string;
          fulfilled_quantity?: number;
          id?: string;
          location_id: string;
          lot_id?: string | null;
          organization_id: string;
          product_id: string;
          reservation_line_id?: string | null;
          serial_id?: string | null;
          variant_id: string;
        };
        Update: {
          allocated_quantity?: number;
          allocation_id?: string;
          branch_id?: string;
          created_at?: string;
          fulfilled_quantity?: number;
          id?: string;
          location_id?: string;
          lot_id?: string | null;
          organization_id?: string;
          product_id?: string;
          reservation_line_id?: string | null;
          serial_id?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_allocation_lines_allocation_id_fkey";
            columns: ["allocation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_allocations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_reservation_line_id_fkey";
            columns: ["reservation_line_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservation_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_serial_id_fkey";
            columns: ["serial_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_allocation_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_allocations: {
        Row: {
          allocation_number: string;
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          organization_id: string;
          reference_id: string | null;
          reference_number: string | null;
          reference_type: string | null;
          reservation_id: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          allocation_number: string;
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          organization_id: string;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          reservation_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          allocation_number?: string;
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          organization_id?: string;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          reservation_id?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_allocations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_allocations_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_balances: {
        Row: {
          allocated_quantity: number;
          available_quantity: number | null;
          blocked: number;
          branch_id: string;
          consignment: number;
          id: string;
          last_movement_at: string | null;
          last_movement_id: string | null;
          location_id: string;
          lot_id: string | null;
          on_hand_quantity: number;
          organization_id: string;
          reserved_quantity: number;
          serial_id: string | null;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          allocated_quantity?: number;
          available_quantity?: number | null;
          blocked?: number;
          branch_id: string;
          consignment?: number;
          id?: string;
          last_movement_at?: string | null;
          last_movement_id?: string | null;
          location_id: string;
          lot_id?: string | null;
          on_hand_quantity?: number;
          organization_id: string;
          reserved_quantity?: number;
          serial_id?: string | null;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          allocated_quantity?: number;
          available_quantity?: number | null;
          blocked?: number;
          branch_id?: string;
          consignment?: number;
          id?: string;
          last_movement_at?: string | null;
          last_movement_id?: string | null;
          location_id?: string;
          lot_id?: string | null;
          on_hand_quantity?: number;
          organization_id?: string;
          reserved_quantity?: number;
          serial_id?: string | null;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_balances_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_balances_branch_org_fk";
            columns: ["branch_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_balances_last_movement_id_fkey";
            columns: ["last_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_balances_location_fk";
            columns: ["location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_balances_lot_id_fkey";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_balances_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_balances_serial_id_fkey";
            columns: ["serial_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_balances_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_branch_transfer_lines: {
        Row: {
          created_at: string;
          destination_location_id: string | null;
          id: string;
          lot_id: string | null;
          organization_id: string;
          quantity: number;
          serial_id: string | null;
          source_location_id: string;
          transfer_id: string;
          unit_id: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          destination_location_id?: string | null;
          id?: string;
          lot_id?: string | null;
          organization_id: string;
          quantity: number;
          serial_id?: string | null;
          source_location_id: string;
          transfer_id: string;
          unit_id: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          destination_location_id?: string | null;
          id?: string;
          lot_id?: string | null;
          organization_id?: string;
          quantity?: number;
          serial_id?: string | null;
          source_location_id?: string;
          transfer_id?: string;
          unit_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_branch_transfer_lines_destination_location_id_fkey";
            columns: ["destination_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_serial_id_fkey";
            columns: ["serial_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_source_location_id_fkey";
            columns: ["source_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_transfer_id_fkey";
            columns: ["transfer_id"];
            isOneToOne: false;
            referencedRelation: "inventory_branch_transfers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_transfer_org_fkey";
            columns: ["transfer_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_branch_transfers";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_branch_transfer_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_branch_transfers: {
        Row: {
          accepted_at: string | null;
          accepted_by: string | null;
          created_at: string;
          decline_reason: string | null;
          declined_at: string | null;
          declined_by: string | null;
          deleted_at: string | null;
          destination_branch_id: string;
          destination_movement_id: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          reservation_id: string | null;
          return_movement_id: string | null;
          sent_at: string | null;
          sent_by: string | null;
          source_branch_id: string;
          source_movement_id: string | null;
          status: string;
          transfer_number: string;
          updated_at: string;
        };
        Insert: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          decline_reason?: string | null;
          declined_at?: string | null;
          declined_by?: string | null;
          deleted_at?: string | null;
          destination_branch_id: string;
          destination_movement_id?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          reservation_id?: string | null;
          return_movement_id?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          source_branch_id: string;
          source_movement_id?: string | null;
          status?: string;
          transfer_number: string;
          updated_at?: string;
        };
        Update: {
          accepted_at?: string | null;
          accepted_by?: string | null;
          created_at?: string;
          decline_reason?: string | null;
          declined_at?: string | null;
          declined_by?: string | null;
          deleted_at?: string | null;
          destination_branch_id?: string;
          destination_movement_id?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          reservation_id?: string | null;
          return_movement_id?: string | null;
          sent_at?: string | null;
          sent_by?: string | null;
          source_branch_id?: string;
          source_movement_id?: string | null;
          status?: string;
          transfer_number?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_branch_transfers_accepted_by_fkey";
            columns: ["accepted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_declined_by_fkey";
            columns: ["declined_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_destination_branch_id_fkey";
            columns: ["destination_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_destination_movement_id_fkey";
            columns: ["destination_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_return_movement_id_fkey";
            columns: ["return_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_sent_by_fkey";
            columns: ["sent_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_source_branch_id_fkey";
            columns: ["source_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_branch_transfers_source_movement_id_fkey";
            columns: ["source_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_brands: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_brands_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_brands_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_brands_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_collection_items: {
        Row: {
          collection_id: string;
          created_at: string;
          created_by: string | null;
          organization_id: string;
          product_id: string;
          updated_at: string;
        };
        Insert: {
          collection_id: string;
          created_at?: string;
          created_by?: string | null;
          organization_id: string;
          product_id: string;
          updated_at?: string;
        };
        Update: {
          collection_id?: string;
          created_at?: string;
          created_by?: string | null;
          organization_id?: string;
          product_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_collection_items_collection_id_fkey";
            columns: ["collection_id"];
            isOneToOne: false;
            referencedRelation: "inventory_collections";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_collection_items_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_collection_items_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_collection_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_collection_items_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_collections: {
        Row: {
          collection_type: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          filter_json: Json | null;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          collection_type?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          filter_json?: Json | null;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          collection_type?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          filter_json?: Json | null;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_collections_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_collections_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_container_lines: {
        Row: {
          branch_id: string;
          container_id: string;
          created_at: string;
          deleted_at: string | null;
          id: string;
          lot_id: string | null;
          organization_id: string;
          quantity: number;
          serial_id: string | null;
          unit_id: string;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          container_id: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lot_id?: string | null;
          organization_id: string;
          quantity: number;
          serial_id?: string | null;
          unit_id: string;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          container_id?: string;
          created_at?: string;
          deleted_at?: string | null;
          id?: string;
          lot_id?: string | null;
          organization_id?: string;
          quantity?: number;
          serial_id?: string | null;
          unit_id?: string;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_container_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_container_lines_container_fk";
            columns: ["container_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "inventory_containers";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_container_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_container_lines_unit_fk";
            columns: ["unit_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_container_lines_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_containers: {
        Row: {
          branch_id: string;
          code: string;
          created_at: string;
          created_by: string | null;
          current_location_id: string;
          deleted_at: string | null;
          id: string;
          organization_id: string;
          reference_id: string | null;
          reference_type: string | null;
          status: string;
          type: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_id: string;
          code: string;
          created_at?: string;
          created_by?: string | null;
          current_location_id: string;
          deleted_at?: string | null;
          id?: string;
          organization_id: string;
          reference_id?: string | null;
          reference_type?: string | null;
          status?: string;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_id?: string;
          code?: string;
          created_at?: string;
          created_by?: string | null;
          current_location_id?: string;
          deleted_at?: string | null;
          id?: string;
          organization_id?: string;
          reference_id?: string | null;
          reference_type?: string | null;
          status?: string;
          type?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_containers_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_containers_branch_org_fk";
            columns: ["branch_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_containers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_containers_current_location_fk";
            columns: ["current_location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_containers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_containers_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_count_lines: {
        Row: {
          branch_id: string;
          count_session_id: string;
          counted_at: string | null;
          counted_by: string | null;
          counted_quantity: number | null;
          created_at: string;
          expected_quantity: number;
          id: string;
          location_id: string;
          lot_id: string | null;
          note: string | null;
          organization_id: string;
          serial_id: string | null;
          unit_id: string;
          updated_at: string;
          variance_quantity: number | null;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          count_session_id: string;
          counted_at?: string | null;
          counted_by?: string | null;
          counted_quantity?: number | null;
          created_at?: string;
          expected_quantity?: number;
          id?: string;
          location_id: string;
          lot_id?: string | null;
          note?: string | null;
          organization_id: string;
          serial_id?: string | null;
          unit_id: string;
          updated_at?: string;
          variance_quantity?: number | null;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          count_session_id?: string;
          counted_at?: string | null;
          counted_by?: string | null;
          counted_quantity?: number | null;
          created_at?: string;
          expected_quantity?: number;
          id?: string;
          location_id?: string;
          lot_id?: string | null;
          note?: string | null;
          organization_id?: string;
          serial_id?: string | null;
          unit_id?: string;
          updated_at?: string;
          variance_quantity?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_count_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_count_session_id_fkey";
            columns: ["count_session_id"];
            isOneToOne: false;
            referencedRelation: "inventory_count_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_counted_by_fkey";
            columns: ["counted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_serial_id_fkey";
            columns: ["serial_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_count_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_count_sessions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string;
          count_number: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          scope: Json;
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id: string;
          count_number: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          scope?: Json;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string;
          count_number?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          scope?: Json;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_count_sessions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_sessions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_count_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_custom_field_values: {
        Row: {
          created_at: string;
          created_by: string | null;
          field_id: string;
          id: string;
          lot_id: string | null;
          organization_id: string;
          product_id: string | null;
          serial_id: string | null;
          updated_at: string;
          value_boolean: boolean | null;
          value_date: string | null;
          value_json: Json | null;
          value_number: number | null;
          value_text: string | null;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          field_id: string;
          id?: string;
          lot_id?: string | null;
          organization_id: string;
          product_id?: string | null;
          serial_id?: string | null;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_json?: Json | null;
          value_number?: number | null;
          value_text?: string | null;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          field_id?: string;
          id?: string;
          lot_id?: string | null;
          organization_id?: string;
          product_id?: string | null;
          serial_id?: string | null;
          updated_at?: string;
          value_boolean?: boolean | null;
          value_date?: string | null;
          value_json?: Json | null;
          value_number?: number | null;
          value_text?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_custom_field_values_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_field_id_fkey";
            columns: ["field_id"];
            isOneToOne: false;
            referencedRelation: "inventory_custom_fields";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_serial_id_fkey";
            columns: ["serial_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_custom_field_values_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_custom_fields: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          display_order: number;
          entity_type: string;
          field_key: string;
          field_type: string;
          help_text: string | null;
          id: string;
          is_filterable: boolean;
          is_required: boolean;
          name: string;
          options: Json;
          organization_id: string;
          placeholder: string | null;
          section_name: string | null;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          entity_type: string;
          field_key: string;
          field_type: string;
          help_text?: string | null;
          id?: string;
          is_filterable?: boolean;
          is_required?: boolean;
          name: string;
          options?: Json;
          organization_id: string;
          placeholder?: string | null;
          section_name?: string | null;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          entity_type?: string;
          field_key?: string;
          field_type?: string;
          help_text?: string | null;
          id?: string;
          is_filterable?: boolean;
          is_required?: boolean;
          name?: string;
          options?: Json;
          organization_id?: string;
          placeholder?: string | null;
          section_name?: string | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_custom_fields_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_custom_fields_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_document_sequences: {
        Row: {
          branch_id: string | null;
          document_type_id: string;
          id: string;
          next_number: number;
          organization_id: string;
          series: string | null;
          year: number;
        };
        Insert: {
          branch_id?: string | null;
          document_type_id: string;
          id?: string;
          next_number?: number;
          organization_id: string;
          series?: string | null;
          year: number;
        };
        Update: {
          branch_id?: string | null;
          document_type_id?: string;
          id?: string;
          next_number?: number;
          organization_id?: string;
          series?: string | null;
          year?: number;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_document_sequences_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_document_sequences_document_type_id_fkey";
            columns: ["document_type_id"];
            isOneToOne: false;
            referencedRelation: "inventory_document_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_document_sequences_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_document_types: {
        Row: {
          category: string;
          code: string;
          corrects_document_type_code: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          is_correction: boolean;
          is_system: boolean;
          name: string;
          name_en: string | null;
          name_pl: string | null;
          numbering_template: string;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          category: string;
          code: string;
          corrects_document_type_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_correction?: boolean;
          is_system?: boolean;
          name: string;
          name_en?: string | null;
          name_pl?: string | null;
          numbering_template?: string;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          category?: string;
          code?: string;
          corrects_document_type_code?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          is_correction?: boolean;
          is_system?: boolean;
          name?: string;
          name_en?: string | null;
          name_pl?: string | null;
          numbering_template?: string;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_document_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_export_jobs: {
        Row: {
          branch_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          export_type: string;
          filters: Json;
          id: string;
          organization_id: string;
          status: string;
          storage_path: string | null;
          summary: Json;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          export_type: string;
          filters?: Json;
          id?: string;
          organization_id: string;
          status?: string;
          storage_path?: string | null;
          summary?: Json;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          export_type?: string;
          filters?: Json;
          id?: string;
          organization_id?: string;
          status?: string;
          storage_path?: string | null;
          summary?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_export_jobs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_export_jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_export_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_import_jobs: {
        Row: {
          branch_id: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string | null;
          error_message: string | null;
          file_name: string | null;
          id: string;
          import_type: string;
          mapping: Json;
          organization_id: string;
          status: string;
          storage_path: string | null;
          summary: Json;
          updated_at: string;
        };
        Insert: {
          branch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          file_name?: string | null;
          id?: string;
          import_type: string;
          mapping?: Json;
          organization_id: string;
          status?: string;
          storage_path?: string | null;
          summary?: Json;
          updated_at?: string;
        };
        Update: {
          branch_id?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string | null;
          error_message?: string | null;
          file_name?: string | null;
          id?: string;
          import_type?: string;
          mapping?: Json;
          organization_id?: string;
          status?: string;
          storage_path?: string | null;
          summary?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_import_jobs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_import_jobs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_import_jobs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_item_images: {
        Row: {
          alt_text: string | null;
          content_type: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          file_name: string | null;
          file_size: number | null;
          height: number | null;
          id: string;
          is_primary: boolean;
          organization_id: string;
          product_id: string;
          public_url: string | null;
          sort_order: number;
          storage_bucket: string;
          storage_path: string | null;
          variant_id: string | null;
          width: number | null;
        };
        Insert: {
          alt_text?: string | null;
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          organization_id: string;
          product_id: string;
          public_url?: string | null;
          sort_order?: number;
          storage_bucket?: string;
          storage_path?: string | null;
          variant_id?: string | null;
          width?: number | null;
        };
        Update: {
          alt_text?: string | null;
          content_type?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          file_name?: string | null;
          file_size?: number | null;
          height?: number | null;
          id?: string;
          is_primary?: boolean;
          organization_id?: string;
          product_id?: string;
          public_url?: string | null;
          sort_order?: number;
          storage_bucket?: string;
          storage_path?: string | null;
          variant_id?: string | null;
          width?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_item_images_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_item_images_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_item_images_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_item_images_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_item_images_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_lots: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          expires_at: string | null;
          id: string;
          lot_number: string;
          manufactured_at: string | null;
          metadata: Json;
          organization_id: string;
          product_id: string;
          status: string;
          supplier_reference: string | null;
          updated_at: string;
          updated_by: string | null;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          lot_number: string;
          manufactured_at?: string | null;
          metadata?: Json;
          organization_id: string;
          product_id: string;
          status?: string;
          supplier_reference?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          lot_number?: string;
          manufactured_at?: string | null;
          metadata?: Json;
          organization_id?: string;
          product_id?: string;
          status?: string;
          supplier_reference?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_lots_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_lots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_lots_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_lots_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_lots_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_lots_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_manufacturers: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_manufacturers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_manufacturers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_manufacturers_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_audit_log: {
        Row: {
          action: string;
          actor_user_id: string | null;
          actor_user_name: string | null;
          changes: Json | null;
          created_at: string;
          entity_id: string | null;
          entity_type: string | null;
          id: string;
          movement_id: string;
          new_status: string | null;
          old_status: string | null;
          organization_id: string;
          reason_code: string | null;
          reason_text: string | null;
          request_id: string | null;
          source_channel: string | null;
          transaction_id: string | null;
        };
        Insert: {
          action: string;
          actor_user_id?: string | null;
          actor_user_name?: string | null;
          changes?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          movement_id: string;
          new_status?: string | null;
          old_status?: string | null;
          organization_id: string;
          reason_code?: string | null;
          reason_text?: string | null;
          request_id?: string | null;
          source_channel?: string | null;
          transaction_id?: string | null;
        };
        Update: {
          action?: string;
          actor_user_id?: string | null;
          actor_user_name?: string | null;
          changes?: Json | null;
          created_at?: string;
          entity_id?: string | null;
          entity_type?: string | null;
          id?: string;
          movement_id?: string;
          new_status?: string | null;
          old_status?: string | null;
          organization_id?: string;
          reason_code?: string | null;
          reason_text?: string | null;
          request_id?: string | null;
          source_channel?: string | null;
          transaction_id?: string | null;
        };
        Relationships: [];
      };
      inventory_movement_field_definitions: {
        Row: {
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          field_key: string;
          field_scope: string;
          id: string;
          is_active: boolean;
          is_importable: boolean;
          label: string;
          label_pl: string | null;
          organization_id: string;
          resolver_kind: string | null;
          updated_at: string;
          value_type: string;
        };
        Insert: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          field_key: string;
          field_scope: string;
          id?: string;
          is_active?: boolean;
          is_importable?: boolean;
          label: string;
          label_pl?: string | null;
          organization_id: string;
          resolver_kind?: string | null;
          updated_at?: string;
          value_type: string;
        };
        Update: {
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          field_key?: string;
          field_scope?: string;
          id?: string;
          is_active?: boolean;
          is_importable?: boolean;
          label?: string;
          label_pl?: string | null;
          organization_id?: string;
          resolver_kind?: string | null;
          updated_at?: string;
          value_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_field_definitions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_headers: {
        Row: {
          branch_id: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          counterparty_details: Json | null;
          counterparty_id: string | null;
          counterparty_name: string | null;
          created_at: string;
          created_by: string | null;
          currency: string | null;
          deleted_at: string | null;
          document_date: string | null;
          document_number: string | null;
          document_type_code: string | null;
          draft_number: string | null;
          exchange_rate: number | null;
          external_reference: string | null;
          id: string;
          idempotency_key: string | null;
          invoice_reference: string | null;
          ksef_reference: string | null;
          movement_type_code: string;
          movement_type_id: string;
          note: string | null;
          operation_date: string | null;
          organization_id: string;
          original_movement_id: string | null;
          posted_at: string | null;
          posted_by: string | null;
          recipient_details: Json | null;
          recipient_name: string | null;
          reference_id: string | null;
          reference_type: string | null;
          reversal_movement_id: string | null;
          reversed_at: string | null;
          reversed_by: string | null;
          route_key: string | null;
          sender_details: Json | null;
          sender_name: string | null;
          source_document_reference: string | null;
          status: string;
          total_value: number | null;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          counterparty_details?: Json | null;
          counterparty_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          document_date?: string | null;
          document_number?: string | null;
          document_type_code?: string | null;
          draft_number?: string | null;
          exchange_rate?: number | null;
          external_reference?: string | null;
          id?: string;
          idempotency_key?: string | null;
          invoice_reference?: string | null;
          ksef_reference?: string | null;
          movement_type_code: string;
          movement_type_id: string;
          note?: string | null;
          operation_date?: string | null;
          organization_id: string;
          original_movement_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          recipient_details?: Json | null;
          recipient_name?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_movement_id?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          route_key?: string | null;
          sender_details?: Json | null;
          sender_name?: string | null;
          source_document_reference?: string | null;
          status?: string;
          total_value?: number | null;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          counterparty_details?: Json | null;
          counterparty_id?: string | null;
          counterparty_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          currency?: string | null;
          deleted_at?: string | null;
          document_date?: string | null;
          document_number?: string | null;
          document_type_code?: string | null;
          draft_number?: string | null;
          exchange_rate?: number | null;
          external_reference?: string | null;
          id?: string;
          idempotency_key?: string | null;
          invoice_reference?: string | null;
          ksef_reference?: string | null;
          movement_type_code?: string;
          movement_type_id?: string;
          note?: string | null;
          operation_date?: string | null;
          organization_id?: string;
          original_movement_id?: string | null;
          posted_at?: string | null;
          posted_by?: string | null;
          recipient_details?: Json | null;
          recipient_name?: string | null;
          reference_id?: string | null;
          reference_type?: string | null;
          reversal_movement_id?: string | null;
          reversed_at?: string | null;
          reversed_by?: string | null;
          route_key?: string | null;
          sender_details?: Json | null;
          sender_name?: string | null;
          source_document_reference?: string | null;
          status?: string;
          total_value?: number | null;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_headers_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_branch_org_fk";
            columns: ["branch_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_movement_type_id_fkey";
            columns: ["movement_type_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_original_movement_id_fkey";
            columns: ["original_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_posted_by_fkey";
            columns: ["posted_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_reversal_movement_id_fkey";
            columns: ["reversal_movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_headers_reversed_by_fkey";
            columns: ["reversed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_lines: {
        Row: {
          branch_id: string;
          container_id: string | null;
          created_at: string;
          currency: string | null;
          deleted_at: string | null;
          destination_location_id: string | null;
          exchange_rate: number | null;
          id: string;
          line_number: number;
          lot_id: string | null;
          movement_id: string;
          note: string | null;
          organization_id: string;
          quantity: number;
          serial_id: string | null;
          snapshot_destination_location_name: string | null;
          snapshot_product_name: string | null;
          snapshot_sku: string | null;
          snapshot_source_location_name: string | null;
          snapshot_unit_code: string | null;
          source_location_id: string | null;
          total_cost: number | null;
          unit_cost: number | null;
          unit_id: string;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          container_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          destination_location_id?: string | null;
          exchange_rate?: number | null;
          id?: string;
          line_number?: number;
          lot_id?: string | null;
          movement_id: string;
          note?: string | null;
          organization_id: string;
          quantity: number;
          serial_id?: string | null;
          snapshot_destination_location_name?: string | null;
          snapshot_product_name?: string | null;
          snapshot_sku?: string | null;
          snapshot_source_location_name?: string | null;
          snapshot_unit_code?: string | null;
          source_location_id?: string | null;
          total_cost?: number | null;
          unit_cost?: number | null;
          unit_id: string;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          container_id?: string | null;
          created_at?: string;
          currency?: string | null;
          deleted_at?: string | null;
          destination_location_id?: string | null;
          exchange_rate?: number | null;
          id?: string;
          line_number?: number;
          lot_id?: string | null;
          movement_id?: string;
          note?: string | null;
          organization_id?: string;
          quantity?: number;
          serial_id?: string | null;
          snapshot_destination_location_name?: string | null;
          snapshot_product_name?: string | null;
          snapshot_sku?: string | null;
          snapshot_source_location_name?: string | null;
          snapshot_unit_code?: string | null;
          source_location_id?: string | null;
          total_cost?: number | null;
          unit_cost?: number | null;
          unit_id?: string;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_container_fk";
            columns: ["container_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "inventory_containers";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_destination_location_fk";
            columns: ["destination_location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_header_fk";
            columns: ["movement_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_lot_id_fkey";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_serial_id_fkey";
            columns: ["serial_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_source_location_fk";
            columns: ["source_location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_unit_fk";
            columns: ["unit_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_movement_lines_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_movement_reasons: {
        Row: {
          applies_to: string[];
          code: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_active: boolean;
          name: string;
          organization_id: string;
          requires_note: boolean;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          applies_to?: string[];
          code: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name: string;
          organization_id: string;
          requires_note?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          applies_to?: string[];
          code?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_active?: boolean;
          name?: string;
          organization_id?: string;
          requires_note?: boolean;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_reasons_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_reasons_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_reasons_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_type_effects: {
        Row: {
          balance_field: string;
          description: string | null;
          direction: string;
          effect_order: number;
          id: string;
          is_required: boolean;
          movement_type_id: string;
          target: string;
        };
        Insert: {
          balance_field: string;
          description?: string | null;
          direction: string;
          effect_order: number;
          id?: string;
          is_required?: boolean;
          movement_type_id: string;
          target: string;
        };
        Update: {
          balance_field?: string;
          description?: string | null;
          direction?: string;
          effect_order?: number;
          id?: string;
          is_required?: boolean;
          movement_type_id?: string;
          target?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_type_effects_movement_type_id_fkey";
            columns: ["movement_type_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_types";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_type_field_policies: {
        Row: {
          created_at: string;
          default_strategy: string | null;
          default_value: Json;
          deleted_at: string | null;
          display_order: number;
          field_definition_id: string;
          field_key: string;
          id: string;
          movement_type_code: string;
          movement_type_id: string;
          organization_id: string;
          policy: string;
          updated_at: string;
          validation: Json;
        };
        Insert: {
          created_at?: string;
          default_strategy?: string | null;
          default_value?: Json;
          deleted_at?: string | null;
          display_order?: number;
          field_definition_id: string;
          field_key: string;
          id?: string;
          movement_type_code: string;
          movement_type_id: string;
          organization_id: string;
          policy: string;
          updated_at?: string;
          validation?: Json;
        };
        Update: {
          created_at?: string;
          default_strategy?: string | null;
          default_value?: Json;
          deleted_at?: string | null;
          display_order?: number;
          field_definition_id?: string;
          field_key?: string;
          id?: string;
          movement_type_code?: string;
          movement_type_id?: string;
          organization_id?: string;
          policy?: string;
          updated_at?: string;
          validation?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_type_field_policies_field_definition_id_fkey";
            columns: ["field_definition_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_field_definitions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_type_field_policies_movement_type_id_fkey";
            columns: ["movement_type_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_type_field_policies_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_movement_types: {
        Row: {
          allows_manual_entry: boolean;
          category: string;
          code: string;
          cost_impact: string;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          document_type_id: string;
          id: string;
          is_active: boolean;
          is_system: boolean;
          metadata: Json;
          name: string;
          name_en: string | null;
          name_pl: string | null;
          organization_id: string;
          requires_destination_location: boolean;
          requires_note: boolean;
          requires_reference: boolean;
          requires_source_location: boolean;
          updated_at: string;
        };
        Insert: {
          allows_manual_entry?: boolean;
          category: string;
          code: string;
          cost_impact?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          document_type_id: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          metadata?: Json;
          name: string;
          name_en?: string | null;
          name_pl?: string | null;
          organization_id: string;
          requires_destination_location?: boolean;
          requires_note?: boolean;
          requires_reference?: boolean;
          requires_source_location?: boolean;
          updated_at?: string;
        };
        Update: {
          allows_manual_entry?: boolean;
          category?: string;
          code?: string;
          cost_impact?: string;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          document_type_id?: string;
          id?: string;
          is_active?: boolean;
          is_system?: boolean;
          metadata?: Json;
          name?: string;
          name_en?: string | null;
          name_pl?: string | null;
          organization_id?: string;
          requires_destination_location?: boolean;
          requires_note?: boolean;
          requires_reference?: boolean;
          requires_source_location?: boolean;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_movement_types_document_type_id_fkey";
            columns: ["document_type_id"];
            isOneToOne: false;
            referencedRelation: "inventory_document_types";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_movement_types_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_option_groups: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          display_order: number;
          id: string;
          name: string;
          organization_id: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          id?: string;
          name: string;
          organization_id: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          id?: string;
          name?: string;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_option_groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_option_groups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_option_groups_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_option_values: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          display_order: number;
          id: string;
          option_group_id: string;
          organization_id: string;
          updated_at: string;
          updated_by: string | null;
          value: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          id?: string;
          option_group_id: string;
          organization_id: string;
          updated_at?: string;
          updated_by?: string | null;
          value: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          display_order?: number;
          id?: string;
          option_group_id?: string;
          organization_id?: string;
          updated_at?: string;
          updated_by?: string | null;
          value?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_option_values_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_option_values_group_fk";
            columns: ["option_group_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_option_groups";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_option_values_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_option_values_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_product_identifiers: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          identifier_type: string;
          identifier_value: string;
          is_primary: boolean;
          organization_id: string;
          product_id: string;
          variant_id: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          identifier_type: string;
          identifier_value: string;
          is_primary?: boolean;
          organization_id: string;
          product_id: string;
          variant_id?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          identifier_type?: string;
          identifier_value?: string;
          is_primary?: boolean;
          organization_id?: string;
          product_id?: string;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_identifiers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_identifiers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_identifiers_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_product_identifiers_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_product_identifiers_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_product_tags: {
        Row: {
          created_at: string;
          created_by: string | null;
          organization_id: string;
          product_id: string;
          tag_id: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          organization_id: string;
          product_id: string;
          tag_id: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          organization_id?: string;
          product_id?: string;
          tag_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_tags_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_tags_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_tags_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_product_tags_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_product_tags_tag_fk";
            columns: ["tag_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_tags";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_product_unit_conversions: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          factor: number;
          from_unit_id: string;
          id: string;
          organization_id: string;
          product_id: string;
          rounding_mode: string;
          to_unit_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          factor: number;
          from_unit_id: string;
          id?: string;
          organization_id: string;
          product_id: string;
          rounding_mode?: string;
          to_unit_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          factor?: number;
          from_unit_id?: string;
          id?: string;
          organization_id?: string;
          product_id?: string;
          rounding_mode?: string;
          to_unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_product_unit_conversions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_unit_conversions_from_unit_id_fkey";
            columns: ["from_unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_unit_conversions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_unit_conversions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_product_unit_conversions_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_product_unit_conversions_to_unit_id_fkey";
            columns: ["to_unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_products: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          base_unit_id: string;
          brand_name: string | null;
          created_at: string;
          created_by: string | null;
          default_variant_id: string | null;
          deleted_at: string | null;
          description: string | null;
          dimension_unit: string | null;
          height_value: number | null;
          id: string;
          length_value: number | null;
          manufacturer_name: string | null;
          name: string;
          organization_id: string;
          preferred_supplier_id: string | null;
          product_type: string;
          purchase_account_code: string | null;
          purchase_description: string | null;
          returnable: boolean;
          sales_account_code: string | null;
          sales_description: string | null;
          status: string;
          tax_code: string | null;
          tax_rate_percent: number | null;
          updated_at: string;
          updated_by: string | null;
          weight_unit: string | null;
          weight_value: number | null;
          width_value: number | null;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          base_unit_id: string;
          brand_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_variant_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dimension_unit?: string | null;
          height_value?: number | null;
          id?: string;
          length_value?: number | null;
          manufacturer_name?: string | null;
          name: string;
          organization_id: string;
          preferred_supplier_id?: string | null;
          product_type?: string;
          purchase_account_code?: string | null;
          purchase_description?: string | null;
          returnable?: boolean;
          sales_account_code?: string | null;
          sales_description?: string | null;
          status?: string;
          tax_code?: string | null;
          tax_rate_percent?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weight_unit?: string | null;
          weight_value?: number | null;
          width_value?: number | null;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          base_unit_id?: string;
          brand_name?: string | null;
          created_at?: string;
          created_by?: string | null;
          default_variant_id?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          dimension_unit?: string | null;
          height_value?: number | null;
          id?: string;
          length_value?: number | null;
          manufacturer_name?: string | null;
          name?: string;
          organization_id?: string;
          preferred_supplier_id?: string | null;
          product_type?: string;
          purchase_account_code?: string | null;
          purchase_description?: string | null;
          returnable?: boolean;
          sales_account_code?: string | null;
          sales_description?: string | null;
          status?: string;
          tax_code?: string | null;
          tax_rate_percent?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          weight_unit?: string | null;
          weight_value?: number | null;
          width_value?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_products_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_products_base_unit_fk";
            columns: ["base_unit_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_products_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_products_default_variant_fk";
            columns: ["default_variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_products_preferred_supplier_id_fkey";
            columns: ["preferred_supplier_id"];
            isOneToOne: false;
            referencedRelation: "inventory_suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_products_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_purchase_order_lines: {
        Row: {
          branch_id: string;
          created_at: string;
          id: string;
          line_number: number;
          ordered_quantity: number;
          organization_id: string;
          product_id: string;
          purchase_order_id: string;
          received_quantity: number;
          total_cost: number;
          unit_cost: number;
          unit_id: string;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          id?: string;
          line_number: number;
          ordered_quantity: number;
          organization_id: string;
          product_id: string;
          purchase_order_id: string;
          received_quantity?: number;
          total_cost?: number;
          unit_cost?: number;
          unit_id: string;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          id?: string;
          line_number?: number;
          ordered_quantity?: number;
          organization_id?: string;
          product_id?: string;
          purchase_order_id?: string;
          received_quantity?: number;
          total_cost?: number;
          unit_cost?: number;
          unit_id?: string;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_order_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_purchase_order_id_fkey";
            columns: ["purchase_order_id"];
            isOneToOne: false;
            referencedRelation: "inventory_purchase_orders";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_unit_id_fkey";
            columns: ["unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_purchase_order_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_purchase_orders: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          currency: string;
          deleted_at: string | null;
          delivery_location_id: string | null;
          expected_delivery_date: string | null;
          id: string;
          notes: string | null;
          order_date: string;
          organization_id: string;
          po_number: string;
          status: string;
          supplier_id: string;
          total: number;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          delivery_location_id?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          organization_id: string;
          po_number: string;
          status?: string;
          supplier_id: string;
          total?: number;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          currency?: string;
          deleted_at?: string | null;
          delivery_location_id?: string | null;
          expected_delivery_date?: string | null;
          id?: string;
          notes?: string | null;
          order_date?: string;
          organization_id?: string;
          po_number?: string;
          status?: string;
          supplier_id?: string;
          total?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_purchase_orders_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_orders_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_orders_delivery_location_id_fkey";
            columns: ["delivery_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_orders_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_purchase_orders_supplier_id_fkey";
            columns: ["supplier_id"];
            isOneToOne: false;
            referencedRelation: "inventory_suppliers";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_putaway_rules: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          destination_location_id: string;
          id: string;
          is_active: boolean;
          organization_id: string;
          priority: number;
          product_category: string | null;
          product_id: string | null;
          updated_at: string;
          updated_by: string | null;
          variant_id: string | null;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          destination_location_id: string;
          id?: string;
          is_active?: boolean;
          organization_id: string;
          priority?: number;
          product_category?: string | null;
          product_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id?: string | null;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          destination_location_id?: string;
          id?: string;
          is_active?: boolean;
          organization_id?: string;
          priority?: number;
          product_category?: string | null;
          product_id?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_putaway_rules_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_branch_org_fk";
            columns: ["branch_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_destination_location_fk";
            columns: ["destination_location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_putaway_rules_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_reorder_rules: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          is_active: boolean;
          location_id: string | null;
          min_quantity: number | null;
          organization_id: string;
          preferred_supplier_id: string | null;
          reorder_point: number;
          reorder_quantity: number | null;
          updated_at: string;
          updated_by: string | null;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          location_id?: string | null;
          min_quantity?: number | null;
          organization_id: string;
          preferred_supplier_id?: string | null;
          reorder_point: number;
          reorder_quantity?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_active?: boolean;
          location_id?: string | null;
          min_quantity?: number | null;
          organization_id?: string;
          preferred_supplier_id?: string | null;
          reorder_point?: number;
          reorder_quantity?: number | null;
          updated_at?: string;
          updated_by?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_reorder_rules_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_location_fk";
            columns: ["location_id", "organization_id", "branch_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id", "organization_id", "branch_id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_preferred_supplier_id_fkey";
            columns: ["preferred_supplier_id"];
            isOneToOne: false;
            referencedRelation: "inventory_suppliers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reorder_rules_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_report_runs: {
        Row: {
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          filters: Json;
          id: string;
          organization_id: string;
          report_type: string;
          result: Json;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          filters?: Json;
          id?: string;
          organization_id: string;
          report_type: string;
          result?: Json;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          filters?: Json;
          id?: string;
          organization_id?: string;
          report_type?: string;
          result?: Json;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_report_runs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_report_runs_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_report_runs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_reservation_lines: {
        Row: {
          branch_id: string;
          created_at: string;
          fulfilled_quantity: number;
          id: string;
          location_id: string | null;
          lot_id: string | null;
          organization_id: string;
          product_id: string;
          released_quantity: number;
          reservation_id: string;
          reserved_quantity: number;
          serial_id: string | null;
          variant_id: string;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          fulfilled_quantity?: number;
          id?: string;
          location_id?: string | null;
          lot_id?: string | null;
          organization_id: string;
          product_id: string;
          released_quantity?: number;
          reservation_id: string;
          reserved_quantity: number;
          serial_id?: string | null;
          variant_id: string;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          fulfilled_quantity?: number;
          id?: string;
          location_id?: string | null;
          lot_id?: string | null;
          organization_id?: string;
          product_id?: string;
          released_quantity?: number;
          reservation_id?: string;
          reserved_quantity?: number;
          serial_id?: string | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_reservation_lines_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_lot_id_fkey";
            columns: ["lot_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_product_id_fkey";
            columns: ["product_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_reservation_id_fkey";
            columns: ["reservation_id"];
            isOneToOne: false;
            referencedRelation: "inventory_reservations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_serial_id_fkey";
            columns: ["serial_id"];
            isOneToOne: false;
            referencedRelation: "inventory_serials";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_reservation_lines_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_reservations: {
        Row: {
          branch_id: string;
          cancelled_at: string | null;
          cancelled_by: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          expires_at: string | null;
          id: string;
          notes: string | null;
          organization_id: string;
          priority: number;
          reference_id: string | null;
          reference_number: string | null;
          reference_type: string | null;
          reservation_number: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          organization_id: string;
          priority?: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          reservation_number: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          cancelled_at?: string | null;
          cancelled_by?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          expires_at?: string | null;
          id?: string;
          notes?: string | null;
          organization_id?: string;
          priority?: number;
          reference_id?: string | null;
          reference_number?: string | null;
          reference_type?: string | null;
          reservation_number?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_reservations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_cancelled_by_fkey";
            columns: ["cancelled_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_reservations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_saved_views: {
        Row: {
          config: Json;
          created_at: string;
          deleted_at: string | null;
          entity: string;
          id: string;
          is_shared: boolean;
          name: string;
          organization_id: string;
          updated_at: string;
          user_id: string | null;
        };
        Insert: {
          config: Json;
          created_at?: string;
          deleted_at?: string | null;
          entity: string;
          id?: string;
          is_shared?: boolean;
          name: string;
          organization_id: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Update: {
          config?: Json;
          created_at?: string;
          deleted_at?: string | null;
          entity?: string;
          id?: string;
          is_shared?: boolean;
          name?: string;
          organization_id?: string;
          updated_at?: string;
          user_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_saved_views_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_saved_views_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_serials: {
        Row: {
          created_at: string;
          created_by: string | null;
          current_branch_id: string | null;
          current_location_id: string | null;
          deleted_at: string | null;
          id: string;
          lot_id: string | null;
          metadata: Json;
          organization_id: string;
          product_id: string;
          serial_number: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
          variant_id: string;
          warranty_ends_at: string | null;
          warranty_starts_at: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          current_branch_id?: string | null;
          current_location_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          lot_id?: string | null;
          metadata?: Json;
          organization_id: string;
          product_id: string;
          serial_number: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          variant_id: string;
          warranty_ends_at?: string | null;
          warranty_starts_at?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          current_branch_id?: string | null;
          current_location_id?: string | null;
          deleted_at?: string | null;
          id?: string;
          lot_id?: string | null;
          metadata?: Json;
          organization_id?: string;
          product_id?: string;
          serial_number?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
          variant_id?: string;
          warranty_ends_at?: string | null;
          warranty_starts_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_serials_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_serials_current_branch_id_fkey";
            columns: ["current_branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_serials_current_location_id_fkey";
            columns: ["current_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_serials_lot_fk";
            columns: ["lot_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_lots";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_serials_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_serials_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_serials_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_serials_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_serials_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_settings: {
        Row: {
          allocation_number_next: number;
          allocation_number_prefix: string;
          allow_negative_stock: boolean;
          branch_transfer_number_next: number;
          branch_transfer_number_prefix: string;
          cost_method: string;
          created_at: string;
          created_by: string | null;
          default_currency: string;
          deleted_at: string | null;
          draft_number_next: number;
          draft_number_prefix: string;
          expiry_enforcement_enabled: boolean;
          id: string;
          low_stock_threshold: number;
          negative_stock_policy: string;
          organization_id: string;
          overstock_threshold: number | null;
          purchase_order_number_next: number;
          purchase_order_number_prefix: string;
          reservation_number_next: number;
          reservation_number_prefix: string;
          rounding_precision: number;
          sku_generation_enabled: boolean;
          sku_next: number;
          sku_pattern: string;
          sku_prefix: string;
          sku_sequence_padding: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allocation_number_next?: number;
          allocation_number_prefix?: string;
          allow_negative_stock?: boolean;
          branch_transfer_number_next?: number;
          branch_transfer_number_prefix?: string;
          cost_method?: string;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          deleted_at?: string | null;
          draft_number_next?: number;
          draft_number_prefix?: string;
          expiry_enforcement_enabled?: boolean;
          id?: string;
          low_stock_threshold?: number;
          negative_stock_policy?: string;
          organization_id: string;
          overstock_threshold?: number | null;
          purchase_order_number_next?: number;
          purchase_order_number_prefix?: string;
          reservation_number_next?: number;
          reservation_number_prefix?: string;
          rounding_precision?: number;
          sku_generation_enabled?: boolean;
          sku_next?: number;
          sku_pattern?: string;
          sku_prefix?: string;
          sku_sequence_padding?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allocation_number_next?: number;
          allocation_number_prefix?: string;
          allow_negative_stock?: boolean;
          branch_transfer_number_next?: number;
          branch_transfer_number_prefix?: string;
          cost_method?: string;
          created_at?: string;
          created_by?: string | null;
          default_currency?: string;
          deleted_at?: string | null;
          draft_number_next?: number;
          draft_number_prefix?: string;
          expiry_enforcement_enabled?: boolean;
          id?: string;
          low_stock_threshold?: number;
          negative_stock_policy?: string;
          organization_id?: string;
          overstock_threshold?: number | null;
          purchase_order_number_next?: number;
          purchase_order_number_prefix?: string;
          reservation_number_next?: number;
          reservation_number_prefix?: string;
          rounding_precision?: number;
          sku_generation_enabled?: boolean;
          sku_next?: number;
          sku_pattern?: string;
          sku_prefix?: string;
          sku_sequence_padding?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_settings_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_settings_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_sku_templates: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
          rules: Json;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
          rules?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
          rules?: Json;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_sku_templates_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_sku_templates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_sku_templates_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_stock_ledger_entries: {
        Row: {
          balance_after: number;
          balance_field: string;
          branch_id: string;
          created_at: string;
          currency: string | null;
          direction: string;
          document_number: string | null;
          document_type_code: string | null;
          effect_id: string;
          exchange_rate: number | null;
          id: string;
          location_id: string;
          lot_id: string | null;
          movement_id: string;
          movement_line_id: string;
          movement_type_code: string;
          organization_id: string;
          posted_at: string;
          quantity: number;
          serial_id: string | null;
          unit_cost: number | null;
          value_delta: number | null;
          variant_id: string;
        };
        Insert: {
          balance_after: number;
          balance_field: string;
          branch_id: string;
          created_at?: string;
          currency?: string | null;
          direction: string;
          document_number?: string | null;
          document_type_code?: string | null;
          effect_id: string;
          exchange_rate?: number | null;
          id?: string;
          location_id: string;
          lot_id?: string | null;
          movement_id: string;
          movement_line_id: string;
          movement_type_code: string;
          organization_id: string;
          posted_at: string;
          quantity: number;
          serial_id?: string | null;
          unit_cost?: number | null;
          value_delta?: number | null;
          variant_id: string;
        };
        Update: {
          balance_after?: number;
          balance_field?: string;
          branch_id?: string;
          created_at?: string;
          currency?: string | null;
          direction?: string;
          document_number?: string | null;
          document_type_code?: string | null;
          effect_id?: string;
          exchange_rate?: number | null;
          id?: string;
          location_id?: string;
          lot_id?: string | null;
          movement_id?: string;
          movement_line_id?: string;
          movement_type_code?: string;
          organization_id?: string;
          posted_at?: string;
          quantity?: number;
          serial_id?: string | null;
          unit_cost?: number | null;
          value_delta?: number | null;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_stock_ledger_entries_effect_id_fkey";
            columns: ["effect_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_type_effects";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_stock_ledger_entries_movement_id_fkey";
            columns: ["movement_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_headers";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_stock_ledger_entries_movement_line_id_fkey";
            columns: ["movement_line_id"];
            isOneToOne: false;
            referencedRelation: "inventory_movement_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_suppliers: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          email: string | null;
          id: string;
          name: string;
          organization_id: string;
          phone: string | null;
          status: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          email?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          phone?: string | null;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_suppliers_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_suppliers_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_tags: {
        Row: {
          color: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          name: string;
          organization_id: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          name: string;
          organization_id: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_tags_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_tags_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_tax_rates: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          is_default: boolean;
          name: string;
          organization_id: string;
          rate_percent: number;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name: string;
          organization_id: string;
          rate_percent?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          name?: string;
          organization_id?: string;
          rate_percent?: number;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_tax_rates_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_unit_conversions: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          factor: number;
          from_unit_id: string;
          id: string;
          organization_id: string;
          to_unit_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          factor: number;
          from_unit_id: string;
          id?: string;
          organization_id: string;
          to_unit_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          factor?: number;
          from_unit_id?: string;
          id?: string;
          organization_id?: string;
          to_unit_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_unit_conversions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_unit_conversions_from_unit_id_fkey";
            columns: ["from_unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_unit_conversions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_unit_conversions_to_unit_id_fkey";
            columns: ["to_unit_id"];
            isOneToOne: false;
            referencedRelation: "inventory_units";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_units: {
        Row: {
          code: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          is_system: boolean;
          name: string;
          organization_id: string;
          precision: number;
          unit_kind: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          code: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_system?: boolean;
          name: string;
          organization_id: string;
          precision?: number;
          unit_kind?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          code?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_system?: boolean;
          name?: string;
          organization_id?: string;
          precision?: number;
          unit_kind?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_units_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_units_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_units_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_valuation_snapshots: {
        Row: {
          average_unit_cost: number;
          branch_id: string | null;
          created_at: string;
          currency: string;
          id: string;
          location_id: string | null;
          organization_id: string;
          quantity_on_hand: number;
          snapshot_date: string;
          total_value: number;
          variant_id: string | null;
        };
        Insert: {
          average_unit_cost: number;
          branch_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          location_id?: string | null;
          organization_id: string;
          quantity_on_hand: number;
          snapshot_date: string;
          total_value: number;
          variant_id?: string | null;
        };
        Update: {
          average_unit_cost?: number;
          branch_id?: string | null;
          created_at?: string;
          currency?: string;
          id?: string;
          location_id?: string | null;
          organization_id?: string;
          quantity_on_hand?: number;
          snapshot_date?: string;
          total_value?: number;
          variant_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_valuation_snapshots_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_valuation_snapshots_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_valuation_snapshots_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_valuation_snapshots_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_valuation_snapshots_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_variant_costs: {
        Row: {
          average_unit_cost: number;
          branch_id: string;
          currency: string;
          organization_id: string;
          total_quantity: number;
          total_value: number;
          updated_at: string;
          variant_id: string;
        };
        Insert: {
          average_unit_cost?: number;
          branch_id: string;
          currency?: string;
          organization_id: string;
          total_quantity?: number;
          total_value?: number;
          updated_at?: string;
          variant_id: string;
        };
        Update: {
          average_unit_cost?: number;
          branch_id?: string;
          currency?: string;
          organization_id?: string;
          total_quantity?: number;
          total_value?: number;
          updated_at?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_variant_costs_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variant_costs_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variant_costs_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["variant_id"];
          },
          {
            foreignKeyName: "inventory_variant_costs_variant_id_fkey";
            columns: ["variant_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id"];
          },
        ];
      };
      inventory_variant_option_values: {
        Row: {
          created_at: string;
          option_group_id: string;
          option_value_id: string;
          organization_id: string;
          variant_id: string;
        };
        Insert: {
          created_at?: string;
          option_group_id: string;
          option_value_id: string;
          organization_id: string;
          variant_id: string;
        };
        Update: {
          created_at?: string;
          option_group_id?: string;
          option_value_id?: string;
          organization_id?: string;
          variant_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_variant_option_values_group_fk";
            columns: ["option_group_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_option_groups";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_variant_option_values_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variant_option_values_value_fk";
            columns: ["option_value_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_option_values";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_variant_option_values_variant_fk";
            columns: ["variant_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_variants";
            referencedColumns: ["id", "organization_id"];
          },
        ];
      };
      inventory_variants: {
        Row: {
          archived_at: string | null;
          archived_by: string | null;
          barcode: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          is_default: boolean;
          media: Json;
          name: string;
          organization_id: string;
          price_currency: string | null;
          product_id: string;
          purchase_price: number | null;
          sales_price: number | null;
          sku: string;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          archived_at?: string | null;
          archived_by?: string | null;
          barcode?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          media?: Json;
          name?: string;
          organization_id: string;
          price_currency?: string | null;
          product_id: string;
          purchase_price?: number | null;
          sales_price?: number | null;
          sku: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          archived_at?: string | null;
          archived_by?: string | null;
          barcode?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          is_default?: boolean;
          media?: Json;
          name?: string;
          organization_id?: string;
          price_currency?: string | null;
          product_id?: string;
          purchase_price?: number | null;
          sales_price?: number | null;
          sku?: string;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_variants_archived_by_fkey";
            columns: ["archived_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variants_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variants_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "inventory_variants_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_product_list_rows_v1";
            referencedColumns: ["product_id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_variants_product_fk";
            columns: ["product_id", "organization_id"];
            isOneToOne: false;
            referencedRelation: "inventory_products";
            referencedColumns: ["id", "organization_id"];
          },
          {
            foreignKeyName: "inventory_variants_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      invitation_role_assignments: {
        Row: {
          created_at: string;
          id: string;
          invitation_id: string;
          role_id: string;
          scope: string;
          scope_id: string | null;
        };
        Insert: {
          created_at?: string;
          id?: string;
          invitation_id: string;
          role_id: string;
          scope: string;
          scope_id?: string | null;
        };
        Update: {
          created_at?: string;
          id?: string;
          invitation_id?: string;
          role_id?: string;
          scope?: string;
          scope_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "invitation_role_assignments_invitation_id_fkey";
            columns: ["invitation_id"];
            isOneToOne: false;
            referencedRelation: "invitations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "invitation_role_assignments_role_id_fkey";
            columns: ["role_id"];
            isOneToOne: false;
            referencedRelation: "roles";
            referencedColumns: ["id"];
          },
        ];
      };
      invitations: {
        Row: {
          accepted_at: string | null;
          created_at: string | null;
          declined_at: string | null;
          deleted_at: string | null;
          email: string;
          expires_at: string | null;
          id: string;
          invited_by: string;
          invited_first_name: string | null;
          invited_last_name: string | null;
          organization_id: string | null;
          status: string;
          token: string;
        };
        Insert: {
          accepted_at?: string | null;
          created_at?: string | null;
          declined_at?: string | null;
          deleted_at?: string | null;
          email: string;
          expires_at?: string | null;
          id?: string;
          invited_by: string;
          invited_first_name?: string | null;
          invited_last_name?: string | null;
          organization_id?: string | null;
          status?: string;
          token: string;
        };
        Update: {
          accepted_at?: string | null;
          created_at?: string | null;
          declined_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          expires_at?: string | null;
          id?: string;
          invited_by?: string;
          invited_first_name?: string | null;
          invited_last_name?: string | null;
          organization_id?: string | null;
          status?: string;
          token?: string;
        };
        Relationships: [
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
        ];
      };
      org_position_assignments: {
        Row: {
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          org_id: string;
          position_id: string;
          user_id: string;
        };
        Insert: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id: string;
          position_id: string;
          user_id: string;
        };
        Update: {
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          org_id?: string;
          position_id?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_position_assignments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_position_assignments_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_position_assignments_position_id_fkey";
            columns: ["position_id"];
            isOneToOne: false;
            referencedRelation: "org_positions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "org_position_assignments_user_id_fkey";
            columns: ["user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      org_positions: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          org_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          org_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          org_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "org_positions_org_id_fkey";
            columns: ["org_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_entitlements: {
        Row: {
          contexts: string[] | null;
          created_at: string | null;
          enabled_modules: string[] | null;
          limits: Json | null;
          metadata: Json | null;
          organization_id: string;
          plan_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          contexts?: string[] | null;
          created_at?: string | null;
          enabled_modules?: string[] | null;
          limits?: Json | null;
          metadata?: Json | null;
          organization_id: string;
          plan_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          contexts?: string[] | null;
          created_at?: string | null;
          enabled_modules?: string[] | null;
          limits?: Json | null;
          metadata?: Json | null;
          organization_id?: string;
          plan_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_entitlements_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "organization_entitlements_plan_id_fkey";
            columns: ["plan_id"];
            isOneToOne: false;
            referencedRelation: "subscription_plans";
            referencedColumns: ["id"];
          },
        ];
      };
      organization_limit_overrides: {
        Row: {
          created_at: string | null;
          id: string;
          limit_key: string;
          limit_value: number;
          organization_id: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          id?: string;
          limit_key: string;
          limit_value: number;
          organization_id: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          id?: string;
          limit_key?: string;
          limit_value?: number;
          organization_id?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_limit_overrides_organization_id_fkey";
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
      organization_module_addons: {
        Row: {
          created_at: string | null;
          expires_at: string | null;
          id: string;
          metadata: Json | null;
          module_slug: string;
          organization_id: string;
          status: string;
          updated_at: string | null;
        };
        Insert: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json | null;
          module_slug: string;
          organization_id: string;
          status?: string;
          updated_at?: string | null;
        };
        Update: {
          created_at?: string | null;
          expires_at?: string | null;
          id?: string;
          metadata?: Json | null;
          module_slug?: string;
          organization_id?: string;
          status?: string;
          updated_at?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "organization_module_addons_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
          canceled_at: string | null;
          created_at: string | null;
          current_period_end: string | null;
          current_period_start: string | null;
          id: string;
          metadata: Json | null;
          organization_id: string;
          plan_id: string;
          status: string;
          stripe_customer_id: string | null;
          stripe_subscription_id: string | null;
          trial_ends_at: string | null;
          updated_at: string | null;
        };
        Insert: {
          canceled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          metadata?: Json | null;
          organization_id: string;
          plan_id: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
          updated_at?: string | null;
        };
        Update: {
          canceled_at?: string | null;
          created_at?: string | null;
          current_period_end?: string | null;
          current_period_start?: string | null;
          id?: string;
          metadata?: Json | null;
          organization_id?: string;
          plan_id?: string;
          status?: string;
          stripe_customer_id?: string | null;
          stripe_subscription_id?: string | null;
          trial_ends_at?: string | null;
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
      planning_kanban_boards: {
        Row: {
          color: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          organization_id: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
          visibility: string;
        };
        Insert: {
          color?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          organization_id: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Update: {
          color?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          organization_id?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
          visibility?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_kanban_boards_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_boards_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_boards_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_kanban_card_activity: {
        Row: {
          activity_type: string;
          actor_id: string | null;
          board_id: string;
          card_id: string;
          created_at: string;
          id: string;
          message: string | null;
          metadata: Json;
          organization_id: string;
        };
        Insert: {
          activity_type: string;
          actor_id?: string | null;
          board_id: string;
          card_id: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          organization_id: string;
        };
        Update: {
          activity_type?: string;
          actor_id?: string | null;
          board_id?: string;
          card_id?: string;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json;
          organization_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_kanban_card_activity_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_card_activity_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "planning_kanban_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_card_activity_card_id_fkey";
            columns: ["card_id"];
            isOneToOne: false;
            referencedRelation: "planning_kanban_cards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_card_activity_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_kanban_cards: {
        Row: {
          board_id: string;
          calendar_all_day: boolean | null;
          calendar_end_at: string | null;
          calendar_end_date: string | null;
          calendar_start_at: string | null;
          calendar_start_date: string | null;
          calendar_timezone: string | null;
          column_id: string;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description: string | null;
          description_rich: Json | null;
          due_at: string | null;
          due_date: string | null;
          id: string;
          is_inbox: boolean;
          label: string | null;
          label_color: string | null;
          organization_id: string;
          position: number;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          board_id: string;
          calendar_all_day?: boolean | null;
          calendar_end_at?: string | null;
          calendar_end_date?: string | null;
          calendar_start_at?: string | null;
          calendar_start_date?: string | null;
          calendar_timezone?: string | null;
          column_id: string;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          is_inbox?: boolean;
          label?: string | null;
          label_color?: string | null;
          organization_id: string;
          position?: number;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          board_id?: string;
          calendar_all_day?: boolean | null;
          calendar_end_at?: string | null;
          calendar_end_date?: string | null;
          calendar_start_at?: string | null;
          calendar_start_date?: string | null;
          calendar_timezone?: string | null;
          column_id?: string;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          is_inbox?: boolean;
          label?: string | null;
          label_color?: string | null;
          organization_id?: string;
          position?: number;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "planning_kanban_cards_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "planning_kanban_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_cards_column_id_fkey";
            columns: ["column_id"];
            isOneToOne: false;
            referencedRelation: "planning_kanban_columns";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_cards_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_cards_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_cards_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_kanban_columns: {
        Row: {
          board_id: string;
          color: string | null;
          created_at: string;
          deleted_at: string | null;
          description: string | null;
          id: string;
          organization_id: string;
          position: number;
          title: string;
          updated_at: string;
        };
        Insert: {
          board_id: string;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          organization_id: string;
          position?: number;
          title: string;
          updated_at?: string;
        };
        Update: {
          board_id?: string;
          color?: string | null;
          created_at?: string;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          organization_id?: string;
          position?: number;
          title?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_kanban_columns_board_id_fkey";
            columns: ["board_id"];
            isOneToOne: false;
            referencedRelation: "planning_kanban_boards";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_kanban_columns_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_settings: {
        Row: {
          created_at: string;
          id: string;
          organization_id: string;
          priority_configs: Json;
          status_configs: Json;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          organization_id: string;
          priority_configs?: Json;
          status_configs?: Json;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          organization_id?: string;
          priority_configs?: Json;
          status_configs?: Json;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_task_activity: {
        Row: {
          activity_type: string;
          actor_id: string | null;
          branch_id: string | null;
          created_at: string;
          id: string;
          message: string | null;
          metadata: Json | null;
          organization_id: string;
          task_id: string;
        };
        Insert: {
          activity_type: string;
          actor_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          organization_id: string;
          task_id: string;
        };
        Update: {
          activity_type?: string;
          actor_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          id?: string;
          message?: string | null;
          metadata?: Json | null;
          organization_id?: string;
          task_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "planning_task_activity_actor_id_fkey";
            columns: ["actor_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_task_activity_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_task_activity_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_task_activity_task_id_fkey";
            columns: ["task_id"];
            isOneToOne: false;
            referencedRelation: "planning_tasks";
            referencedColumns: ["id"];
          },
        ];
      };
      planning_tasks: {
        Row: {
          assigned_to: string | null;
          branch_id: string | null;
          calendar_all_day: boolean | null;
          calendar_end_at: string | null;
          calendar_end_date: string | null;
          calendar_start_at: string | null;
          calendar_start_date: string | null;
          calendar_timezone: string | null;
          cancelled_at: string | null;
          completed_at: string | null;
          created_at: string;
          created_by: string;
          deleted_at: string | null;
          description_plain: string | null;
          description_rich: Json | null;
          due_at: string | null;
          due_date: string | null;
          id: string;
          organization_id: string;
          priority: string;
          started_at: string | null;
          status: string;
          task_number: string;
          title: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          assigned_to?: string | null;
          branch_id?: string | null;
          calendar_all_day?: boolean | null;
          calendar_end_at?: string | null;
          calendar_end_date?: string | null;
          calendar_start_at?: string | null;
          calendar_start_date?: string | null;
          calendar_timezone?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by: string;
          deleted_at?: string | null;
          description_plain?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          organization_id: string;
          priority?: string;
          started_at?: string | null;
          status?: string;
          task_number: string;
          title: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          assigned_to?: string | null;
          branch_id?: string | null;
          calendar_all_day?: boolean | null;
          calendar_end_at?: string | null;
          calendar_end_date?: string | null;
          calendar_start_at?: string | null;
          calendar_start_date?: string | null;
          calendar_timezone?: string | null;
          cancelled_at?: string | null;
          completed_at?: string | null;
          created_at?: string;
          created_by?: string;
          deleted_at?: string | null;
          description_plain?: string | null;
          description_rich?: Json | null;
          due_at?: string | null;
          due_date?: string | null;
          id?: string;
          organization_id?: string;
          priority?: string;
          started_at?: string | null;
          status?: string;
          task_number?: string;
          title?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "planning_tasks_assigned_to_fkey";
            columns: ["assigned_to"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_tasks_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_tasks_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_tasks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "planning_tasks_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      platform_events: {
        Row: {
          action_key: string;
          actor_type: string;
          actor_user_id: string | null;
          branch_id: string | null;
          created_at: string;
          entity_id: string;
          entity_type: string;
          event_tier: string;
          id: string;
          ip_address: unknown;
          metadata: Json;
          module_slug: string;
          organization_id: string | null;
          request_id: string | null;
          target_id: string | null;
          target_type: string | null;
          user_agent: string | null;
        };
        Insert: {
          action_key: string;
          actor_type: string;
          actor_user_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          entity_id: string;
          entity_type: string;
          event_tier: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          module_slug: string;
          organization_id?: string | null;
          request_id?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          user_agent?: string | null;
        };
        Update: {
          action_key?: string;
          actor_type?: string;
          actor_user_id?: string | null;
          branch_id?: string | null;
          created_at?: string;
          entity_id?: string;
          entity_type?: string;
          event_tier?: string;
          id?: string;
          ip_address?: unknown;
          metadata?: Json;
          module_slug?: string;
          organization_id?: string | null;
          request_id?: string | null;
          target_id?: string | null;
          target_type?: string | null;
          user_agent?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "platform_events_actor_user_id_fk";
            columns: ["actor_user_id"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_events_branch_id_fk";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "platform_events_organization_id_fk";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_assignments: {
        Row: {
          assigned_at: string;
          assigned_by: string | null;
          branch_id: string | null;
          id: string;
          organization_id: string;
          qr_code_id: string;
          revocation_reason: string | null;
          revoked_at: string | null;
          revoked_by: string | null;
          target_id: string;
          target_type: string;
        };
        Insert: {
          assigned_at?: string;
          assigned_by?: string | null;
          branch_id?: string | null;
          id?: string;
          organization_id: string;
          qr_code_id: string;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          target_id: string;
          target_type: string;
        };
        Update: {
          assigned_at?: string;
          assigned_by?: string | null;
          branch_id?: string | null;
          id?: string;
          organization_id?: string;
          qr_code_id?: string;
          revocation_reason?: string | null;
          revoked_at?: string | null;
          revoked_by?: string | null;
          target_id?: string;
          target_type?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_assignments_assigned_by_fkey";
            columns: ["assigned_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_assignments_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_assignments_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_assignments_qr_code_id_fkey";
            columns: ["qr_code_id"];
            isOneToOne: false;
            referencedRelation: "qr_codes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_assignments_revoked_by_fkey";
            columns: ["revoked_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      qr_codes: {
        Row: {
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          label: string | null;
          notes: string | null;
          organization_id: string;
          status: string;
          token: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          label?: string | null;
          notes?: string | null;
          organization_id: string;
          status?: string;
          token: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          label?: string | null;
          notes?: string | null;
          organization_id?: string;
          status?: string;
          token?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "qr_codes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "qr_codes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
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
      subscription_plans: {
        Row: {
          contexts: string[] | null;
          created_at: string | null;
          description: string | null;
          enabled_modules: string[] | null;
          features: Json | null;
          id: string;
          is_active: boolean;
          limits: Json | null;
          max_users: number | null;
          metadata: Json | null;
          name: string;
          price_monthly: number | null;
          price_yearly: number | null;
          stripe_price_id: string | null;
          updated_at: string | null;
        };
        Insert: {
          contexts?: string[] | null;
          created_at?: string | null;
          description?: string | null;
          enabled_modules?: string[] | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          limits?: Json | null;
          max_users?: number | null;
          metadata?: Json | null;
          name: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          stripe_price_id?: string | null;
          updated_at?: string | null;
        };
        Update: {
          contexts?: string[] | null;
          created_at?: string | null;
          description?: string | null;
          enabled_modules?: string[] | null;
          features?: Json | null;
          id?: string;
          is_active?: boolean;
          limits?: Json | null;
          max_users?: number | null;
          metadata?: Json | null;
          name?: string;
          price_monthly?: number | null;
          price_yearly?: number | null;
          stripe_price_id?: string | null;
          updated_at?: string | null;
        };
        Relationships: [];
      };
      tools_catalog: {
        Row: {
          category: string | null;
          created_at: string;
          description: string | null;
          icon_key: string | null;
          is_active: boolean;
          metadata: Json;
          name: string;
          slug: string;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          icon_key?: string | null;
          is_active?: boolean;
          metadata?: Json;
          name: string;
          slug: string;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          category?: string | null;
          created_at?: string;
          description?: string | null;
          icon_key?: string | null;
          is_active?: boolean;
          metadata?: Json;
          name?: string;
          slug?: string;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [];
      };
      user_effective_permissions: {
        Row: {
          branch_id: string | null;
          compiled_at: string;
          created_at: string;
          id: string;
          organization_id: string;
          permission_slug: string;
          permission_slug_exact: string;
          source_id: string | null;
          source_type: string;
          user_id: string;
        };
        Insert: {
          branch_id?: string | null;
          compiled_at?: string;
          created_at?: string;
          id?: string;
          organization_id: string;
          permission_slug: string;
          permission_slug_exact: string;
          source_id?: string | null;
          source_type?: string;
          user_id: string;
        };
        Update: {
          branch_id?: string | null;
          compiled_at?: string;
          created_at?: string;
          id?: string;
          organization_id?: string;
          permission_slug?: string;
          permission_slug_exact?: string;
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
      user_enabled_tools: {
        Row: {
          created_at: string;
          enabled: boolean;
          id: string;
          pinned: boolean;
          settings: Json;
          tool_slug: string;
          updated_at: string;
          user_id: string;
        };
        Insert: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          pinned?: boolean;
          settings?: Json;
          tool_slug: string;
          updated_at?: string;
          user_id: string;
        };
        Update: {
          created_at?: string;
          enabled?: boolean;
          id?: string;
          pinned?: boolean;
          settings?: Json;
          tool_slug?: string;
          updated_at?: string;
          user_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "user_enabled_tools_tool_slug_fkey";
            columns: ["tool_slug"];
            isOneToOne: false;
            referencedRelation: "tools_catalog";
            referencedColumns: ["slug"];
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
      users: {
        Row: {
          avatar_path: string | null;
          avatar_url: string | null;
          created_at: string | null;
          deleted_at: string | null;
          email: string;
          first_name: string | null;
          id: string;
          last_name: string | null;
        };
        Insert: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email: string;
          first_name?: string | null;
          id: string;
          last_name?: string | null;
        };
        Update: {
          avatar_path?: string | null;
          avatar_url?: string | null;
          created_at?: string | null;
          deleted_at?: string | null;
          email?: string;
          first_name?: string | null;
          id?: string;
          last_name?: string | null;
        };
        Relationships: [];
      };
      warehouse_layout_shapes: {
        Row: {
          anchor_location_id: string | null;
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          height: number;
          id: string;
          label: string | null;
          layout_id: string;
          location_id: string | null;
          organization_id: string;
          projection: string;
          rotation: number;
          shape_type: string;
          sort_order: number;
          style: Json | null;
          updated_at: string;
          width: number;
          x: number;
          y: number;
          z_index: number;
        };
        Insert: {
          anchor_location_id?: string | null;
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          height?: number;
          id?: string;
          label?: string | null;
          layout_id: string;
          location_id?: string | null;
          organization_id: string;
          projection?: string;
          rotation?: number;
          shape_type: string;
          sort_order?: number;
          style?: Json | null;
          updated_at?: string;
          width?: number;
          x?: number;
          y?: number;
          z_index?: number;
        };
        Update: {
          anchor_location_id?: string | null;
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          height?: number;
          id?: string;
          label?: string | null;
          layout_id?: string;
          location_id?: string | null;
          organization_id?: string;
          projection?: string;
          rotation?: number;
          shape_type?: string;
          sort_order?: number;
          style?: Json | null;
          updated_at?: string;
          width?: number;
          x?: number;
          y?: number;
          z_index?: number;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_layout_shapes_anchor_location_id_fkey";
            columns: ["anchor_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_shapes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_shapes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_shapes_layout_id_fkey";
            columns: ["layout_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_layouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_shapes_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_shapes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_layout_split_nodes: {
        Row: {
          branch_id: string;
          cache_valid: boolean;
          calc_depth_mm: number | null;
          calc_height_mm: number | null;
          calc_width_mm: number | null;
          calc_x_mm: number | null;
          calc_y_mm: number | null;
          calc_z_mm: number | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          id: string;
          layout_id: string;
          linked_location_id: string | null;
          node_kind: string;
          organization_id: string;
          parent_node_id: string | null;
          parent_visual_node_id: string | null;
          size_mode: string;
          size_value: number | null;
          sort_order: number;
          split_direction: string | null;
          updated_at: string;
          updated_by: string | null;
          view_context_location_id: string | null;
        };
        Insert: {
          branch_id: string;
          cache_valid?: boolean;
          calc_depth_mm?: number | null;
          calc_height_mm?: number | null;
          calc_width_mm?: number | null;
          calc_x_mm?: number | null;
          calc_y_mm?: number | null;
          calc_z_mm?: number | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          layout_id: string;
          linked_location_id?: string | null;
          node_kind: string;
          organization_id: string;
          parent_node_id?: string | null;
          parent_visual_node_id?: string | null;
          size_mode?: string;
          size_value?: number | null;
          sort_order?: number;
          split_direction?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          view_context_location_id?: string | null;
        };
        Update: {
          branch_id?: string;
          cache_valid?: boolean;
          calc_depth_mm?: number | null;
          calc_height_mm?: number | null;
          calc_width_mm?: number | null;
          calc_x_mm?: number | null;
          calc_y_mm?: number | null;
          calc_z_mm?: number | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          id?: string;
          layout_id?: string;
          linked_location_id?: string | null;
          node_kind?: string;
          organization_id?: string;
          parent_node_id?: string | null;
          parent_visual_node_id?: string | null;
          size_mode?: string;
          size_value?: number | null;
          sort_order?: number;
          split_direction?: string | null;
          updated_at?: string;
          updated_by?: string | null;
          view_context_location_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_layout_split_nodes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_layout_id_fkey";
            columns: ["layout_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_layouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_linked_location_id_fkey";
            columns: ["linked_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_parent_node_id_fkey";
            columns: ["parent_node_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_layout_split_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_parent_visual_node_id_fkey";
            columns: ["parent_visual_node_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_location_visual_nodes";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layout_split_nodes_view_context_location_id_fkey";
            columns: ["view_context_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_layouts: {
        Row: {
          branch_id: string;
          canvas_height_m: number;
          canvas_width_m: number;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          published_at: string | null;
          root_location_id: string | null;
          status: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          branch_id: string;
          canvas_height_m?: number;
          canvas_width_m?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          published_at?: string | null;
          root_location_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          branch_id?: string;
          canvas_height_m?: number;
          canvas_width_m?: number;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          published_at?: string | null;
          root_location_id?: string | null;
          status?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_layouts_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layouts_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layouts_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layouts_root_location_id_fkey";
            columns: ["root_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_layouts_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_location_groups: {
        Row: {
          branch_id: string;
          color: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          id: string;
          name: string;
          organization_id: string;
          parent_location_id: string | null;
          sort_order: number;
          updated_at: string;
        };
        Insert: {
          branch_id: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name: string;
          organization_id: string;
          parent_location_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Update: {
          branch_id?: string;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          id?: string;
          name?: string;
          organization_id?: string;
          parent_location_id?: string | null;
          sort_order?: number;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_location_groups_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_groups_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_groups_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_groups_parent_location_id_fkey";
            columns: ["parent_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_location_label_settings: {
        Row: {
          created_at: string;
          id: string;
          label_config: Json;
          organization_id: string;
          updated_at: string;
        };
        Insert: {
          created_at?: string;
          id?: string;
          label_config?: Json;
          organization_id: string;
          updated_at?: string;
        };
        Update: {
          created_at?: string;
          id?: string;
          label_config?: Json;
          organization_id?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_location_label_settings_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: true;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_location_visual_nodes: {
        Row: {
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          depth_mm: number | null;
          height_mm: number;
          id: string;
          layout_id: string;
          location_id: string | null;
          organization_id: string;
          rotation_deg: number;
          sort_order: number;
          status: string;
          style: Json | null;
          updated_at: string;
          updated_by: string | null;
          view_context_location_id: string | null;
          view_type: string;
          visual_role: string;
          visualization_type: string;
          width_mm: number;
          x_mm: number;
          y_mm: number;
          z_index: number;
          z_mm: number;
        };
        Insert: {
          branch_id: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          depth_mm?: number | null;
          height_mm: number;
          id?: string;
          layout_id: string;
          location_id?: string | null;
          organization_id: string;
          rotation_deg?: number;
          sort_order?: number;
          status?: string;
          style?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          view_context_location_id?: string | null;
          view_type: string;
          visual_role?: string;
          visualization_type?: string;
          width_mm: number;
          x_mm?: number;
          y_mm?: number;
          z_index?: number;
          z_mm?: number;
        };
        Update: {
          branch_id?: string;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          depth_mm?: number | null;
          height_mm?: number;
          id?: string;
          layout_id?: string;
          location_id?: string | null;
          organization_id?: string;
          rotation_deg?: number;
          sort_order?: number;
          status?: string;
          style?: Json | null;
          updated_at?: string;
          updated_by?: string | null;
          view_context_location_id?: string | null;
          view_type?: string;
          visual_role?: string;
          visualization_type?: string;
          width_mm?: number;
          x_mm?: number;
          y_mm?: number;
          z_index?: number;
          z_mm?: number;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_location_visual_nodes_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_layout_id_fkey";
            columns: ["layout_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_layouts";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_location_id_fkey";
            columns: ["location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_location_visual_nodes_view_context_location_id_fkey";
            columns: ["view_context_location_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
        ];
      };
      warehouse_locations: {
        Row: {
          allow_top_storage: boolean;
          branch_id: string;
          can_pick: boolean;
          can_receive: boolean;
          can_reserve: boolean;
          can_ship: boolean;
          can_store_inventory: boolean;
          code: string | null;
          color: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          depth_mm: number | null;
          description: string | null;
          elevation_level: number;
          group_id: string | null;
          height_mm: number | null;
          icon_name: string | null;
          id: string;
          inherit_group_color: boolean;
          inherit_parent_color: boolean;
          is_temporary: boolean;
          is_virtual: boolean;
          level: number;
          location_category: string;
          location_type: string;
          map_role: string;
          name: string;
          organization_id: string;
          parent_id: string | null;
          physical_depth_m: number | null;
          physical_elevation_start_m: number | null;
          physical_height_m: number | null;
          physical_width_m: number | null;
          qr_code: string;
          sort_order: number;
          status: string;
          storage_mode: string;
          updated_at: string;
          updated_by: string | null;
          weight_capacity_kg: number | null;
          width_mm: number | null;
        };
        Insert: {
          allow_top_storage?: boolean;
          branch_id: string;
          can_pick?: boolean;
          can_receive?: boolean;
          can_reserve?: boolean;
          can_ship?: boolean;
          can_store_inventory?: boolean;
          code?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          depth_mm?: number | null;
          description?: string | null;
          elevation_level?: number;
          group_id?: string | null;
          height_mm?: number | null;
          icon_name?: string | null;
          id?: string;
          inherit_group_color?: boolean;
          inherit_parent_color?: boolean;
          is_temporary?: boolean;
          is_virtual?: boolean;
          level?: number;
          location_category?: string;
          location_type?: string;
          map_role?: string;
          name: string;
          organization_id: string;
          parent_id?: string | null;
          physical_depth_m?: number | null;
          physical_elevation_start_m?: number | null;
          physical_height_m?: number | null;
          physical_width_m?: number | null;
          qr_code?: string;
          sort_order?: number;
          status?: string;
          storage_mode?: string;
          updated_at?: string;
          updated_by?: string | null;
          weight_capacity_kg?: number | null;
          width_mm?: number | null;
        };
        Update: {
          allow_top_storage?: boolean;
          branch_id?: string;
          can_pick?: boolean;
          can_receive?: boolean;
          can_reserve?: boolean;
          can_ship?: boolean;
          can_store_inventory?: boolean;
          code?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          depth_mm?: number | null;
          description?: string | null;
          elevation_level?: number;
          group_id?: string | null;
          height_mm?: number | null;
          icon_name?: string | null;
          id?: string;
          inherit_group_color?: boolean;
          inherit_parent_color?: boolean;
          is_temporary?: boolean;
          is_virtual?: boolean;
          level?: number;
          location_category?: string;
          location_type?: string;
          map_role?: string;
          name?: string;
          organization_id?: string;
          parent_id?: string | null;
          physical_depth_m?: number | null;
          physical_elevation_start_m?: number | null;
          physical_height_m?: number | null;
          physical_width_m?: number | null;
          qr_code?: string;
          sort_order?: number;
          status?: string;
          storage_mode?: string;
          updated_at?: string;
          updated_by?: string | null;
          weight_capacity_kg?: number | null;
          width_mm?: number | null;
        };
        Relationships: [
          {
            foreignKeyName: "warehouse_locations_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_locations_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_locations_group_id_fkey";
            columns: ["group_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_location_groups";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_locations_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_locations_parent_id_fkey";
            columns: ["parent_id"];
            isOneToOne: false;
            referencedRelation: "warehouse_locations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "warehouse_locations_updated_by_fkey";
            columns: ["updated_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_block_matches: {
        Row: {
          bc_block_id: string | null;
          block_confidence: number;
          block_match_reasons: Json | null;
          block_match_type: string;
          brand_block_id: string | null;
          created_at: string;
          id: string;
          organization_id: string;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewer_notes: string | null;
          session_id: string;
          updated_at: string;
          wdd_block_id: string | null;
        };
        Insert: {
          bc_block_id?: string | null;
          block_confidence?: number;
          block_match_reasons?: Json | null;
          block_match_type: string;
          brand_block_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          session_id: string;
          updated_at?: string;
          wdd_block_id?: string | null;
        };
        Update: {
          bc_block_id?: string | null;
          block_confidence?: number;
          block_match_reasons?: Json | null;
          block_match_type?: string;
          brand_block_id?: string | null;
          created_at?: string;
          id?: string;
          organization_id?: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          session_id?: string;
          updated_at?: string;
          wdd_block_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_block_matches_bc_block_id_fkey";
            columns: ["bc_block_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_block_matches_brand_block_id_fkey";
            columns: ["brand_block_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_block_matches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_block_matches_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_block_matches_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_block_matches_wdd_block_id_fkey";
            columns: ["wdd_block_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_blocks";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_blocks: {
        Row: {
          block_header_text: string | null;
          block_index: number;
          block_type: string;
          brand_label: string | null;
          created_at: string;
          from_section: string | null;
          id: string;
          is_excluded: boolean;
          metadata: Json | null;
          organization_id: string;
          page_number: number | null;
          session_file_id: string;
          session_id: string;
          to_section: string | null;
          warehouse_section: string | null;
        };
        Insert: {
          block_header_text?: string | null;
          block_index: number;
          block_type: string;
          brand_label?: string | null;
          created_at?: string;
          from_section?: string | null;
          id?: string;
          is_excluded?: boolean;
          metadata?: Json | null;
          organization_id: string;
          page_number?: number | null;
          session_file_id: string;
          session_id: string;
          to_section?: string | null;
          warehouse_section?: string | null;
        };
        Update: {
          block_header_text?: string | null;
          block_index?: number;
          block_type?: string;
          brand_label?: string | null;
          created_at?: string;
          from_section?: string | null;
          id?: string;
          is_excluded?: boolean;
          metadata?: Json | null;
          organization_id?: string;
          page_number?: number | null;
          session_file_id?: string;
          session_id?: string;
          to_section?: string | null;
          warehouse_section?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_blocks_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_blocks_session_file_id_fkey";
            columns: ["session_file_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_session_files";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_blocks_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_line_matches: {
        Row: {
          bc_line_id: string | null;
          block_match_id: string;
          brand_line_id: string | null;
          created_at: string;
          discrepancies: Json | null;
          id: string;
          line_confidence: number;
          line_match_reasons: Json | null;
          line_match_type: string;
          organization_id: string;
          review_status: string;
          reviewed_at: string | null;
          reviewed_by: string | null;
          reviewer_notes: string | null;
          session_id: string;
          updated_at: string;
          wdd_line_id: string | null;
        };
        Insert: {
          bc_line_id?: string | null;
          block_match_id: string;
          brand_line_id?: string | null;
          created_at?: string;
          discrepancies?: Json | null;
          id?: string;
          line_confidence?: number;
          line_match_reasons?: Json | null;
          line_match_type: string;
          organization_id: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          session_id: string;
          updated_at?: string;
          wdd_line_id?: string | null;
        };
        Update: {
          bc_line_id?: string | null;
          block_match_id?: string;
          brand_line_id?: string | null;
          created_at?: string;
          discrepancies?: Json | null;
          id?: string;
          line_confidence?: number;
          line_match_reasons?: Json | null;
          line_match_type?: string;
          organization_id?: string;
          review_status?: string;
          reviewed_at?: string | null;
          reviewed_by?: string | null;
          reviewer_notes?: string | null;
          session_id?: string;
          updated_at?: string;
          wdd_line_id?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_line_matches_bc_line_id_fkey";
            columns: ["bc_line_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_block_match_id_fkey";
            columns: ["block_match_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_block_matches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_brand_line_id_fkey";
            columns: ["brand_line_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_lines";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_reviewed_by_fkey";
            columns: ["reviewed_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_sessions";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_line_matches_wdd_line_id_fkey";
            columns: ["wdd_line_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_lines";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_lines: {
        Row: {
          block_id: string;
          created_at: string;
          id: string;
          line_number: number;
          location: string | null;
          metadata: Json | null;
          organization_id: string;
          page_number: number | null;
          product_code: string | null;
          product_name: string | null;
          quantity: number | null;
          raw_text: string | null;
          session_id: string;
          unit: string | null;
        };
        Insert: {
          block_id: string;
          created_at?: string;
          id?: string;
          line_number: number;
          location?: string | null;
          metadata?: Json | null;
          organization_id: string;
          page_number?: number | null;
          product_code?: string | null;
          product_name?: string | null;
          quantity?: number | null;
          raw_text?: string | null;
          session_id: string;
          unit?: string | null;
        };
        Update: {
          block_id?: string;
          created_at?: string;
          id?: string;
          line_number?: number;
          location?: string | null;
          metadata?: Json | null;
          organization_id?: string;
          page_number?: number | null;
          product_code?: string | null;
          product_name?: string | null;
          quantity?: number | null;
          raw_text?: string | null;
          session_id?: string;
          unit?: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_lines_block_id_fkey";
            columns: ["block_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_blocks";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_lines_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_lines_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_session_files: {
        Row: {
          brand_label: string | null;
          created_at: string;
          file_name: string;
          file_path: string | null;
          file_role: string;
          file_size: number;
          id: string;
          organization_id: string;
          parse_error: string | null;
          parsed_at: string | null;
          session_id: string;
        };
        Insert: {
          brand_label?: string | null;
          created_at?: string;
          file_name: string;
          file_path?: string | null;
          file_role: string;
          file_size?: number;
          id?: string;
          organization_id: string;
          parse_error?: string | null;
          parsed_at?: string | null;
          session_id: string;
        };
        Update: {
          brand_label?: string | null;
          created_at?: string;
          file_name?: string;
          file_path?: string | null;
          file_role?: string;
          file_size?: number;
          id?: string;
          organization_id?: string;
          parse_error?: string | null;
          parsed_at?: string | null;
          session_id?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_session_files_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_session_files_session_id_fkey";
            columns: ["session_id"];
            isOneToOne: false;
            referencedRelation: "wdd_matcher_sessions";
            referencedColumns: ["id"];
          },
        ];
      };
      wdd_matcher_sessions: {
        Row: {
          approved_at: string | null;
          approved_by: string | null;
          branch_id: string | null;
          created_at: string;
          created_by: string | null;
          id: string;
          match_summary: Json | null;
          name: string;
          organization_id: string;
          status: string;
          updated_at: string;
        };
        Insert: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          match_summary?: Json | null;
          name: string;
          organization_id: string;
          status?: string;
          updated_at?: string;
        };
        Update: {
          approved_at?: string | null;
          approved_by?: string | null;
          branch_id?: string | null;
          created_at?: string;
          created_by?: string | null;
          id?: string;
          match_summary?: Json | null;
          name?: string;
          organization_id?: string;
          status?: string;
          updated_at?: string;
        };
        Relationships: [
          {
            foreignKeyName: "wdd_matcher_sessions_approved_by_fkey";
            columns: ["approved_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_sessions_branch_id_fkey";
            columns: ["branch_id"];
            isOneToOne: false;
            referencedRelation: "branches";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_sessions_created_by_fkey";
            columns: ["created_by"];
            isOneToOne: false;
            referencedRelation: "users";
            referencedColumns: ["id"];
          },
          {
            foreignKeyName: "wdd_matcher_sessions_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Views: {
      inventory_product_list_rows_v1: {
        Row: {
          is_variant_row: boolean | null;
          organization_id: string | null;
          product_id: string | null;
          product_name: string | null;
          product_type: string | null;
          status: string | null;
          updated_at: string | null;
          variant_id: string | null;
          variant_name: string | null;
          variant_sku: string | null;
        };
        Relationships: [
          {
            foreignKeyName: "inventory_products_organization_id_fkey";
            columns: ["organization_id"];
            isOneToOne: false;
            referencedRelation: "organizations";
            referencedColumns: ["id"];
          },
        ];
      };
    };
    Functions: {
      accept_invitation_and_join_org: {
        Args: { p_token: string };
        Returns: Json;
      };
      audit_rls_permission_gate_slugs: {
        Args: never;
        Returns: {
          policy_name: string;
          slug: string;
          table_name: string;
        }[];
      };
      batch_save_warehouse_layout_shapes: {
        Args: {
          p_branch_id: string;
          p_layout_id: string;
          p_org_id: string;
          p_shapes: Json;
          p_user_id: string;
        };
        Returns: {
          anchor_location_id: string | null;
          branch_id: string;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          height: number;
          id: string;
          label: string | null;
          layout_id: string;
          location_id: string | null;
          organization_id: string;
          projection: string;
          rotation: number;
          shape_type: string;
          sort_order: number;
          style: Json | null;
          updated_at: string;
          width: number;
          x: number;
          y: number;
          z_index: number;
        }[];
        SetofOptions: {
          from: "*";
          to: "warehouse_layout_shapes";
          isOneToOne: false;
          isSetofReturn: true;
        };
      };
      can_access_comment_target: {
        Args: {
          p_action: string;
          p_org_id: string;
          p_target_id: string;
          p_target_type: string;
          p_visibility?: string;
        };
        Returns: boolean;
      };
      cascade_warehouse_location_levels: {
        Args: { p_org_id: string; p_parent_id: string; p_parent_level: number };
        Returns: undefined;
      };
      check_invitation_eligibility: {
        Args: { p_email: string; p_inviter_id: string; p_org_id: string };
        Returns: Json;
      };
      check_org_slug_available: { Args: { p_slug: string }; Returns: boolean };
      compile_user_permissions: {
        Args: { p_organization_id: string; p_user_id: string };
        Returns: undefined;
      };
      create_organization_for_current_user: {
        Args: {
          p_branch_name: string;
          p_name: string;
          p_name_2?: string;
          p_plan_id?: string;
          p_slug?: string;
        };
        Returns: Json;
      };
      create_warehouse_layout_with_root: {
        Args: {
          p_branch_id: string;
          p_canvas_height_m: number;
          p_canvas_width_m: number;
          p_layout_description: string;
          p_layout_name: string;
          p_org_id: string;
          p_root_loc_code: string;
          p_user_id: string;
        };
        Returns: {
          layout_id: string;
          root_location_id: string;
        }[];
      };
      custom_access_token_hook: { Args: { event: Json }; Returns: Json };
      decline_invitation: { Args: { p_token: string }; Returns: Json };
      delete_org_role: { Args: { p_role_id: string }; Returns: undefined };
      get_invitation_preview_by_token: {
        Args: { p_token: string };
        Returns: Json;
      };
      get_my_pending_invitations: { Args: never; Returns: Json };
      get_warehouse_location_mapping_status: {
        Args: { p_location_id: string };
        Returns: Json;
      };
      handle_user_signup_hook: { Args: { event: Json }; Returns: Json };
      has_branch_permission: {
        Args: {
          p_branch_id: string;
          p_org_id: string;
          p_permission_slug: string;
        };
        Returns: boolean;
      };
      has_permission: {
        Args: { org_id: string; permission: string };
        Returns: boolean;
      };
      helpdesk_accept_ticket: { Args: { p_ticket_id: string }; Returns: Json };
      helpdesk_create_ticket:
        | {
            Args: {
              p_assignee_ids: string[];
              p_branch_id: string;
              p_description_plain: string;
              p_description_rich: Json;
              p_due_at?: string;
              p_org_id: string;
              p_priority: string;
              p_status: string;
              p_ticket_type_id: string;
              p_title: string;
            };
            Returns: Json;
          }
        | {
            Args: {
              p_acceptor_ids?: string[];
              p_assignee_ids: string[];
              p_branch_id: string;
              p_description_plain: string;
              p_description_rich: Json;
              p_due_at?: string;
              p_org_id: string;
              p_priority: string;
              p_requires_acceptance?: boolean;
              p_status: string;
              p_ticket_type_id: string;
              p_title: string;
            };
            Returns: Json;
          };
      inventory_accept_branch_transfer: {
        Args: {
          p_actor_user_id?: string;
          p_destination_location_id: string;
          p_transfer_id: string;
        };
        Returns: Json;
      };
      inventory_approve_count_session: {
        Args: { p_actor_user_id?: string; p_count_session_id: string };
        Returns: Json;
      };
      inventory_build_sku_from_pattern: {
        Args: {
          p_padding: number;
          p_pattern: string;
          p_prefix: string;
          p_product_name: string;
          p_product_type: string;
          p_sequence: number;
        };
        Returns: string;
      };
      inventory_cancel_movement: {
        Args: {
          p_actor_user_id?: string;
          p_movement_id: string;
          p_reason?: string;
        };
        Returns: Json;
      };
      inventory_convert_quantity: {
        Args: {
          p_from_unit_id: string;
          p_organization_id: string;
          p_product_id: string;
          p_quantity: number;
          p_to_unit_id: string;
        };
        Returns: number;
      };
      inventory_create_allocation: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_lines: Json;
          p_organization_id: string;
          p_reference_id?: string;
          p_reference_number?: string;
          p_reference_type?: string;
          p_reservation_id?: string;
        };
        Returns: Json;
      };
      inventory_create_and_finalize: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_counterparty_name?: string;
          p_document_date?: string;
          p_external_reference?: string;
          p_idempotency_key?: string;
          p_lines: Json;
          p_movement_type_code: string;
          p_note?: string;
          p_operation_date?: string;
          p_organization_id: string;
        };
        Returns: Json;
      };
      inventory_create_branch_transfer: {
        Args: {
          p_actor_user_id?: string;
          p_destination_branch_id: string;
          p_lines: Json;
          p_notes?: string;
          p_organization_id: string;
          p_source_branch_id: string;
        };
        Returns: Json;
      };
      inventory_create_count_session: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_notes?: string;
          p_organization_id: string;
          p_scope?: Json;
        };
        Returns: Json;
      };
      inventory_create_draft: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_counterparty_name?: string;
          p_document_date?: string;
          p_external_reference?: string;
          p_idempotency_key?: string;
          p_lines: Json;
          p_movement_type_code: string;
          p_note?: string;
          p_operation_date?: string;
          p_organization_id: string;
        };
        Returns: Json;
      };
      inventory_create_enhanced_product: {
        Args: {
          p_actor_user_id?: string;
          p_attributes?: Json;
          p_branch_id?: string;
          p_custom_fields?: Json;
          p_organization_id: string;
          p_product: Json;
          p_tags?: Json;
          p_unit_conversions?: Json;
          p_variants?: Json;
        };
        Returns: Json;
      };
      inventory_create_product_with_default_variant: {
        Args: {
          p_actor_user_id?: string;
          p_base_unit_id: string;
          p_description?: string;
          p_name: string;
          p_organization_id: string;
          p_product_type: string;
          p_sku?: string;
        };
        Returns: Json;
      };
      inventory_create_purchase_order: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_currency?: string;
          p_delivery_location_id?: string;
          p_expected_delivery_date?: string;
          p_lines: Json;
          p_notes?: string;
          p_organization_id: string;
          p_supplier_id: string;
        };
        Returns: Json;
      };
      inventory_create_reservation: {
        Args: {
          p_actor_user_id?: string;
          p_branch_id: string;
          p_expires_at?: string;
          p_lines: Json;
          p_notes?: string;
          p_organization_id: string;
          p_reference_id?: string;
          p_reference_number?: string;
          p_reference_type?: string;
        };
        Returns: Json;
      };
      inventory_create_valuation_snapshot: {
        Args: {
          p_branch_id?: string;
          p_organization_id: string;
          p_snapshot_date?: string;
        };
        Returns: Json;
      };
      inventory_decline_branch_transfer: {
        Args: {
          p_actor_user_id?: string;
          p_decline_reason?: string;
          p_transfer_id: string;
        };
        Returns: Json;
      };
      inventory_finalize_posting: {
        Args: { p_actor_user_id?: string; p_movement_id: string };
        Returns: Json;
      };
      inventory_find_sku_collisions: {
        Args: {
          p_exclude_variant_ids?: string[];
          p_organization_id: string;
          p_skus: string[];
        };
        Returns: {
          product_id: string;
          product_name: string;
          sku: string;
          sku_fingerprint: string;
          variant_id: string;
          variant_name: string;
        }[];
      };
      inventory_get_or_create_balance_for_update:
        | {
            Args: {
              p_branch_id: string;
              p_location_id: string;
              p_movement_id: string;
              p_organization_id: string;
              p_variant_id: string;
            };
            Returns: {
              allocated_quantity: number;
              available_quantity: number | null;
              blocked: number;
              branch_id: string;
              consignment: number;
              id: string;
              last_movement_at: string | null;
              last_movement_id: string | null;
              location_id: string;
              lot_id: string | null;
              on_hand_quantity: number;
              organization_id: string;
              reserved_quantity: number;
              serial_id: string | null;
              updated_at: string;
              variant_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "inventory_balances";
              isOneToOne: true;
              isSetofReturn: false;
            };
          }
        | {
            Args: {
              p_branch_id: string;
              p_location_id: string;
              p_lot_id?: string;
              p_movement_id: string;
              p_organization_id: string;
              p_serial_id?: string;
              p_variant_id: string;
            };
            Returns: {
              allocated_quantity: number;
              available_quantity: number | null;
              blocked: number;
              branch_id: string;
              consignment: number;
              id: string;
              last_movement_at: string | null;
              last_movement_id: string | null;
              location_id: string;
              lot_id: string | null;
              on_hand_quantity: number;
              organization_id: string;
              reserved_quantity: number;
              serial_id: string | null;
              updated_at: string;
              variant_id: string;
            };
            SetofOptions: {
              from: "*";
              to: "inventory_balances";
              isOneToOne: true;
              isSetofReturn: false;
            };
          };
      inventory_preview_sku: {
        Args: {
          p_organization_id: string;
          p_product_name: string;
          p_product_type?: string;
        };
        Returns: string;
      };
      inventory_receive_purchase_order: {
        Args: {
          p_actor_user_id?: string;
          p_lines: Json;
          p_purchase_order_id: string;
        };
        Returns: Json;
      };
      inventory_reconcile_balances: {
        Args: { p_branch_id: string; p_organization_id: string };
        Returns: {
          balance_on_hand: number;
          drift: number;
          ledger_on_hand: number;
          location_id: string;
          variant_id: string;
        }[];
      };
      inventory_release_allocation: {
        Args: { p_actor_user_id?: string; p_allocation_id: string };
        Returns: Json;
      };
      inventory_release_reservation: {
        Args: {
          p_actor_user_id?: string;
          p_cancel?: boolean;
          p_reservation_id: string;
        };
        Returns: Json;
      };
      inventory_save_draft: {
        Args: {
          p_actor_user_id?: string;
          p_counterparty_name?: string;
          p_document_date?: string;
          p_external_reference?: string;
          p_lines?: Json;
          p_movement_id: string;
          p_note?: string;
          p_operation_date?: string;
        };
        Returns: Json;
      };
      inventory_seed_movement_types: {
        Args: { p_actor_user_id?: string; p_organization_id: string };
        Returns: undefined;
      };
      inventory_sku_fingerprint: { Args: { p_sku: string }; Returns: string };
      inventory_sku_token: {
        Args: { p_max?: number; p_value: string };
        Returns: string;
      };
      inventory_v1_get_or_create_balance: {
        Args: {
          p_branch_id: string;
          p_location_id: string;
          p_org_id: string;
          p_variant_id: string;
        };
        Returns: string;
      };
      is_org_member: { Args: { org_id: string }; Returns: boolean };
      is_org_owner: { Args: { p_org_id: string }; Returns: boolean };
      publish_warehouse_layout: {
        Args: { p_layout_id: string; p_user_id: string };
        Returns: undefined;
      };
      recompute_organization_entitlements: {
        Args: { p_org_id: string };
        Returns: undefined;
      };
      reorder_warehouse_location_groups: {
        Args: { p_branch_id: string; p_items: Json; p_org_id: string };
        Returns: undefined;
      };
      reparent_warehouse_location: {
        Args: {
          p_location_id: string;
          p_new_level: number;
          p_new_parent_id: string;
          p_org_id: string;
        };
        Returns: undefined;
      };
      set_branch_public_warehouse_maps: {
        Args: { p_branch_id: string; p_enabled: boolean };
        Returns: undefined;
      };
      soft_delete_warehouse_layout: {
        Args: { p_layout_id: string; p_org_id: string };
        Returns: undefined;
      };
      soft_delete_warehouse_location: {
        Args: { p_location_id: string; p_org_id: string };
        Returns: undefined;
      };
      soft_delete_warehouse_location_group: {
        Args: { p_group_id: string; p_org_id: string };
        Returns: undefined;
      };
      unpublish_warehouse_layout: {
        Args: { p_layout_id: string; p_user_id: string };
        Returns: undefined;
      };
      user_has_effective_permission: {
        Args: {
          p_organization_id: string;
          p_permission_slug: string;
          p_user_id: string;
        };
        Returns: boolean;
      };
      validate_warehouse_location_archive: {
        Args: { p_location_id: string };
        Returns: Json;
      };
      verify_locations_v2_migration: { Args: never; Returns: Json };
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
