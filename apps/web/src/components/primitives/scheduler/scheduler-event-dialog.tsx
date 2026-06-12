"use client";

import React, { useState, useEffect } from "react";
import { X, Calendar, MapPin, Tag, Users, AlertTriangle, Settings, Sparkles } from "lucide-react";
import { CalendarEvent, EventCategory, SchedulerLocale } from "./scheduler-types";
import { LABELS_MAP } from "./scheduler-utils";
import { INITIAL_RESOURCES } from "./scheduler-demo-data";

interface SchedulerEventDialogProps {
  isOpen: boolean;
  event: Partial<CalendarEvent> | null; // Null if creating; pre-filled if editing or cell-clicked
  onClose: () => void;
  onSave: (event: CalendarEvent) => void;
  locale: SchedulerLocale;
  timezone: string;
}

// Convert Date to yyyy-MM-ddTHH:mm for datetime-local input
const toDatetimeLocalString = (date: Date): string => {
  const pad = (num: number) => num.toString().padStart(2, "0");
  const yyyy = date.getFullYear();
  const MM = pad(date.getMonth() + 1);
  const dd = pad(date.getDate());
  const hh = pad(date.getHours());
  const mm = pad(date.getMinutes());
  return `${yyyy}-${MM}-${dd}T${hh}:${mm}`;
};

