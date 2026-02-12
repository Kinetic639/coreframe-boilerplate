import { z } from "zod";
import { LIMIT_KEYS } from "@/lib/types/entitlements";

export const planNameSchema = z.string().min(1, "Plan name is required");
export const moduleSlugSchema = z.string().min(1, "Module slug is required");
export const limitKeySchema = z.enum(Object.values(LIMIT_KEYS) as [string, ...string[]]);
export const overrideValueSchema = z.coerce
  .number({ invalid_type_error: "Override value must be a number" })
  .int("Override value must be an integer")
  .min(-1, "Override value must be >= -1");

export const ADMIN_PATH = "/[locale]/admin/entitlements";
