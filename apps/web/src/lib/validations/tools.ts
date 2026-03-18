import { z } from "zod";

/**
 * Tools Module — Zod Validation Schemas
 *
 * Strict schemas for all tools-related server action inputs.
 * No `any` types; all user-facing validation messages use translation keys
 * that are resolved by the calling layer before display.
 */

export const toolSlugSchema = z
  .string()
  .min(1, { message: "tools.validation.slugRequired" })
  .max(100, { message: "tools.validation.slugTooLong" })
  .regex(/^[a-z0-9-]+$/, { message: "tools.validation.slugInvalid" });

/**
 * Schema for enabling or disabling a tool (setToolEnabled action)
 */
export const setToolEnabledSchema = z.object({
  toolSlug: toolSlugSchema,
  enabled: z.boolean(),
});

export type SetToolEnabledInput = z.infer<typeof setToolEnabledSchema>;

/**
 * Schema for pinning or unpinning a tool (setToolPinned action)
 */
export const setToolPinnedSchema = z.object({
  toolSlug: toolSlugSchema,
  pinned: z.boolean(),
});

export type SetToolPinnedInput = z.infer<typeof setToolPinnedSchema>;

/**
 * Schema for updating per-tool settings (updateToolSettings action)
 */
export const updateToolSettingsSchema = z.object({
  toolSlug: toolSlugSchema,
  settings: z.record(z.string(), z.unknown()).default({}),
});

export type UpdateToolSettingsInput = z.infer<typeof updateToolSettingsSchema>;
