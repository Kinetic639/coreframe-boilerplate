import { z } from "zod";

// ---------------------------------------------------------------------------
// Enums
// ---------------------------------------------------------------------------

export const TICKET_STATUSES = [
  "open",
  "in_progress",
  "waiting",
  "waiting_response",
  "resolved",
  "closed",
  "cancelled",
] as const;

export const TICKET_PRIORITIES = ["low", "medium", "high", "urgent"] as const;
export const ASSIGNEE_ROLES = ["responder", "watcher"] as const;
export const ASSIGNEE_STATUSES = ["assigned", "responded", "completed", "removed"] as const;

export type TicketStatus = (typeof TICKET_STATUSES)[number];
export type TicketPriority = (typeof TICKET_PRIORITIES)[number];
export type AssigneeRole = (typeof ASSIGNEE_ROLES)[number];
export type AssigneeStatus = (typeof ASSIGNEE_STATUSES)[number];

// ---------------------------------------------------------------------------
// Ticket Types
// ---------------------------------------------------------------------------

export const createTicketTypeSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  color: z
    .string()
    .regex(/^#[0-9a-fA-F]{6}$/)
    .default("#6366f1"),
  icon: z.string().max(50).default("ticket"),
  sort_order: z.number().int().min(0).default(0),
  default_priority: z.enum(TICKET_PRIORITIES).default("medium"),
  allows_manual_assignees: z.boolean().default(true),
});

export const updateTicketTypeSchema = createTicketTypeSchema.extend({
  id: z.string().uuid(),
  is_active: z.boolean().optional(),
});

export type CreateTicketTypeInput = z.infer<typeof createTicketTypeSchema>;
export type UpdateTicketTypeInput = z.infer<typeof updateTicketTypeSchema>;

// ---------------------------------------------------------------------------
// Tickets
// ---------------------------------------------------------------------------

export const createTicketSchema = z
  .object({
    title: z.string().min(1, "Title is required").max(255),
    description_plain: z.string().max(10000).optional(),
    description_rich: z.unknown().optional(),
    status: z.enum(TICKET_STATUSES).default("waiting_response"),
    priority: z.enum(TICKET_PRIORITIES).default("medium"),
    ticket_type_id: z.string().uuid().optional(),
    assignee_user_ids: z.array(z.string().uuid()).min(1, "At least one responder is required"),
    branch_id: z.string().uuid().optional(),
    due_at: z.string().datetime().optional(),
    requires_acceptance: z.boolean().default(false),
    acceptor_user_ids: z.array(z.string().uuid()).default([]),
  })
  .superRefine((data, ctx) => {
    if (data.requires_acceptance && data.acceptor_user_ids.length === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "At least one acceptor is required when acceptance is enabled.",
        path: ["acceptor_user_ids"],
      });
    }
  });

export const closeTicketSchema = z.object({
  ticket_id: z.string().uuid(),
  resolution_note: z.string().max(2000).optional(),
});

export const ticketListFiltersSchema = z.object({
  status: z.union([z.enum(TICKET_STATUSES), z.array(z.enum(TICKET_STATUSES))]).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  ticketTypeId: z.string().uuid().optional(),
  createdBy: z.string().uuid().optional(),
  assignedTo: z.string().uuid().optional(),
  createdAtFrom: z.string().optional(),
  createdAtTo: z.string().optional(),
  branchId: z.string().uuid().optional(),
});

export type CreateTicketInput = z.infer<typeof createTicketSchema>;
export type CloseTicketInput = z.infer<typeof closeTicketSchema>;
export type TicketListFilters = z.infer<typeof ticketListFiltersSchema>;

// ---------------------------------------------------------------------------
// Comments
// ---------------------------------------------------------------------------

export const addTicketCommentSchema = z.object({
  ticket_id: z.string().uuid(),
  body: z.string().min(1, "Comment cannot be empty").max(10000),
  body_rich: z.unknown().optional(),
  is_internal: z.boolean().default(false),
});

export type AddTicketCommentInput = z.infer<typeof addTicketCommentSchema>;

// ---------------------------------------------------------------------------
// Accept ticket
// ---------------------------------------------------------------------------

export const acceptTicketSchema = z.object({
  ticket_id: z.string().uuid(),
});

export type AcceptTicketInput = z.infer<typeof acceptTicketSchema>;

// ---------------------------------------------------------------------------
// Legacy compat aliases used in existing service/action code
// ---------------------------------------------------------------------------
export const createCommentSchema = addTicketCommentSchema;
export type CreateCommentInput = AddTicketCommentInput;

// Legacy ticket update schema (service still uses this for status/priority patches)
export const updateTicketSchema = z.object({
  id: z.string().uuid(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().max(10000).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  ticket_type_id: z.string().uuid().optional(),
  assigned_to: z.string().uuid().optional(),
  branch_id: z.string().uuid().optional(),
  due_at: z.string().datetime().optional(),
});

export type UpdateTicketInput = z.infer<typeof updateTicketSchema>;