export const SchedulerEventDialog: React.FC<SchedulerEventDialogProps> = ({
  isOpen,
  event,
  onClose,
  onSave,
  locale,
  timezone: _timezone,
}) => {
  const label = LABELS_MAP[locale];

  // Form State
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDateStr, setStartDateStr] = useState("");
  const [endDateStr, setEndDateStr] = useState("");
  const [allDay, setAllDay] = useState(false);
  const [category, setCategory] = useState<EventCategory>("meeting");
  const [color, setColor] = useState("");
  const [priority, setPriority] = useState<"low" | "medium" | "high">("medium");
  const [status, setStatus] = useState<"confirmed" | "tentative" | "cancelled">("confirmed");
  const [location, setLocation] = useState("");
  const [attendeesStr, setAttendeesStr] = useState("");
  const [isDraggable, setIsDraggable] = useState(true);
  const [isResizable, setIsResizable] = useState(true);
  const [resourceId, setResourceId] = useState("");
  const [isBackground, setIsBackground] = useState(false);
  const [bgType, setBgType] = useState<"break" | "closed" | "holiday" | "unavailable" | "focus">(
    "break"
  );

  const [dateError, setDateError] = useState("");

  // Synchronize state when the dialog is opened/edited
  useEffect(() => {
    if (isOpen) {
      if (event) {
        setTitle(event.title || "");
        setDescription(event.description || "");
        setAllDay(!!event.allDay);
        setCategory(event.category || "meeting");
        setColor(event.color || "");
        setPriority(event.priority || "medium");
        setStatus(event.status || "confirmed");
        setLocation(event.location || "");
        setAttendeesStr(event.attendees ? event.attendees.join(", ") : "");
        setIsDraggable(event.isDraggable !== false);
        setIsResizable(event.isResizable !== false);
        setResourceId(event.resourceId || "");
        setIsBackground(event.metadata?.isBackground === true);
        setBgType(
          typeof event.metadata?.bgType === "string"
            ? (event.metadata.bgType as typeof bgType)
            : "break"
        );

        // Date conversions
        const startObj = event.start ? new Date(event.start) : new Date();
        const endObj = event.end
          ? new Date(event.end)
          : new Date(startObj.getTime() + 60 * 60 * 1000);

        setStartDateStr(toDatetimeLocalString(startObj));
        setEndDateStr(toDatetimeLocalString(endObj));
      } else {
        // Form default state reset
        setTitle("");
        setDescription("");
        setAllDay(false);
        setCategory("meeting");
        setColor("");
        setPriority("medium");
        setStatus("confirmed");
        setLocation("");
        setAttendeesStr("");
        setIsDraggable(true);
        setIsResizable(true);
        setResourceId("");
        setIsBackground(false);
        setBgType("break");

        const now = new Date();
        now.setMinutes(0, 0, 0); // Rounded hour
        const startObj = new Date(now.getTime() + 60 * 60 * 1000); // 1 hour from now
        const endObj = new Date(startObj.getTime() + 60 * 60 * 1000); // 1 hour duration

        setStartDateStr(toDatetimeLocalString(startObj));
        setEndDateStr(toDatetimeLocalString(endObj));
      }
      setDateError("");
    }
  }, [isOpen, event]);

  if (!isOpen) return null;

  // Handle color selection presets
  const colorPresets = [
    { name: "Indigo", value: "indigo", class: "bg-indigo-500" },
    { name: "Emerald", value: "emerald", class: "bg-emerald-500" },
    { name: "Amber", value: "amber", class: "bg-amber-500" },
    { name: "Cyan", value: "cyan", class: "bg-cyan-500" },
    { name: "Purple", value: "purple", class: "bg-purple-500" },
    { name: "Fuchsia", value: "fuchsia", class: "bg-fuchsia-500" },
  ];

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setDateError("");

    const start = new Date(startDateStr);
    const end = new Date(endDateStr);

    if (isNaN(start.getTime()) || isNaN(end.getTime())) {
      setDateError(label.invalidDateError || "Please input a valid starting and ending date.");
      return;
    }

    if (!allDay && end.getTime() <= start.getTime()) {
      setDateError(
        label.dateRangeError ||
          "Wydarzenie musi trwać dłużej niż 0 minut (end must be after start)."
      );
      return;
    }

    // Split attendees string by comma
    const attendees = attendeesStr
      .split(",")
      .map((a) => a.trim())
      .filter((a) => a.length > 0);

    const mergedEvent: CalendarEvent = {
      id: event?.id || (isBackground ? `bg-custom-${Date.now()}` : `ev-custom-${Date.now()}`),
      title: title.trim() || label.untitledEvent,
      description: description.trim(),
      start,
      end: allDay ? start : end,
      allDay,
      category,
      color: color || (isBackground ? "indigo" : category),
      priority,
      status,
      location: location.trim(),
      attendees,
      isDraggable: isBackground ? false : isDraggable,
      isResizable: isBackground ? false : allDay ? false : isResizable,
      resourceId: resourceId || undefined,
      metadata: {
        ...event?.metadata,
        isBackground,
        bgType: isBackground ? bgType : undefined,
      },
    };

    onSave(mergedEvent);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-neutral-900/45 dark:bg-neutral-950/70 backdrop-blur-xs transition"
        onClick={onClose}
      />

      {/* dialog window container */}
      <div
        className="relative bg-white dark:bg-neutral-900 rounded-2xl border border-gray-150 dark:border-neutral-800 shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto flex flex-col transition scale-100"
        id="scheduler-event-dialog"
      >
        {/* Header toolbar */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100 dark:border-neutral-800">
          <div className="flex items-center gap-2">
            <Calendar className="text-primary" size={18} />
            <span className="font-sans font-bold text-gray-900 dark:text-white">
              {event?.id ? `Edit: ${event.title}` : label.createEvent}
            </span>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-gray-400 dark:text-neutral-500 hover:text-gray-600 dark:hover:text-neutral-300 rounded-full hover:bg-gray-100 dark:hover:bg-neutral-800 transition active:scale-90"
            aria-label="Close modal dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Dialog body form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4 flex-1">
          {/* Validation Banner Indicator */}
          {dateError && (
            <div className="flex items-start gap-2 p-3 text-xs bg-rose-50 dark:bg-rose-950/20 text-rose-600 dark:text-rose-400 rounded-xl border border-rose-100 dark:border-rose-900/30">
              <AlertTriangle size={15} className="shrink-0 mt-0.5" />
              <span>{dateError}</span>
            </div>
          )}

          {/* Title Field Input */}
          <div className="space-y-1">
            <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
              {label.titleLabel || "Title"}
            </label>
            <input
              type="text"
              required
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder={label.titlePlaceholder}
              className="w-full text-sm bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-3 focus:ring-1 focus:ring-primary outline-none placeholder-gray-400 dark:placeholder-neutral-500 font-semibold"
              id="input-event-title"
            />
          </div>

          {/* Dates & times range */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Start date string */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                {label.startDateLabel || "Start Date / Time"}
              </label>
              <input
                type="datetime-local"
                required
                value={startDateStr}
                onChange={(e) => setStartDateStr(e.target.value)}
                className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-3 focus:ring-1 focus:ring-primary outline-none font-mono"
                id="input-event-start"
              />
            </div>

            {/* End date string */}
            <div className="space-y-1">
              <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                {label.endDateLabel || "End Date / Time"}{" "}
                {allDay && `(${label.disabled || "Disabled"})`}
              </label>
              <input
                type="datetime-local"
                required
                disabled={allDay}
                value={endDateStr}
                onChange={(e) => setEndDateStr(e.target.value)}
                className={`w-full text-xs border rounded-xl p-3 focus:ring-1 focus:ring-primary outline-none font-mono ${
                  allDay
                    ? "bg-gray-100 dark:bg-neutral-850/40 text-gray-400 dark:text-neutral-600 border-gray-200 dark:border-neutral-800 cursor-not-allowed"
                    : "bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border-gray-200 dark:border-neutral-700"
                }`}
                id="input-event-end"
              />
            </div>
          </div>

          {/* All Day Switch */}
          <div className="flex items-center justify-between p-3 bg-gray-50 dark:bg-neutral-800/40 border dark:border-neutral-800/50 rounded-xl">
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold text-gray-700 dark:text-neutral-300">
                {label.allDayLabel || `${label.allDay} Event`}
              </span>
              <span className="text-[10px] text-gray-400 font-sans tracking-wide">
                {label.noHourlyWarning || "(No hourly values needed)"}
              </span>
            </div>
            <input
              type="checkbox"
              checked={allDay}
              onChange={(e) => setAllDay(e.target.checked)}
              className="accent-primary w-4 h-4 cursor-pointer"
              id="chk-event-allday"
            />
          </div>

          {/* Background Block Toggle and Selector */}
          <div className="p-3 bg-neutral-50 dark:bg-neutral-800/20 border border-slate-200/50 dark:border-neutral-800/80 rounded-xl space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-slate-700 dark:text-neutral-200">
                  Background Event Block / Shading
                </span>
                <span className="text-[10px] text-slate-400">
                  Mark unavailable slots (Lunch breaks, rest hours, branch closed times etc.)
                </span>
              </div>
              <input
                type="checkbox"
                checked={isBackground}
                onChange={(e) => setIsBackground(e.target.checked)}
                className="accent-primary w-4 h-4 cursor-pointer"
                id="chk-event-background"
              />
            </div>

            {isBackground && (
              <div className="pt-2 border-t border-slate-200/35 dark:border-neutral-800/40 space-y-1">
                <label className="block text-[10px] font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  Select Shading Sub-Type
                </label>
                <select
                  value={bgType}
                  onChange={(e) => setBgType(e.target.value as any)}
                  className="w-full text-xs bg-white dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-lg p-2 outline-none focus:ring-1 focus:ring-primary font-semibold cursor-pointer"
                  id="select-bg-type"
                >
                  <option value="break">🥪 Lunch Break / Rest Hour {"(break)"}</option>
                  <option value="focus">⚡ High-Intensity Focus Block {"(focus)"}</option>
                  <option value="closed">🚪 Branch Closed Routine {"(closed)"}</option>
                  <option value="holiday">✈ Time-Off / Holiday Block {"(holiday)"}</option>
                  <option value="unavailable">
                    🚫 General Unavailable Window {"(unavailable)"}
                  </option>
                </select>
              </div>
            )}
          </div>

          {/* Category, priority, status */}
          {!isBackground && (
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              {/* Category Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.category}
                </label>
                <select
                  value={category}
                  onChange={(e) => {
                    setCategory(e.target.value as EventCategory);
                    // Auto color match on category selection
                    if (!color) setColor(e.target.value);
                  }}
                  className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-primary"
                  id="select-event-category"
                >
                  <option value="meeting">{label.catMeeting || "Meeting"}</option>
                  <option value="task">{label.catTask || "Task"}</option>
                  <option value="workshop">{label.catWorkshop || "Workshop"}</option>
                  <option value="warehouse">{label.catWarehouse || "Warehouse Check"}</option>
                  <option value="reminder">{label.catReminder || "Reminder"}</option>
                  <option value="personal">{label.catPersonal || "Personal"}</option>
                </select>
              </div>

              {/* Priority Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.priority}
                </label>
                <select
                  value={priority}
                  onChange={(e) => setPriority(e.target.value as "low" | "medium" | "high")}
                  className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-primary"
                  id="select-event-priority"
                >
                  <option value="low">{label.priorityLow || "Low"}</option>
                  <option value="medium">{label.priorityMedium || "Medium"}</option>
                  <option value="high">{label.priorityHigh || "High"}</option>
                </select>
              </div>

              {/* Status Select */}
              <div className="space-y-1.5">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.status}
                </label>
                <select
                  value={status}
                  onChange={(e) => setStatus(e.target.value as any)}
                  className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-2.5 outline-none focus:ring-1 focus:ring-primary"
                  id="select-event-status"
                >
                  <option value="confirmed">{label.statusConfirmed || "Confirmed"}</option>
                  <option value="tentative">{label.statusTentative || "Tentative"}</option>
                  <option value="cancelled">{label.statusCancelled || "Cancelled"}</option>
                </select>
              </div>
            </div>
          )}

          {/* Assigned Resource Selection Option */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
              Assigned Resource
            </label>
            <select
              value={resourceId}
              onChange={(e) => setResourceId(e.target.value)}
              className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-3 outline-none focus:ring-1 focus:ring-primary font-semibold"
              id="select-event-resource"
            >
              <option value="">-- No Assigned Resource (Unassigned Event) --</option>
              {INITIAL_RESOURCES.map((res) => {
                const isGroupHeader = !res.parentId && !res.color;
                return (
                  <option
                    key={res.id}
                    value={res.id}
                    disabled={isGroupHeader}
                    className={isGroupHeader ? "font-bold bg-slate-100 dark:bg-neutral-800/50" : ""}
                  >
                    {!res.parentId ? `📁 ${res.name}` : `  ↳ ${res.name}`}
                  </option>
                );
              })}
            </select>
          </div>

          {!isBackground && (
            <>
              {/* Color Presets */}
              <div className="space-y-1.5">
                <span className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.colorPresetLabel || "Color Preset"}
                </span>
                <div className="flex gap-2.5 flex-wrap">
                  {colorPresets.map((p) => (
                    <button
                      type="button"
                      key={p.value}
                      onClick={() => setColor(p.value)}
                      className={`w-5 h-5 rounded-full flex items-center justify-center transition border ${p.class} ${
                        color === p.value
                          ? "ring-2 ring-primary ring-offset-2 scale-110 border-white"
                          : "border-transparent opacity-80 hover:opacity-100 hover:scale-105"
                      }`}
                      title={p.name}
                      id={`btn-color-preset-${p.value}`}
                      aria-label={`Select color ${p.name}`}
                    />
                  ))}
                </div>
              </div>

              {/* Location details */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.location}
                </label>
                <div className="relative">
                  <span className="absolute left-3 top-3.5 text-gray-400 dark:text-neutral-500">
                    <MapPin size={14} />
                  </span>
                  <input
                    type="text"
                    value={location}
                    onChange={(e) => setLocation(e.target.value)}
                    placeholder={label.locationPlaceholder || "Google Meet, Conference Room A..."}
                    className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-3 pl-9 focus:ring-1 focus:ring-primary outline-none placeholder-gray-400"
                    id="input-event-location"
                  />
                </div>
              </div>

              {/* Description elements */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider">
                  {label.description}
                </label>
                <textarea
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder={
                    label.descriptionPlaceholder || "Provide a core outline, links, checklist..."
                  }
                  rows={3}
                  className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-700 rounded-xl p-3 focus:ring-1 focus:ring-primary outline-none placeholder-gray-400 dark:placeholder-neutral-500 text-left resize-none font-sans"
                  id="input-event-description"
                />
              </div>

              {/* Attendees comma parsed */}
              <div className="space-y-1">
                <label className="block text-xs font-bold text-gray-500 dark:text-neutral-400 uppercase tracking-wider flex items-center gap-1">
                  <Users size={12} />
                  <span>{label.attendeesLabel || "Attendees (Comma-separated list)"}</span>
                </label>
                <input
                  type="text"
                  value={attendeesStr}
                  onChange={(e) => setAttendeesStr(e.target.value)}
                  placeholder={label.attendeesPlaceholder || "Ariadne V., Juliet S., Caleb P."}
                  className="w-full text-xs bg-gray-50 dark:bg-neutral-800 text-gray-900 dark:text-white border border-gray-200 dark:border-neutral-750 rounded-xl p-3 focus:ring-1 focus:ring-primary outline-none placeholder-gray-400"
                  id="input-event-attendees"
                />
              </div>

              {/* Settings / Draggable & Resizable check toggles */}
              <div className="flex gap-4 p-3 bg-gray-50 dark:bg-neutral-800/40 rounded-xl border dark:border-neutral-800/50 text-[11px]">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isDraggable}
                    onChange={(e) => setIsDraggable(e.target.checked)}
                    className="accent-primary cursor-pointer"
                    id="chk-event-draggable"
                  />
                  <span className="text-gray-600 dark:text-neutral-300 font-semibold">
                    {label.enableDraggingLabel || "Enable dragging"}
                  </span>
                </label>

                <label
                  className={`flex items-center gap-2 cursor-pointer ${allDay ? "opacity-40 cursor-not-allowed" : ""}`}
                >
                  <input
                    type="checkbox"
                    disabled={allDay}
                    checked={allDay ? false : isResizable}
                    onChange={(e) => setIsResizable(e.target.checked)}
                    className="accent-primary cursor-pointer"
                    id="chk-event-resizable"
                  />
                  <span className="text-gray-600 dark:text-neutral-300 font-semibold">
                    {label.enableResizingLabel || "Enable horizontal/vertical resizing"}
                  </span>
                </label>
              </div>
            </>
          )}

          {/* Buttons footer */}
          <div className="pt-4 border-t border-gray-100 dark:border-neutral-850 flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 text-xs font-bold text-gray-500 hover:text-gray-700 dark:text-neutral-400 dark:hover:text-neutral-200 rounded-xl transition cursor-pointer active:scale-95"
            >
              {label.cancel}
            </button>
            <button
              type="submit"
              className="px-5 py-2.5 text-xs font-bold text-primary-foreground bg-primary hover:bg-primary/90 active:scale-95 rounded-xl transition cursor-pointer shadow-sm shadow-primary/10"
              id="btn-event-dialog-save"
            >
              {label.save}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
