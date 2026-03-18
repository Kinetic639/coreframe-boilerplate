/**
 * @deprecated PermissionCompiler is RETIRED.
 *
 * DB triggers are the sole compiler for `user_effective_permissions`.
 * `trigger_compile_on_role_assignment` fires on every INSERT/UPDATE/DELETE of
 * `user_role_assignments` and calls `compile_user_permissions(user_id, org_id)`,
 * which writes branch-aware UEP rows (branch_id = NULL for org-scope, branch_id =
 * ura.scope_id for branch-scope).
 *
 * TypeScript-side compilation is PROHIBITED because:
 *  1. It cannot correctly set `branch_id` per row — it flattens all roles together.
 *  2. It duplicates DB trigger logic without the advisory lock protection.
 *  3. It would corrupt branch-scoped UEP rows the DB trigger correctly maintains.
 *
 * Do NOT add call sites for this class. It will throw at runtime.
 *
 * @see compile_user_permissions DB function
 * @see trigger_compile_on_role_assignment DB trigger
 */

import { SupabaseClient } from "@supabase/supabase-js";

export interface CompileResult {
  success: boolean;
  permissionCount: number;
  error?: string;
}

export interface RecompileResult {
  success: boolean;
  usersUpdated: number;
  errors?: string[];
}

export class PermissionCompiler {
  /** @internal Throw on every call — see class-level deprecation notice. */
  private static _throwRetired(method: string): never {
    throw new Error(
      `[PermissionCompiler.${method}] RETIRED: TypeScript-side UEP compilation is prohibited. ` +
        "DB trigger 'trigger_compile_on_role_assignment' is the sole authoritative compiler. " +
        "Do not call PermissionCompiler in production or test code."
    );
  }

  /**
   * @deprecated RETIRED — always throws. See class-level deprecation notice.
   */
  static async compileForUser(
    _supabase: SupabaseClient,
    _userId: string,
    _organizationId: string
  ): Promise<CompileResult> {
    this._throwRetired("compileForUser");
  }

  /**
   * @deprecated RETIRED — always throws. See class-level deprecation notice.
   */
  static async recompileForRole(
    _supabase: SupabaseClient,
    _roleId: string
  ): Promise<RecompileResult> {
    this._throwRetired("recompileForRole");
  }

  /**
   * @deprecated RETIRED — always throws. See class-level deprecation notice.
   */
  static async recompileForOrganization(
    _supabase: SupabaseClient,
    _organizationId: string
  ): Promise<RecompileResult> {
    this._throwRetired("recompileForOrganization");
  }
}
