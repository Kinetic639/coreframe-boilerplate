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
      warehouse_locations: {
        Row: {
          allow_top_storage: boolean;
          branch_id: string;
          code: string | null;
          color: string | null;
          created_at: string;
          created_by: string | null;
          deleted_at: string | null;
          description: string | null;
          group_id: string | null;
          icon_name: string | null;
          id: string;
          inherit_group_color: boolean;
          inherit_parent_color: boolean;
          level: number;
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
          storage_mode: string;
          updated_at: string;
          updated_by: string | null;
        };
        Insert: {
          allow_top_storage?: boolean;
          branch_id: string;
          code?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          group_id?: string | null;
          icon_name?: string | null;
          id?: string;
          inherit_group_color?: boolean;
          inherit_parent_color?: boolean;
          level?: number;
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
          storage_mode?: string;
          updated_at?: string;
          updated_by?: string | null;
        };
        Update: {
          allow_top_storage?: boolean;
          branch_id?: string;
          code?: string | null;
          color?: string | null;
          created_at?: string;
          created_by?: string | null;
          deleted_at?: string | null;
          description?: string | null;
          group_id?: string | null;
          icon_name?: string | null;
          id?: string;
          inherit_group_color?: boolean;
          inherit_parent_color?: boolean;
          level?: number;
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
          storage_mode?: string;
          updated_at?: string;
          updated_by?: string | null;
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
      [_ in never]: never;
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
