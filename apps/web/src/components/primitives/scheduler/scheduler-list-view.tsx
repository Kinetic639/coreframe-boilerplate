"use client";

import React from "react";
import { format, isSameDay } from "date-fns";
import { CalendarEvent, SchedulerLocale } from "./scheduler-types";
import { formatInTimezone, formatEventTime, LABELS_MAP } from "./scheduler-utils";
import { Calendar, MapPin, Clock, AlertCircle } from "lucide-react";

interface SchedulerListViewProps {
  events: CalendarEvent[];
  locale: SchedulerLocale;
  timezone: string;
  timeFormat: "12h" | "24h";
  onSelectEvent: (event: CalendarEvent) => void;
}

export const SchedulerListView: React.FC<SchedulerListViewProps> = ({
  events,
  locale,
  timezone,
  timeFormat,
  onSelectEvent,
}) => {
  const label = LABELS_MAP[locale];

  // Group events by date.
  // 1. Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // 2. Identify unique dates
  const datesInsideAgenda: string[] = [];
  const groupedEvents: Record<string, CalendarEvent[]> = {};

  sortedEvents.forEach((ev) => {
    const formattedDate = formatInTimezone(new Date(ev.start), "yyyy-MM-dd", timezone, locale);
    if (!datesInsideAgenda.includes(formattedDate)) {
      datesInsideAgenda.push(formattedDate);
      groupedEvents[formattedDate] = [];
    }
    groupedEvents[formattedDate].push(ev);
  });

  const categoryStyles: Record<
    string,
    { bg: string; text: string; border: string; indicator: string }
  > = {
    meeting: {
      bg: "bg-indigo-50/70 dark:bg-indigo-950/20 text-indigo-700 dark:text-indigo-450 border-indigo-100 dark:border-indigo-900",
      text: "text-indigo-800 dark:text-indigo-200",
      border: "border-indigo-200/50",
      indicator: "bg-indigo-500",
    },
    task: {
      bg: "bg-emerald-50/70 dark:bg-emerald-950/20 text-emerald-700 dark:text-emerald-450 border-emerald-100 dark:border-emerald-900",
      text: "text-emerald-800 dark:text-emerald-200",
      border: "border-emerald-200/50",
      indicator: "bg-emerald-500",
    },
    workshop: {
      bg: "bg-amber-50/75 dark:bg-amber-950/20 text-amber-700 dark:text-amber-400 border-amber-100 dark:border-amber-900",
      text: "text-amber-800 dark:text-amber-200",
      border: "border-amber-200/50",
      indicator: "bg-amber-500",
    },
    warehouse: {
      bg: "bg-cyan-50/70 dark:bg-cyan-950/20 text-cyan-700 dark:text-cyan-400 border-cyan-100 dark:border-cyan-900",
      text: "text-cyan-800 dark:text-cyan-200",
      border: "border-cyan-200/50",
      indicator: "bg-cyan-500",
    },
    reminder: {
      bg: "bg-purple-50/70 dark:bg-purple-950/20 text-purple-700 dark:text-purple-400 border-purple-100 dark:border-purple-900",
      text: "text-purple-800 dark:text-purple-200",
      border: "border-purple-200/50",
      indicator: "bg-purple-500",
    },
    personal: {
      bg: "bg-fuchsia-50/70 dark:bg-fuchsia-950/20 text-fuchsia-700 dark:text-fuchsia-400 border-fuchsia-100 dark:border-fuchsia-900",
      text: "text-fuchsia-800 dark:text-fuchsia-200",
      border: "border-fuchsia-200/50",
      indicator: "bg-fuchsia-500",
    },
  };

  const priorityColors = {
    low: "bg-gray-50 dark:bg-neutral-800 text-slate-500 dark:text-neutral-400 border-slate-200 dark:border-neutral-700",
    medium:
      "bg-amber-50 dark:bg-amber-950/20 text-amber-600 dark:text-amber-400 border-amber-100 dark:border-amber-900/40",
    high: "bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 border-rose-100 dark:border-rose-900/40",
  };

  return (
    <div className="flex flex-col h-full bg-background p-6 space-y-6 overflow-y-auto scrollbar-thin select-none">
      <div className="flex items-center gap-2 pb-2 border-b border-border">
        <Calendar className="text-muted-foreground" size={18} />
        <h3 className="font-sans font-bold text-base text-foreground uppercase tracking-wider">
          {label.upcoming}
        </h3>
      </div>

      {datesInsideAgenda.length === 0 ? (
        <div className="py-24 text-center border border-dashed border-border rounded-2xl flex flex-col items-center justify-center gap-3 bg-muted/30">
          <Clock size={36} className="text-muted-foreground animate-pulse" />
          <p className="text-muted-foreground text-sm font-semibold">{label.noEvents}</p>
        </div>
      ) : (
        <div className="space-y-6 font-sans">
          {datesInsideAgenda.map((dateStr) => {
            const dayEvents = groupedEvents[dateStr];
            const dateObj = new Date(dateStr);

            return (
              <div key={dateStr} className="space-y-3" id={`agenda-date-group-${dateStr}`}>
                {/* Date header label bubble banner */}
                <h4 className="font-sans font-bold text-xs text-primary flex items-center gap-2 pl-1 select-none">
                  <span className="w-1.5 h-1.5 bg-primary rounded-full" />
                  <span>{formatInTimezone(dateObj, "EEEE, MMMM d, yyyy", timezone, locale)}</span>
                </h4>

                {/* List items representation */}
                <div className="space-y-2.5">
                  {dayEvents.map((event) => {
                    const style =
                      categoryStyles[event.color || event.category] || categoryStyles.meeting;

                    return (
                      <div
                        key={event.id}
                        onClick={() => onSelectEvent(event)}
                        className="group relative p-4 border border-border/60 bg-card rounded-xl hover:border-primary/40 hover:shadow-xs cursor-pointer transition flex flex-col md:flex-row md:items-center justify-between gap-4 select-none"
                        id={`agenda-event-row-${event.id}`}
                      >
                        {/* Event details summary info */}
                        <div className="flex items-start gap-3 flex-1">
                          {/* Colored vertical category accent bar */}
                          <div
                            className={`w-1 h-11 rounded-full shrink-0 ${
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

                          <div className="space-y-1">
                            <h5 className="font-sans font-bold text-sm text-foreground leading-tight group-hover:text-primary transition-colors">
                              {event.title}
                            </h5>

                            {/* Description summary */}
                            {event.description && (
                              <p className="text-[11px] text-muted-foreground line-clamp-1 max-w-lg leading-snug">
                                {event.description}
                              </p>
                            )}

                            {/* Location element inside agenda row */}
                            {event.location && (
                              <div className="flex items-center gap-1 text-[10px] text-muted-foreground font-semibold">
                                <MapPin size={10} />
                                <span>{event.location}</span>
                              </div>
                            )}
                          </div>
                        </div>

                        {/* Event Meta timing tags / badges */}
                        <div className="flex flex-wrap md:flex-nowrap items-center gap-3 self-end md:self-center">
                          {/* Formatted Hours widget */}
                          <div className="text-[11px] font-mono font-bold text-muted-foreground bg-muted border border-border px-2.5 py-1 rounded-lg">
                            {formatEventTime(
                              event.start,
                              event.end,
                              event.allDay,
                              locale,
                              timezone,
                              timeFormat
                            )}
                          </div>

                          {/* Category badge */}
                          <span
                            className={`text-[9px] uppercase tracking-wider font-extrabold px-2 py-0.5 rounded-full border ${style.bg} ${style.text} ${style.border}`}
                          >
                            {event.category}
                          </span>

                          {/* Priority tag label */}
                          {event.priority && (
                            <span
                              className={`text-[9px] uppercase font-bold tracking-wider px-2 py-0.5 rounded border ${priorityColors[event.priority]}`}
                            >
                              {event.priority}
                            </span>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
