/**
 * Event Visual Model — Centralized Taxonomy-to-Visual Mapping
 *
 * Single source of truth for event taxonomy visual representation:
 *   - category  → primary icon key (lucide-react icon name)
 *   - intent    → secondary icon key (lucide-react icon name)
 *   - intent    → Tailwind color class
 *
 * Server-safe: no "use client" directive, no React imports.
 * The mappings here are plain string records — they can be imported from
 * both server and client code.
 *
 * Rendering rule (enforced by architecture):
 *   The UI must read `category` and `intent` from the projected event and
 *   resolve visuals through this module. It must NEVER inspect `action_key`
 *   to determine icons or colors.
 *
 * Icon names here map to lucide-react components via EventCategoryIcon and
 * EventIntentIcon in src/components/audit/event-icons.tsx.
 */

import type { EventCategory, EventIntent } from "@/server/audit/types";

// ---------------------------------------------------------------------------
// Category icon map
// ---------------------------------------------------------------------------

/**
 * Maps EventCategory → lucide-react icon name (kebab-case).
 * The category icon is the PRIMARY icon representing the event domain.
 *
 * Rule: each category has exactly one stable icon. Never changes for a given
 * category value. Safe for SSR — only string values, no component references.
 */
export const CATEGORY_ICON_MAP: Record<EventCategory, string> = {
  AUTH: "log-in",
  SECURITY: "shield-alert",
  MEMBERSHIP: "users",
  INVITATION: "mail",
  ORGANIZATION: "building-2",
  USER: "user",
  SYSTEM: "cpu",
  DATA: "database",
  STATE: "refresh-cw",
  AUTOMATION: "bot",
  WAREHOUSE: "warehouse",
  QR: "qr-code",
};

// ---------------------------------------------------------------------------
// Intent icon map
// ---------------------------------------------------------------------------

/**
 * Maps EventIntent → lucide-react icon name (kebab-case).
 * The intent icon is the SECONDARY icon representing the action type.
 *
 * Rule: each intent has exactly one stable icon. Never changes for a given
 * intent value. Safe for SSR — only string values, no component references.
 */
export const INTENT_ICON_MAP: Record<EventIntent, string> = {
  CREATE: "plus-circle",
  UPDATE: "pencil",
  DELETE: "trash-2",
  REMOVE: "minus",
  ASSIGN: "link",
  ACCEPT: "check",
  DECLINE: "x",
  SUCCESS: "check-circle",
  FAIL: "x-circle",
  REQUEST: "clock",
};

// ---------------------------------------------------------------------------
// Intent color map
// ---------------------------------------------------------------------------

/**
 * Maps EventIntent → Tailwind CSS color class for the intent icon.
 *
 * Color semantics:
 *   green  — positive outcomes (CREATE, SUCCESS, ACCEPT)
 *   blue   — informational operations (UPDATE, REQUEST)
 *   red    — destructive or negative outcomes (DELETE, DECLINE, FAIL)
 *   orange — non-destructive removal of relationships (REMOVE)
 *   purple — binding operations (ASSIGN, ACCEPT)
 *
 * Note: ACCEPT uses purple to align with ASSIGN (both establish a relationship
 * or affirm a binding). SUCCESS uses green (positive terminal outcome).
 */
export const INTENT_COLOR_MAP: Record<EventIntent, string> = {
  CREATE: "text-green-600",
  UPDATE: "text-blue-600",
  DELETE: "text-red-600",
  REMOVE: "text-orange-600",
  ASSIGN: "text-purple-600",
  ACCEPT: "text-purple-600",
  DECLINE: "text-red-600",
  SUCCESS: "text-green-600",
  FAIL: "text-red-600",
  REQUEST: "text-blue-600",
};

// ---------------------------------------------------------------------------
// Human-readable labels (optional — useful for tooltips and filter chips)
// ---------------------------------------------------------------------------

/** Maps EventCategory → display label. */
export const CATEGORY_LABEL_MAP: Record<EventCategory, string> = {
  AUTH: "Authentication",
  SECURITY: "Security",
  MEMBERSHIP: "Membership",
  INVITATION: "Invitation",
  ORGANIZATION: "Organization",
  USER: "User",
  SYSTEM: "System",
  DATA: "Data",
  STATE: "State",
  AUTOMATION: "Automation",
  WAREHOUSE: "Warehouse",
  QR: "QR Codes",
};

/** Maps EventIntent → display label. */
export const INTENT_LABEL_MAP: Record<EventIntent, string> = {
  CREATE: "Created",
  UPDATE: "Updated",
  DELETE: "Deleted",
  REMOVE: "Removed",
  ASSIGN: "Assigned",
  ACCEPT: "Accepted",
  DECLINE: "Declined",
  SUCCESS: "Completed",
  FAIL: "Failed",
  REQUEST: "Requested",
};
