export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[];

export type Database = {
  // Allows to automatically instantiate createClient with right options
  // instead of createClient<Database, { PostgrestVersion: 'XX' }>(URL, KEY)
  __InternalSupabase: {
    PostgrestVersion: "14.1";
  };
  public: {
    Tables: {
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
    };
    Views: {
      [_ in never]: never;
    };
    Functions: {
      accept_invitation_and_join_org: {
        Args: { p_token: string };
        Returns: Json;
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
      recompute_organization_entitlements: {
        Args: { p_org_id: string };
        Returns: undefined;
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
