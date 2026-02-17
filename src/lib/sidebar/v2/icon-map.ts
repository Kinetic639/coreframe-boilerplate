"use client";

import {
  Home,
  Warehouse,
  Users,
  Settings,
  BarChart3,
  FileText,
  MessageSquare,
  Calendar,
  Package,
  MapPin,
  HelpCircle,
  Code,
  UserCircle,
  SlidersHorizontal,
} from "lucide-react";
import type { IconKey } from "@/lib/types/v2/sidebar";

/**
 * Icon key to lucide component mapping
 *
 * IMPORTANT: Only import this on client side.
 * Server uses iconKey strings only.
 */
export const ICON_MAP: Record<IconKey, React.ComponentType<{ className?: string }>> = {
  home: Home,
  warehouse: Warehouse,
  users: Users,
  settings: Settings,
  analytics: BarChart3,
  documentation: FileText,
  chat: MessageSquare,
  calendar: Calendar,
  products: Package,
  locations: MapPin,
  support: HelpCircle,
  development: Code,
  profile: UserCircle,
  preferences: SlidersHorizontal,
};

/**
 * Get icon component by key (client-side only)
 */
export function getIconComponent(key: string) {
  return ICON_MAP[key as IconKey] || Settings; // Fallback to Settings icon
}
