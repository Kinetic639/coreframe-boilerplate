import {
  CalendarDays,
  Car,
  CircleHelp,
  Clock,
  ClipboardCheck,
  PackageX,
  Ticket,
  Undo2,
  Warehouse,
  type LucideIcon,
} from "lucide-react";

/** Lucide names stored in helpdesk_ticket_types.icon (Ambra writes kebab-case names). */
const ICONS: Record<string, LucideIcon> = {
  clock: Clock,
  "package-x": PackageX,
  "undo-2": Undo2,
  car: Car,
  warehouse: Warehouse,
  "calendar-days": CalendarDays,
  "clipboard-check": ClipboardCheck,
  "help-circle": CircleHelp,
  ticket: Ticket,
};

export function TypeIcon({ name, className }: { name: string; className?: string }) {
  const Icon = ICONS[name] ?? Ticket;
  return <Icon className={className} strokeWidth={2.1} />;
}
