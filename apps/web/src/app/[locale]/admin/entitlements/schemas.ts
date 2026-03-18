import { z } from "zod";
import { LIMIT_KEYS } from "@/lib/types/entitlements";
import { AdminActionError } from "@/server/services/entitlements-admin.service";

export const planNameSchema = z.string().min(1, "Plan name is required");
export const moduleSlugSchema = z.string().min(1, "Module slug is required");
export const limitKeySchema = z.enum(Object.values(LIMIT_KEYS) as [string, ...string[]]);
export const overrideValueSchema = z.coerce
  .number({ invalid_type_error: "Override value must be a number" })
  .int("Override value must be an integer")
  .min(-1, "Override value must be >= -1");

export const ADMIN_PATH = "/[locale]/admin/entitlements";

export function isAdminActionError(error: unknown): error is AdminActionError {
  if (error instanceof AdminActionError) {
    return true;
  }

  return (
    error !== null &&
    typeof error === "object" &&
    "publicMessage" in error &&
    typeof (error as any).publicMessage === "string"
  );
}

export function logActionError(
  action: string,
  meta: Record<string, unknown>,
  error: unknown
): void {
  let errorInfo: Record<string, unknown>;

  if (isAdminActionError(error)) {
    errorInfo = {
      name: "AdminActionError",
      publicMessage: error.publicMessage,
      code: error.code ?? undefined,
    };
  } else if (error instanceof Error) {
    errorInfo = {
      name: error.name,
      isError: true,
    };
  } else {
    errorInfo = {
      valueType: typeof error,
    };
  }

  console.error(`[EntitlementsAdmin] ${action} failed`, {
    ...meta,
    error: errorInfo,
  });
}
