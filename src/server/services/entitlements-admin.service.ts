"use server";

import type { SupabaseClient } from "@supabase/supabase-js";

/**
 * Admin action error with sanitized public message
 *
 * Used to separate detailed server-side error context (logged) from
 * safe user-facing messages (returned to UI).
 */
export class AdminActionError extends Error {
  public readonly publicMessage: string;
  public readonly code?: string;

  constructor(publicMessage: string, code?: string) {
    super(publicMessage);
    this.name = "AdminActionError";
    this.publicMessage = publicMessage;
    this.code = code;
  }
}

/**
 * Entitlements Admin Service (Server-Side Only)
 *
 * Thin service layer for dev-mode entitlements admin mutations.
 * Each method enforces invariants (dev mode + org owner) then delegates to dev_* RPCs.
 *
 * This is the ONLY layer that calls Supabase RPCs for entitlements admin mutations.
 * Client components must never call these RPCs directly.
 *
 * **Observability**: Logs structured error context (orgId, RPC name, error code/message)
 * to server logs while throwing sanitized user-facing messages.
 */
export class EntitlementsAdminService {
  /**
   * Assert dev mode is enabled in app_config.
   * @throws AdminActionError if dev mode is disabled or config cannot be read
   */
  static async assertDevModeEnabled(supabase: SupabaseClient): Promise<void> {
    const { data, error } = await supabase
      .from("app_config")
      .select("dev_mode_enabled")
      .eq("id", 1)
      .maybeSingle();

    if (error) {
      console.error("[EntitlementsAdminService] assertDevModeEnabled query failed", {
        code: error.code,
        message: error.message,
        details: error.details,
      });
      throw new AdminActionError("Failed to check dev mode status", error.code);
    }

    if (!data?.dev_mode_enabled) {
      throw new AdminActionError("Dev mode is disabled");
    }
  }

  /**
   * Assert current user is org owner via is_org_owner RPC.
   * @throws AdminActionError if not org owner or RPC fails
   */
  static async assertOrgOwner(supabase: SupabaseClient, orgId: string): Promise<void> {
    const { data: isOwner, error } = await supabase.rpc("is_org_owner", {
      p_org_id: orgId,
    });

    if (error) {
      console.error("[EntitlementsAdminService] is_org_owner RPC failed", {
        orgId,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to verify org ownership", error.code);
    }

    if (!isOwner) {
      throw new AdminActionError("Permission denied: not org owner");
    }
  }

  /**
   * Switch organization plan via dev_set_org_plan RPC.
   * @throws AdminActionError with sanitized message on failure
   */
  static async switchPlan(
    supabase: SupabaseClient,
    orgId: string,
    planName: string
  ): Promise<void> {
    const { error } = await supabase.rpc("dev_set_org_plan", {
      p_org_id: orgId,
      p_plan_name: planName,
    });

    if (error) {
      console.error("[EntitlementsAdminService] dev_set_org_plan RPC failed", {
        orgId,
        planName,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to switch plan", error.code);
    }
  }

  /**
   * Add module addon via dev_add_module_addon RPC.
   * @throws AdminActionError with sanitized message on failure
   */
  static async addModuleAddon(
    supabase: SupabaseClient,
    orgId: string,
    moduleSlug: string
  ): Promise<void> {
    const { error } = await supabase.rpc("dev_add_module_addon", {
      p_org_id: orgId,
      p_module_slug: moduleSlug,
    });

    if (error) {
      console.error("[EntitlementsAdminService] dev_add_module_addon RPC failed", {
        orgId,
        moduleSlug,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to add module addon", error.code);
    }
  }

  /**
   * Remove module addon via dev_remove_module_addon RPC.
   * @throws AdminActionError with sanitized message on failure
   */
  static async removeModuleAddon(
    supabase: SupabaseClient,
    orgId: string,
    moduleSlug: string
  ): Promise<void> {
    const { error } = await supabase.rpc("dev_remove_module_addon", {
      p_org_id: orgId,
      p_module_slug: moduleSlug,
    });

    if (error) {
      console.error("[EntitlementsAdminService] dev_remove_module_addon RPC failed", {
        orgId,
        moduleSlug,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to remove module addon", error.code);
    }
  }

  /**
   * Set limit override via dev_set_limit_override RPC.
   * @throws AdminActionError with sanitized message on failure
   */
  static async setLimitOverride(
    supabase: SupabaseClient,
    orgId: string,
    limitKey: string,
    value: number
  ): Promise<void> {
    const { error } = await supabase.rpc("dev_set_limit_override", {
      p_org_id: orgId,
      p_limit_key: limitKey,
      p_override_value: value,
    });

    if (error) {
      console.error("[EntitlementsAdminService] dev_set_limit_override RPC failed", {
        orgId,
        limitKey,
        value,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to set limit override", error.code);
    }
  }

  /**
   * Reset organization to free plan via dev_reset_org_to_free RPC.
   * @throws AdminActionError with sanitized message on failure
   */
  static async resetToFree(supabase: SupabaseClient, orgId: string): Promise<void> {
    const { error } = await supabase.rpc("dev_reset_org_to_free", {
      p_org_id: orgId,
    });

    if (error) {
      console.error("[EntitlementsAdminService] dev_reset_org_to_free RPC failed", {
        orgId,
        code: error.code,
        message: error.message,
      });
      throw new AdminActionError("Failed to reset to free plan", error.code);
    }
  }
}
