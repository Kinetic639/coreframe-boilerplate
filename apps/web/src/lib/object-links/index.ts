/**
 * Where an object of the app opens: the one place that turns a type and an
 * identifier into an internal route. Used by the global search (Ctrl+K), by
 * "@" mentions in chats and comments, and by anything else that links to an
 * object it only knows by type, id and (optionally) number.
 *
 * Routes are next-intl pathnames (`/dashboard/help-desk/tickets`), localized
 * by the Link / router that renders them.
 */

export interface ObjectRoute {
  pathname: string;
  query?: Record<string, string>;
}

export interface ObjectRef {
  /** Internal id (UUID) */
  id: string;
  /** Human number / code (`HD-000001`, `PT-000042`, a SKU); optional */
  code?: string | null;
  /** Display title, for routes that search by it */
  title?: string | null;
  /** Extra details (comments and attachments: `targetType`, `targetId`) */
  meta?: Record<string, unknown> | null;
}

/** Comment / attachment target types → object types */
const TARGET_TYPES: Record<string, string> = {
  "helpdesk.ticket": "ticket",
  "planning.task": "task",
  "workshop.repair_order": "repairOrder",
};

/** A ticket or task number (`HD-000001`, `PT-000042`); anything else is not one */
const NUMBER_RE = /^[A-Z][A-Z0-9]*-\d+$/i;

const path = (pathname: string, query?: Record<string, string>): ObjectRoute =>
  query ? { pathname, query } : { pathname };

/**
 * The route of an object, or null when its type has no page. Tickets and
 * tasks open in their list's side panel by number (`?selected=HD-000001`);
 * without a number they fall back to the detail page by id, which accepts a
 * UUID and redirects to the number.
 */
export function objectRoute(type: string, ref: ObjectRef): ObjectRoute | null {
  const { id } = ref;
  const code = ref.code?.trim() || null;
  const number = code && NUMBER_RE.test(code) ? code.toUpperCase() : null;
  const seg = encodeURIComponent(id);

  switch (type) {
    case "repairOrder":
      return path(`/dashboard/workshop/${seg}`);
    case "ticket":
      return number
        ? path("/dashboard/help-desk/tickets", { selected: number })
        : path(`/dashboard/help-desk/tickets/${seg}`);
    case "task":
      return number
        ? path("/dashboard/planning/tasks", { selected: number })
        : path(`/dashboard/planning/tasks/${seg}`);
    case "document":
      return path(`/dashboard/warehouse/inventory/movements/${seg}`);
    case "container":
      return path(`/dashboard/warehouse/containers/${seg}`);
    case "location":
      return path("/dashboard/warehouse/locations", { selected: id, view: "tree" });
    case "item":
      return path(`/dashboard/warehouse/items/${seg}`);
    case "person":
      return path(`/dashboard/organization/users/members/${seg}`);
    case "party":
      return path("/dashboard/crm/parties", { selected: id });
    case "contact":
      return path("/dashboard/crm/contacts", { selected: id });
    case "audit":
      return path(`/dashboard/warehouse/audits/${seg}/count`);
    case "matcherSession":
      // The Matcher tool lists its sessions; it has no per-session URL yet
      return path("/dashboard/tools/svwms-wdd-matcher");
    case "qrCode":
      // The QR page resolves the code's assignment (and its branch)
      return path(`/qr/${encodeURIComponent(code ?? id)}`);
    case "board":
      return path("/dashboard/planning/boards", { board: id });
    case "map":
      return path(`/dashboard/warehouse/map/${seg}`);
    case "ticketType":
      return path(`/dashboard/help-desk/ticket-types/${seg}`);
    case "invitation":
      return path("/dashboard/organization/users/invitations", { search: ref.title ?? "" });
    case "comment":
    case "attachment": {
      // The page of the object the comment / file belongs to
      const targetType = typeof ref.meta?.targetType === "string" ? ref.meta.targetType : "";
      const targetId = typeof ref.meta?.targetId === "string" ? ref.meta.targetId : "";
      const target = targetId ? targetRoute(targetType, targetId) : null;
      if (target) return target;
      // Kanban cards (and future targets) open their module
      return path("/dashboard/planning/boards");
    }
    default:
      return null;
  }
}

/**
 * Route of a comment / attachment / notification target (`helpdesk.ticket`,
 * `planning.task`, `workshop.repair_order`), or null for other targets.
 */
export function targetRoute(
  targetType: string,
  targetId: string,
  code?: string | null
): ObjectRoute | null {
  const type = TARGET_TYPES[targetType];
  return type ? objectRoute(type, { id: targetId, code }) : null;
}

/** The route as one string (`/dashboard/help-desk/tickets?selected=HD-000001`) */
export function objectHref(route: ObjectRoute): string {
  const search = route.query ? new URLSearchParams(route.query).toString() : "";
  return search ? `${route.pathname}?${search}` : route.pathname;
}
