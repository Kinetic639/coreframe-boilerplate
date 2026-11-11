import type { useTranslations } from "next-intl";
import {
  CalendarClock,
  CheckCircle2,
  ListTodo,
  MessageSquare,
  AtSign,
  Ticket,
  Bell,
  type LucideIcon,
} from "lucide-react";
import { memberName } from "@/lib/messages/display";
import type { AppNotification } from "@/lib/notifications/types";

type NotificationTranslator = ReturnType<typeof useTranslations<"notificationCenter">>;

export interface NotificationDisplay {
  /** Who did it ("Marta Nowak"), or "System" */
  actor: string;
  /** What happened, continuing the actor ("przypisała Ci zgłoszenie") */
  text: string;
  /** Module the object belongs to ("Help Desk") */
  module: string;
  icon: LucideIcon;
}

const TASK_STATUSES = new Set(["open", "in_progress", "completed", "cancelled"]);

/** The sentence, module and icon of a notification, from its type and data */
export function describeNotification(
  notification: AppNotification,
  t: NotificationTranslator
): NotificationDisplay {
  const actor = notification.actor ? memberName(notification.actor) || t("system") : t("system");
  const target = notification.target_type;
  const module =
    target === "helpdesk.ticket"
      ? t("modules.helpdesk_ticket")
      : target === "planning.task"
        ? t("modules.planning_task")
        : target === "workshop.repair_order"
          ? t("modules.workshop_repair_order")
          : target === "chat.conversation"
            ? t("modules.chat_conversation")
            : t("modules.other");

  switch (notification.type) {
    case "ticket.new":
      return { actor, module, icon: Ticket, text: t("text.ticket_new") };
    case "ticket.assigned":
      return { actor, module, icon: Ticket, text: t("text.ticket_assigned") };
    case "ticket.status": {
      const event = notification.data.event;
      const key =
        event === "ticket_closed"
          ? "text.ticket_closed"
          : event === "ticket_accepted"
            ? "text.ticket_accepted"
            : "text.ticket_status";
      return { actor, module, icon: CheckCircle2, text: t(key) };
    }
    case "comment": {
      const key =
        target === "helpdesk.ticket"
          ? "text.comment_ticket"
          : target === "planning.task"
            ? "text.comment_task"
            : target === "workshop.repair_order"
              ? "text.comment_order"
              : "text.comment";
      return { actor, module, icon: MessageSquare, text: t(key) };
    }
    case "mention":
      return {
        actor,
        module,
        icon: AtSign,
        text: t(target === "chat.conversation" ? "text.mention_chat" : "text.mention"),
      };
    case "task.assigned":
      return { actor, module, icon: ListTodo, text: t("text.task_assigned") };
    case "task.status": {
      const status = String(notification.data.status ?? "");
      return {
        actor,
        module,
        icon: ListTodo,
        text: t("text.task_status", {
          status: TASK_STATUSES.has(status)
            ? t(`taskStatus.${status as "open" | "in_progress" | "completed" | "cancelled"}`)
            : status,
        }),
      };
    }
    case "task.due":
      // A reminder has no actor: "Przypomnienie: termin zadania mija dziś"
      return { actor: t("reminder"), module, icon: CalendarClock, text: t("text.task_due") };
    default:
      return { actor, module, icon: Bell, text: t("text.unknown") };
  }
}
