import { MenuItem } from "@/lib/types/module";

/**
 * Recursively checks if any menu item or nested submenu item matches the given pathname
 */
export function checkIsActive(items: MenuItem[], pathname: string): boolean {
  for (const item of items) {
    if ("path" in item && pathname === item.path) {
      return true;
    }
    if ("submenu" in item && item.submenu && checkIsActive(item.submenu, pathname)) {
      return true;
    }
  }
  return false;
}

/**
 * Recursively checks if any child menu item matches the pathname (for parent highlighting)
 */
export function hasActiveChild(items: MenuItem[], pathname: string): boolean {
  for (const item of items) {
    if ("path" in item && pathname === item.path) {
      return true;
    }
    if ("submenu" in item && item.submenu && hasActiveChild(item.submenu, pathname)) {
      return true;
    }
  }
  return false;
}

/**
 * Checks if the current item or any of its descendants is in the active path
 */
export function isInActivePath(item: MenuItem, pathname: string): boolean {
  // Check if this item is active
  if ("path" in item && pathname === item.path) {
    return true;
  }

  // Check if any descendant is active
  if ("submenu" in item && item.submenu) {
    return hasActiveChild(item.submenu, pathname);
  }

  return false;
}
