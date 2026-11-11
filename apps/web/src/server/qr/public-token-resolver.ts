import "server-only";

import { routing } from "@/i18n/routing";
import { createServiceClient } from "@/utils/supabase/service";
import { loadDashboardContextV2 } from "@/server/loaders/v2/load-dashboard-context.v2";
import { isBranchAccessible } from "@/lib/utils/branch-access";
import { getTargetDescriptor } from "@/server/qr/target-registry";

type ResolveError =
  | "QR_NOT_FOUND"
  | "QR_REVOKED"
  | "QR_UNASSIGNED"
  | "UNSUPPORTED_TARGET_TYPE"
  | "TARGET_NOT_FOUND";

type ResolveSuccess = {
  ok: true;
  redirectPath: string;
  token: string;
  targetType: string;
  targetId: string;
};

type ResolveFailure = {
  ok: false;
  error: ResolveError;
  token: string;
};

export type PublicQrTokenResolution = ResolveSuccess | ResolveFailure;
export type PublicQrTokenFailure = ResolveFailure;

function localizeDashboardPath(path: string, locale?: string) {
  if (!locale) return path;

  const [pathname, query = ""] = path.split("?");
  const localized = routing.pathnames[pathname as keyof typeof routing.pathnames];

  if (!localized) return path;

  const localizedPath =
    typeof localized === "string"
      ? localized
      : (localized[locale as keyof typeof localized] ?? pathname);

  return query ? `${localizedPath}?${query}` : localizedPath;
}

