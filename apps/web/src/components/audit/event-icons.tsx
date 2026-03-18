"use client";

/**
 * Event Icon Components — Client-Side Only
 *
 * Renders category and intent icons for projected events.
 * Resolves icon keys from event-visual-model.ts to lucide-react components.
 *
 * Architecture rule: these components consume `category` and `intent` from
 * ProjectedEvent. They do NOT inspect `action_key`.
 *
 * Usage:
 *   <EventCategoryIcon category={event.category} className="h-4 w-4" />
 *   <EventIntentIcon intent={event.intent} />
 */

import {
  // Category icons
  LogIn,
  ShieldAlert,
  Users,
  Mail,
  Building2,
  User,
  Cpu,
  Database,
  RefreshCw,
  Bot,
  // Intent icons
  PlusCircle,
  Pencil,
  Trash2,
  Minus,
  Link,
  Check,
  X,
  CheckCircle,
  XCircle,
  Clock,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { INTENT_COLOR_MAP } from "@/lib/audit/event-visual-model";
import type { EventCategory, EventIntent } from "@/server/audit/types";
import type { LucideIcon } from "lucide-react";

// ---------------------------------------------------------------------------
// Category icon component map
// ---------------------------------------------------------------------------

const CATEGORY_ICON_COMPONENTS: Record<EventCategory, LucideIcon> = {
  AUTH: LogIn,
  SECURITY: ShieldAlert,
  MEMBERSHIP: Users,
  INVITATION: Mail,
  ORGANIZATION: Building2,
  USER: User,
  SYSTEM: Cpu,
  DATA: Database,
  STATE: RefreshCw,
  AUTOMATION: Bot,
};

// ---------------------------------------------------------------------------
// Intent icon component map
// ---------------------------------------------------------------------------

const INTENT_ICON_COMPONENTS: Record<EventIntent, LucideIcon> = {
  CREATE: PlusCircle,
  UPDATE: Pencil,
  DELETE: Trash2,
  REMOVE: Minus,
  ASSIGN: Link,
  ACCEPT: Check,
  DECLINE: X,
  SUCCESS: CheckCircle,
  FAIL: XCircle,
  REQUEST: Clock,
};

// ---------------------------------------------------------------------------
// EventCategoryIcon
// ---------------------------------------------------------------------------

interface EventCategoryIconProps {
  category: EventCategory;
  className?: string;
}

/**
 * Renders the primary domain icon for an event category.
 * Icon is intentionally muted — it communicates domain context, not urgency.
 */
export function EventCategoryIcon({ category, className }: EventCategoryIconProps) {
  const Icon = CATEGORY_ICON_COMPONENTS[category];
  return <Icon className={cn("h-4 w-4", className)} aria-hidden />;
}

// ---------------------------------------------------------------------------
// EventIntentIcon
// ---------------------------------------------------------------------------

interface EventIntentIconProps {
  intent: EventIntent;
  className?: string;
  /** If true, applies the canonical intent color. Defaults to true. */
  colored?: boolean;
}

/**
 * Renders the secondary action icon for an event intent.
 * Applies the canonical intent color by default.
 */
export function EventIntentIcon({ intent, className, colored = true }: EventIntentIconProps) {
  const Icon = INTENT_ICON_COMPONENTS[intent];
  const colorClass = colored ? INTENT_COLOR_MAP[intent] : undefined;
  return <Icon className={cn("h-3 w-3", colorClass, className)} aria-hidden />;
}
