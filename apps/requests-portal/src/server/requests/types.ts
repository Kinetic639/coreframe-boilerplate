/** Statuses stored in helpdesk_tickets.status (see docs/REQUESTS_PORTAL_PLAN.md, 3a). */
export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "waiting_response",
  "resolved",
  "closed",
  "cancelled",
] as const;
export type TicketStatus = (typeof TICKET_STATUSES)[number];

/**
 * What the advisor sees. `approval` is derived (requires_acceptance and not yet
 * accepted), `yourTurn` is waiting_response (the parts department needs an answer).
 */
export type RequestState =
  | "approval"
  | "new"
  | "progress"
  | "vendor"
  | "yourTurn"
  | "answered"
  | "closed"
  | "cancelled";

export function requestState(t: {
  status: string;
  requires_acceptance: boolean | null;
  accepted_at: string | null;
}): RequestState {
  if (t.status === "closed") return "closed";
  if (t.status === "cancelled") return "cancelled";
  if (t.requires_acceptance && !t.accepted_at) return "approval";
  switch (t.status) {
    case "in_progress":
      return "progress";
    case "waiting":
      return "vendor";
    case "waiting_response":
      return "yourTurn";
    case "resolved":
      return "answered";
    default:
      return "new";
  }
}

/** List filter chips. `open` = everything not closed/cancelled. */
export const REQUEST_FILTERS = ["open", "yourTurn", "approval", "answered", "closed"] as const;
export type RequestFilter = (typeof REQUEST_FILTERS)[number];

export type PersonRef = {
  id: string;
  name: string;
  initials: string;
  avatarUrl: string | null;
};

export type TicketTypeRef = { id: string; name: string; color: string; icon: string };

/** Repair order the request is pinned to (helpdesk_ticket_references). */
export type OrderRef = {
  orderNumber: string;
  warehouse: string;
  /** Full DMS number, e.g. ZL/51481/26/3252/BL -- only when found in Ambra. */
  zlNumber: string | null;
  repairOrderId: string | null;
};

export type RequestListItem = {
  id: string;
  number: string;
  title: string;
  state: RequestState;
  type: TicketTypeRef | null;
  branchId: string | null;
  requester: PersonRef | null;
  order: OrderRef | null;
  commentCount: number;
  createdAt: string;
  updatedAt: string;
  isMine: boolean;
};

export type RequestDetail = RequestListItem & {
  descriptionPlain: string | null;
  descriptionRich: unknown | null;
  status: TicketStatus;
  responders: PersonRef[];
  acceptors: PersonRef[];
  acceptedAt: string | null;
  closedAt: string | null;
  /** Requester may close / withdraw it (portal rule D3). */
  canClose: boolean;
};

export type RequestComment = {
  id: string;
  author: PersonRef | null;
  bodyPlain: string;
  /** Tiptap document (same format Ambra writes and renders). */
  bodyRich: unknown | null;
  createdAt: string;
  /** Differs from createdAt once the author edited the comment. */
  updatedAt: string;
  isMine: boolean;
};

export type RequestAttachment = {
  id: string;
  /** Comment the file was sent with (app_attachments.metadata.comment_id); null = request-level. */
  commentId: string | null;
  isMine: boolean;
  fileName: string;
  contentType: string;
  sizeBytes: number;
  url: string | null;
  createdAt: string;
};

export type RequestEvent = {
  id: string;
  type: string;
  actor: PersonRef | null;
  payload: Record<string, unknown>;
  createdAt: string;
};

export type ServiceResult<T> = { ok: true; data: T } | { ok: false; error: string };
