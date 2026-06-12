"use client";

import React from "react";
import { X, Calendar, MapPin, Users, Trash2, Edit3, AlertCircle, Bookmark } from "lucide-react";
import { CalendarEvent, SchedulerLocale } from "./scheduler-types";
import { formatEventTime, formatInTimezone, LABELS_MAP } from "./scheduler-utils";

interface SchedulerEventPopoverProps {
  event: CalendarEvent;
  onClose: () => void;
  onEdit: () => void;
  onDelete: () => void;
  locale: SchedulerLocale;
  timezone: string;
}

export const SchedulerEventPopover: React.FC<SchedulerEventPopoverProps> = ({
  event,
  onClose,
  onEdit,
  onDelete,
  locale,
  timezone,
}) => {
  const label = LABELS_MAP[locale];

  // Colorful tags based on category
  const categoryStyles: Record<string, string> = {
    meeting:
      "bg-indigo-50 dark:bg-indigo-950/40 text-indigo-700 dark:text-indigo-300 border-indigo-100 dark:border-indigo-800",
    task: "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 border-emerald-100 dark:border-emerald-800",
    workshop:
      "bg-amber-50 dark:bg-amber-950/40 text-amber-700 dark:text-amber-300 border-amber-100 dark:border-amber-800",
    warehouse:
      "bg-cyan-50 dark:bg-cyan-950/40 text-cyan-700 dark:text-cyan-300 border-cyan-100 dark:border-cyan-800",
    reminder:
      "bg-purple-50 dark:bg-purple-950/40 text-purple-700 dark:text-purple-300 border-purple-100 dark:border-purple-800",
    personal:
      "bg-fuchsia-50 dark:bg-fuchsia-950/40 text-fuchsia-700 dark:text-fuchsia-300 border-fuchsia-100 dark:border-fuchsia-800",
  };

  const priorityColors = {
    low: "bg-gray-100 dark:bg-neutral-800 text-gray-750 dark:text-neutral-450 border-gray-200 dark:border-neutral-700",
    medium: "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-150",
    high: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-150",
  };

  const statusColors = {
    confirmed:
      "bg-emerald-50 dark:bg-emerald-950/20 text-emerald-600 dark:text-emerald-400 border-emerald-200",
    tentative:
      "bg-yellow-50 dark:bg-yellow-950/25 text-yellow-600 dark:text-yellow-400 border-yellow-250",
    cancelled:
      "bg-rose-50 dark:bg-rose-950/25 text-rose-500 dark:text-rose-400 border-rose-200 line-through",
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/45 dark:bg-neutral-950/70 backdrop-blur-xs transition"
        onClick={onClose}
      />

      {/* Popover Card */}
      <div
        className="relative bg-card rounded-2xl border border-border shadow-xl max-w-md w-full overflow-hidden transition-all duration-200 transform scale-100 flex flex-col"
        id={`popover-card-${event.id}`}
      >
        {/* Color bar at top matching the category */}
        <div
          className={`h-2.5 w-full ${
            event.category === "meeting"
              ? "bg-indigo-500"
              : event.category === "task"
                ? "bg-emerald-500"
                : event.category === "workshop"
                  ? "bg-amber-500"
                  : event.category === "warehouse"
                    ? "bg-cyan-500"
                    : event.category === "reminder"
                      ? "bg-purple-500"
                      : "bg-fuchsia-500"
          }`}
        />

        {/* Header bar */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex flex-wrap items-center gap-1.5">
            {/* Category badge */}
            <span
              className={`text-[10px] font-bold uppercase tracking-wider px-2 py-0.5 rounded-full border ${categoryStyles[event.category]}`}
            >
              {label[
                `cat${event.category.charAt(0).toUpperCase()}${event.category.slice(1)}` as keyof typeof label
              ] || event.category}
            </span>

            {/* Priority and Status badges if set */}
            {event.priority && (
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${priorityColors[event.priority]}`}
              >
                {label[
                  `priority${event.priority.charAt(0).toUpperCase()}${event.priority.slice(1)}` as keyof typeof label
                ] || event.priority}
              </span>
            )}

            {event.status && (
              <span
                className={`text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${statusColors[event.status]}`}
              >
                {label[
                  `status${event.status.charAt(0).toUpperCase()}${event.status.slice(1)}` as keyof typeof label
                ] || event.status}
              </span>
            )}
          </div>

          <button
            onClick={onClose}
            className="p-1 text-muted-foreground hover:text-foreground rounded-full hover:bg-muted transition active:scale-90"
            aria-label="Close popover"
          >
            <X size={18} />
          </button>
        </div>

        {/* Main body */}
        <div className="p-5 pt-0 space-y-4 flex-1">
          <div>
            <h3 className="font-sans text-lg font-bold text-foreground leading-tight">
              {event.title || label.untitledEvent}
            </h3>

            {/* Start and end time display */}
            <div className="flex items-center gap-2 text-xs font-medium text-primary font-mono mt-1.5 bg-primary/10 py-1 px-2.5 rounded-md w-fit">
              <Calendar size={13} />
              <span>{formatInTimezone(event.start, "EEEE, d MMM yyyy", timezone, locale)}</span>
              <span className="text-border">|</span>
              <span>{formatEventTime(event.start, event.end, event.allDay, locale, timezone)}</span>
            </div>
          </div>

          {/* Description */}
          {event.description ? (
            <div className="text-xs text-foreground leading-relaxed bg-muted/40 p-3 rounded-lg border border-border/50">
              <p className="whitespace-pre-line">{event.description}</p>
            </div>
          ) : (
            <p className="text-xs text-muted-foreground italic">
              {label.noDescription || "No description provided."}
            </p>
          )}

          {/* Location */}
          {event.location && (
            <div className="flex items-start gap-2 text-xs text-foreground">
              <MapPin size={14} className="text-muted-foreground mt-0.5 shrink-0" />
              <div>
                <span className="font-medium text-muted-foreground block text-[10px] uppercase font-mono tracking-wider">
                  {label.location}
                </span>
                <span className="font-semibold text-foreground">{event.location}</span>
              </div>
            </div>
          )}

          {/* Attendees */}
          {event.attendees && event.attendees.length > 0 && (
            <div className="space-y-1.5">
              <span className="font-medium text-muted-foreground block text-[10px] uppercase font-mono tracking-wider flex items-center gap-1">
                <Users size={11} />
                <span>
                  {label.attendeesLabel || "Attendees"} ({event.attendees.length})
                </span>
              </span>
              <div className="flex flex-wrap gap-1.5">
                {event.attendees.map((attendee, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs text-foreground bg-muted border border-border rounded-lg font-medium"
                  >
                    <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                    {attendee}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footnotes / Drag / Resize capabilities */}
        {(event.isDraggable || event.isResizable) && (
          <div className="px-5 py-2.5 bg-muted/40 border-t border-border flex gap-2 font-mono text-[9px] text-muted-foreground">
            {event.isDraggable && <span>✓ {label.enableDraggingLabel || "Draggable"}</span>}
            {event.isResizable && <span>✓ {label.enableResizingLabel || "Resizable"}</span>}
          </div>
        )}

        {/* Footer controls */}
        <div className="bg-muted p-4 border-t border-border flex items-center justify-between">
          <button
            onClick={onDelete}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-bold text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/20 rounded-lg active:scale-95 transition"
            id={`btn-popover-delete-${event.id}`}
          >
            <Trash2 size={14} />
            <span>{label.delete}</span>
          </button>

          <div className="flex items-center gap-2">
            <button
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-semibold text-muted-foreground hover:text-foreground active:scale-95 transition"
            >
              {label.close || "Close"}
            </button>
            <button
              onClick={onEdit}
              className="flex items-center gap-1.5 px-4 py-2 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 active:scale-95 shadow-sm rounded-lg transition"
              id={`btn-popover-edit-${event.id}`}
            >
              <Edit3 size={14} />
              <span>{label.edit || "Edit"}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
