"use client";

import type { ComponentType } from "react";

/**
 * Tool Component Registry
 *
 * Maps tool slugs to their React UI components.
 * When a user has enabled a tool, this component is rendered on /dashboard/tools/[slug].
 *
 * Usage:
 *   import { MyTool } from "@/modules/my-tool/components/my-tool";
 *   TOOL_REGISTRY["my-tool"] = MyTool;
 *
 * Or register inline below:
 *   const TOOL_REGISTRY: ToolRegistry = {
 *     "qr-generator": QrGeneratorTool,
 *   };
 */

export type ToolRegistry = Record<string, ComponentType>;

/**
 * Add entries here as tool UI components are implemented.
 * The key must match the tool's slug in the tools_catalog table.
 */
const TOOL_REGISTRY: ToolRegistry = {
  // "qr-generator": QrGeneratorTool,
  // "text-converter": TextConverterTool,
};

export function getToolComponent(slug: string): ComponentType | null {
  return TOOL_REGISTRY[slug] ?? null;
}