export async function resolvePublicQrToken(
  token: string,
  options?: { locale?: string }
): Promise<PublicQrTokenResolution> {
  const client = createServiceClient();

  const { data: qrCode, error: qrError } = await client
    .from("qr_codes")
    .select("id, token, organization_id, status, deleted_at")
    .eq("token", token)
    .maybeSingle();

  if (qrError || !qrCode || qrCode.deleted_at !== null) {
    return { ok: false, error: "QR_NOT_FOUND", token };
  }

  if (qrCode.status !== "active") {
    return { ok: false, error: "QR_REVOKED", token };
  }

  const { data: assignment, error: assignmentError } = await client
    .from("qr_assignments")
    .select("target_type, target_id, branch_id")
    .eq("qr_code_id", qrCode.id)
    .is("revoked_at", null)
    .maybeSingle();

  if (assignmentError) {
    return { ok: false, error: "TARGET_NOT_FOUND", token };
  }

  if (!assignment) {
    return { ok: false, error: "QR_UNASSIGNED", token };
  }

  const descriptor = getTargetDescriptor(assignment.target_type);
  if (!descriptor) {
    return { ok: false, error: "UNSUPPORTED_TARGET_TYPE", token };
  }

  const validation = await descriptor.validate({
    supabase: client,
    targetId: assignment.target_id,
    orgId: qrCode.organization_id,
  });

  if (!validation.valid) {
    return { ok: false, error: "TARGET_NOT_FOUND", token };
  }

  let orgSlug = qrCode.organization_id;
  let branchSlug: string | null = null;

  const [{ data: orgRow }, branchResult] = await Promise.all([
    client.from("organizations").select("slug").eq("id", qrCode.organization_id).maybeSingle(),
    validation.branchId
      ? client.from("branches").select("slug").eq("id", validation.branchId).maybeSingle()
      : Promise.resolve({ data: null }),
  ]);

  orgSlug = (orgRow as { slug?: string | null } | null)?.slug ?? orgSlug;
  branchSlug = (branchResult.data as { slug?: string | null } | null)?.slug ?? null;

  let rawPath = descriptor.resolvePathAsync
    ? await descriptor.resolvePathAsync({
        supabase: client,
        targetId: assignment.target_id,
        orgSlug,
        branchSlug,
      })
    : descriptor.resolverPath({
        targetId: assignment.target_id,
        orgSlug,
        branchSlug,
      });

  // Cross-branch deep-link UX hint (Zone 1 / Phase 6, corrected 2026-09-24):
  // if the target belongs to a branch other than the caller's own currently
  // active branch, and the caller actually has access to that branch, flag
  // it so the destination page can offer a confirm-then-switch prompt
  // instead of silently discarding the deep-link intent. This is a UX signal
  // only -- never authorization evidence. The actual branch switch still
  // goes through the existing, authoritative changeBranch() server action,
  // which always re-validates access fresh; nothing here grants or implies
  // access. `isBranchAccessible` is the same check changeBranch() itself
  // uses (extracted to `@/lib/utils/branch-access`, not reimplemented), so
  // the UX hint and the actual authorization decision can never drift apart.
  //
  // Uses loadDashboardContextV2() -- the same authoritative, request-cached
  // context loader every dashboard page and changeBranch() itself already
  // use -- rather than a bespoke lookup, so "is this caller logged in" and
  // "what can they access" are both answered by the one existing mechanism.
  // Returns null for an anonymous caller, in which case this block redirects
  // to sign-in instead (see Correction B below) rather than proceeding.
  if (validation.branchId) {
    const dashboardContext = await loadDashboardContextV2();

    if (!dashboardContext) {
      // Correction B (2026-09-24): send the caller through sign-in with a
      // returnUrl pointing back at THIS qr page, not at the pre-computed
      // dashboard path. dashboard/layout.tsx's own returnUrl mechanism only
      // preserves the request PATHNAME (x-pathname is
      // request.nextUrl.pathname, which excludes the query string) -- so
      // redirecting straight to `rawPath` (which carries `selected=...`)
      // would silently lose that query string the moment the dashboard
      // layout's auth gate bounces the still-unauthenticated request to
      // sign-in. The qr page itself has no query string to lose (the token
      // lives in the path), so returning here after login re-enters this
      // resolver in full, under the now-authenticated context, before any
      // dashboard redirect is ever computed -- guaranteeing the branch-aware
      // logic above always runs before the target opens, and guaranteeing
      // the exact target survives the round trip.
      const qrPath = options?.locale ? `/${options.locale}/qr/${token}` : `/qr/${token}`;
      const signInPath = `/sign-in?returnUrl=${encodeURIComponent(qrPath)}`;
      return {
        ok: true,
        redirectPath: localizeDashboardPath(signInPath, options?.locale),
        token,
        targetType: assignment.target_type,
        targetId: assignment.target_id,
      };
    }

    const callerActiveBranchId = dashboardContext.app.activeBranchId;

    if (callerActiveBranchId && callerActiveBranchId !== validation.branchId) {
      const hasAccess = isBranchAccessible(
        validation.branchId,
        dashboardContext.app.accessibleBranches,
        dashboardContext.user.permissionSnapshot
      );

      if (hasAccess) {
        const separator = rawPath.includes("?") ? "&" : "?";
        rawPath = `${rawPath}${separator}crossBranch=${validation.branchId}`;
      } else {
        // Correction A (2026-09-24): the caller cannot access the target's
        // branch. Do NOT offer a "switch branch" confirmation -- changeBranch()
        // would always reject it, so the dialog would be an impossible-UX
        // action, and its mere appearance would reveal "a location exists in
        // a branch you can't access" as an actionable-looking offer, which
        // the accepted contract explicitly forbids. Reuse the resolver's own
        // existing TARGET_NOT_FOUND failure shape (already used for
        // cross-org and soft-deleted targets) rather than inventing a new
        // error variant -- reveals nothing beyond "not available".
        return { ok: false, error: "TARGET_NOT_FOUND", token };
      }
    }
  }

  return {
    ok: true,
    redirectPath: localizeDashboardPath(rawPath, options?.locale),
    token,
    targetType: assignment.target_type,
    targetId: assignment.target_id,
  };
}
