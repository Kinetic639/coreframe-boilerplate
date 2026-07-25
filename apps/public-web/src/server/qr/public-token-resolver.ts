import "server-only";

import { routing } from "@/i18n/routing";
import { createServiceClient } from "@/utils/supabase/service";
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

  const rawPath = descriptor.resolvePathAsync
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

  return {
    ok: true,
    redirectPath: localizeDashboardPath(rawPath, options?.locale),
    token,
    targetType: assignment.target_type,
    targetId: assignment.target_id,
  };
}
