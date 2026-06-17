import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  eachDayOfInterval,
  addDays,
  format,
  differenceInMinutes,
  addMinutes,
  startOfDay,
} from "date-fns";
import { enUS, pl, de } from "date-fns/locale";
import type { CSSProperties } from "react";
import { CalendarEvent, EventCategory, UnscheduledTask, CalendarView } from "./scheduler-types";

// Map locale keys to date-fns locale objects
export const LOCALE_MAP = {
  en: enUS,
  pl: pl,
  de: de,
};

// Cycle of existing event categories used to assign colors to dynamic calendar sources
export const CALENDAR_SOURCE_CATEGORY_CYCLE: EventCategory[] = [
  "task",
  "warehouse",
  "meeting",
  "reminder",
  "personal",
  "workshop",
];

export function isHexColor(value: string | undefined): value is string {
  return /^#[0-9a-fA-F]{6}$/.test(value ?? "");
}

export function calendarHexStyle(color: string | undefined): CSSProperties | undefined {
  if (!isHexColor(color)) return undefined;
  return {
    borderLeftColor: color,
    backgroundColor: `${color}1f`,
  };
}

// Map locale to common labels
export const LABELS_MAP = {
  en: {
    today: "Today",
    year: "Year",
    month: "Month",
    week: "Week",
    day: "Day",
    list: "List",
    timeline: "Timeline",
    upcoming: "Upcoming Events",
    weekAbbr: "Wk",
    noEvents: "No events",
    createEvent: "Create Event",
    untitledEvent: "Untitled Event",
    save: "Save",
    delete: "Delete",
    cancel: "Cancel",
    category: "Category",
    priority: "Priority",
    status: "Status",
    location: "Location",
    description: "Description",
    titlePlaceholder: "Event title...",
    allDay: "All Day",
    taskPool: "Task Pool",
    dragTaskHelp: "Drag tasks onto the calendar to schedule them",
    settings: "Settings",
    weekends: "Show Weekends",
    bgEvents: "Background Events",
    currentTime: "Indicator Line",
    filters: "Category Filters",
    timeZone: "Time Zone",
    theme: "Theme",
    timezoneWarning: "Times represent selected timezone display",
    catMeeting: "Meetings",
    catWorkshop: "Workshop",
    catReminder: "Reminders",
    catWarehouse: "Warehouse",
    catTask: "Tasks",
    catPersonal: "Personal",
    priorityLow: "Low",
    priorityMedium: "Medium",
    priorityHigh: "High",
    statusConfirmed: "Confirmed",
    statusTentative: "Tentative",
    statusCancelled: "Cancelled",
    optionsTitle: "Calendar Options",
    showLunch: "Show Background Events",
    configTitle: "System Config",
    localeLabel: "Locale",
    timeFormatLabel: "Time Format",
    timeZoneLabel: "Time Zone",
    titleLabel: "Title",
    startDateLabel: "Start Date / Time",
    endDateLabel: "End Date / Time",
    allDayLabel: "All Day Event",
    noHourlyWarning: "(No hourly values needed)",
    colorPresetLabel: "Color Preset",
    locationPlaceholder: "Google Meet, Conference Room A...",
    descriptionPlaceholder: "Provide a core outline, links, checklist...",
    attendeesLabel: "Attendees (Comma-separated list)",
    attendeesPlaceholder: "Ariadne V., Juliet S., Caleb P.",
    enableDraggingLabel: "Enable dragging",
    enableResizingLabel: "Enable horizontal/vertical resizing",
    noDescription: "No description provided.",
    close: "Close",
    edit: "Edit",
    invalidDateError: "Please input a valid starting and ending date.",
    dateRangeError: "Wydarzenie musi trwać dłużej niż 0 minut (end must be after start).",
    allTasksScheduled: "All tasks scheduled",
    disabled: "Disabled",
    hoverScheduleAt: "+ Click to schedule at",
    hoverAddAt: "+ Add",
    modeCalendar: "Calendar",
    modePlanner: "Resource Planner",
    resourcePlanner: "Resource Planner",
    resourcesHierarchy: "Resources Hierarchy",
    loaded: "loaded",
    noResourcesFound: "No matching scheduler resources found.",
    allGroups: "All Groups",
    office: "Office",
    timelineView: "Timeline View",
    gridView: "Grid View",
    searchResources: "Search resources...",
    calendarsTitle: "Calendars",
    noDueDateTitle: "No due date",
    moreUnscheduledAvailable:
      "More unscheduled items are available. Narrow calendars or search support can load the rest.",
    searchNoDueDate: "Search no due date...",
    loadMoreUnscheduled: "Load more",
    loadingMoreUnscheduled: "Loading...",
    ticketsSource: "Tickets",
    openItem: "Open",
    addCalendar: "Add calendar",
    calendarNamePlaceholder: "Calendar name...",
    createCalendar: "Create",
    calendarSettings: "Calendar settings",
    calendarColor: "Calendar color",
    resetColor: "Reset color",
    done: "Done",
    systemCalendars: "System",
    kanbanCalendars: "Kanban boards",
    customCalendars: "Mine",
    showAll: "Show all",
    hideAll: "Hide all",
    showOnlyThis: "Display only this",
    settingsAndSharing: "Settings and sharing",
    chooseCustomColor: "Choose custom color",
    chooseCustomColorDescription:
      "Choose this calendar background color. Text color is adjusted automatically.",
    hexCode: "Hex code",
    moreEvents: "more",
    showLess: "Show less",
  },
  pl: {
    today: "Dzisiaj",
    year: "Rok",
    month: "Miesiąc",
    week: "Tydzień",
    day: "Dzień",
    list: "Lista",
    timeline: "Oś czasu",
    upcoming: "Nadchodzące wydarzenia",
    weekAbbr: "Tyd",
    noEvents: "Brak wydarzeń",
    createEvent: "Dodaj wydarzenie",
    untitledEvent: "Bez tytułu",
    save: "Zapisz",
    delete: "Usuń",
    cancel: "Anuluj",
    category: "Kategoria",
    priority: "Priorytet",
    status: "Status",
    location: "Lokalizacja",
    description: "Opis",
    titlePlaceholder: "Tytuł wydarzenia...",
    allDay: "Cały dzień",
    taskPool: "Lista zadań",
    dragTaskHelp: "Przeciągnij zadania na kalendarz",
    settings: "Ustawienia",
    weekends: "Pokaż weekendy",
    bgEvents: "Wydarzenia w tle",
    currentTime: "Linia czasu",
    filters: "Filtry kategorii",
    timeZone: "Strefa czasowa",
    theme: "Motyw",
    timezoneWarning: "Godziny wyświetlane w wybranej strefie",
    catMeeting: "Spotkania",
    catWorkshop: "Warsztaty",
    catReminder: "Przypomnienia",
    catWarehouse: "Magazyn",
    catTask: "Zadania",
    catPersonal: "Osobiste",
    priorityLow: "Niski",
    priorityMedium: "Średni",
    priorityHigh: "Wysoki",
    statusConfirmed: "Potwierdzone",
    statusTentative: "Wstępne",
    statusCancelled: "Anulowane",
    optionsTitle: "Opcje kalendarza",
    showLunch: "Pokaż wydarzenia w tle",
    configTitle: "Konfiguracja systemu",
    localeLabel: "Język",
    timeFormatLabel: "Format czasu",
    timeZoneLabel: "Strefa czasowa",
    titleLabel: "Tytuł",
    startDateLabel: "Data/godzina rozpoczęcia",
    endDateLabel: "Data/godzina zakończenia",
    allDayLabel: "Wydarzenie całodniowe",
    noHourlyWarning: "(brak godzin)",
    colorPresetLabel: "Paleta kolorów",
    locationPlaceholder: "Google Meet, Sala konferencyjna Alfa...",
    descriptionPlaceholder: "Podaj krótki opis, linki, listę kontrolną...",
    attendeesLabel: "Uczestnicy (oddzieleni przecinkami)",
    attendeesPlaceholder: "Ariadne V., Juliet S., Caleb P.",
    enableDraggingLabel: "Włącz przeciąganie",
    enableResizingLabel: "Włącz zmianę rozmiaru w pionie/poziomie",
    noDescription: "Brak opisu.",
    close: "Zamknij",
    edit: "Edytuj",
    invalidDateError: "Wprowadź poprawną datę rozpoczęcia i zakończenia.",
    dateRangeError: "Wydarzenie musi trwać dłużej niż 0 minut (koniec musi być po początku).",
    allTasksScheduled: "Wszystkie zadania zaplanowane",
    disabled: "Wyłączone",
    hoverScheduleAt: "+ Kliknij, aby zaplanować o",
    hoverAddAt: "+ Dodaj",
    modeCalendar: "Kalendarz",
    modePlanner: "Planista zasobów",
    resourcePlanner: "Planista zasobów",
    resourcesHierarchy: "Hierarchia zasobów",
    loaded: "załadowano d.",
    noResourcesFound: "Nie znaleziono pasujących zasobów planisty.",
    allGroups: "Wszystkie grupy",
    office: "Biuro",
    timelineView: "Widok osi czasu",
    gridView: "Widok siatki",
    searchResources: "Szukaj zasobów...",
    calendarsTitle: "Kalendarze",
    noDueDateTitle: "Bez terminu",
    moreUnscheduledAvailable:
      "Dostępne są kolejne elementy bez terminu. Zawęź kalendarze albo użyj wyszukiwania po jego dodaniu.",
    searchNoDueDate: "Szukaj bez terminu...",
    loadMoreUnscheduled: "Pokaż więcej",
    loadingMoreUnscheduled: "Ładowanie...",
    ticketsSource: "Zgłoszenia",
    openItem: "Otwórz",
    addCalendar: "Dodaj kalendarz",
    calendarNamePlaceholder: "Nazwa kalendarza...",
    createCalendar: "Utwórz",
    calendarSettings: "Ustawienia kalendarza",
    calendarColor: "Kolor kalendarza",
    resetColor: "Resetuj kolor",
    done: "Gotowe",
    systemCalendars: "Systemowe",
    kanbanCalendars: "Tablice Kanban",
    customCalendars: "Moje",
    showAll: "Pokaż wszystko",
    hideAll: "Ukryj wszystko",
    showOnlyThis: "Wyświetl tylko ten",
    settingsAndSharing: "Ustawienia i udostępnianie",
    chooseCustomColor: "Wybierz własny kolor",
    chooseCustomColorDescription:
      "Wybierz kolor tła tego kalendarza. Kolor tekstu zostanie dopasowany automatycznie.",
    hexCode: "Kod szesnastkowy",
    moreEvents: "więcej",
    showLess: "Pokaż mniej",
  },
  de: {
    today: "Heute",
    year: "Jahr",
    month: "Monat",
    week: "Woche",
    day: "Tag",
    list: "Liste",
    timeline: "Zeitachse",
    upcoming: "Anstehende Ereignisse",
    weekAbbr: "Wo",
    noEvents: "Keine Ereignisse",
    createEvent: "Termin erstellen",
    untitledEvent: "Unbenannt",
    save: "Speichern",
    delete: "Löschen",
    cancel: "Abbrechen",
    category: "Kategorie",
    priority: "Priorität",
    status: "Status",
    location: "Ort",
    description: "Beschreibung",
    titlePlaceholder: "Ereignistitel...",
    allDay: "Ganztägig",
    taskPool: "Aufgaben-Pool",
    dragTaskHelp: "Ziehen Sie Aufgaben auf den Kalender",
    settings: "Einstellungen",
    weekends: "Wochenende zeigen",
    bgEvents: "Hintergrund-Events",
    currentTime: "Zeitindikator",
    filters: "Kategoriefilter",
    timeZone: "Zeitzone",
    theme: "Thema",
    timezoneWarning: "Zeiten entsprechen der ausgewählten Zeitzone",
    catMeeting: "Meetings",
    catWorkshop: "Workshops",
    catReminder: "Erinnerungen",
    catWarehouse: "Lager",
    catTask: "Aufgaben",
    catPersonal: "Persönlich",
    priorityLow: "Niedrig",
    priorityMedium: "Mittel",
    priorityHigh: "Hoch",
    statusConfirmed: "Bestätigt",
    statusTentative: "Vorläufig",
    statusCancelled: "Abgesagt",
    optionsTitle: "Kalenderoptionen",
    showLunch: "Hintergrund-Events anzeigen",
    configTitle: "Systemkonfiguration",
    localeLabel: "Sprache",
    timeFormatLabel: "Zeitformat",
    timeZoneLabel: "Zeitzone",
    titleLabel: "Titel",
    startDateLabel: "Startdatum / -zeit",
    endDateLabel: "Enddatum / -zeit",
    allDayLabel: "Ganztägiges Ereignis",
    noHourlyWarning: "(Keine Stundenwerte erforderlich)",
    colorPresetLabel: "Farbvoreinstellung",
    locationPlaceholder: "Google Meet, Konferenzraum Alpha...",
    descriptionPlaceholder: "Geben Sie eine kurze Beschreibung, Links, Checkliste ein...",
    attendeesLabel: "Teilnehmer (Kommagetrennte Liste)",
    attendeesPlaceholder: "Ariadne V., Juliet S., Caleb P.",
    enableDraggingLabel: "Verschieben erlauben",
    enableResizingLabel: "Größenänderung erlauben",
    noDescription: "Keine Beschreibung vorhanden.",
    close: "Schließen",
    edit: "Bearbeiten",
    invalidDateError: "Bitte geben Sie ein gültiges Start- und Enddatum ein.",
    dateRangeError:
      "Das Ereignis muss länger als 0 Minuten dauern (Ende muss nach dem Start liegen).",
    allTasksScheduled: "Alle Aufgaben geplant",
    disabled: "Deaktiviert",
    hoverScheduleAt: "+ Klicken, um zu planen um",
    hoverAddAt: "+ Hinzufügen",
    modeCalendar: "Kalender",
    modePlanner: "Ressourcen-Planer",
    resourcePlanner: "Ressourcen-Planer",
    resourcesHierarchy: "Ressourcen-Hierarchie",
    loaded: "geladen",
    noResourcesFound: "Keine passenden Ressourcen gefunden.",
    allGroups: "Alle Gruppen",
    office: "Büro",
    timelineView: "Zeitachse",
    gridView: "Spaltenansicht",
    searchResources: "Ressourcen suchen...",
    calendarsTitle: "Kalender",
    noDueDateTitle: "Ohne Termin",
    moreUnscheduledAvailable:
      "Weitere ungeplante Elemente sind verfügbar. Grenzen Sie Kalender ein oder nutzen Sie später die Suche.",
    searchNoDueDate: "Ohne Termin suchen...",
    loadMoreUnscheduled: "Mehr laden",
    loadingMoreUnscheduled: "Lädt...",
    ticketsSource: "Tickets",
    openItem: "Öffnen",
    addCalendar: "Kalender hinzufügen",
    calendarNamePlaceholder: "Kalendername...",
    createCalendar: "Erstellen",
    calendarSettings: "Kalendereinstellungen",
    calendarColor: "Kalenderfarbe",
    resetColor: "Farbe zurücksetzen",
    done: "Fertig",
    systemCalendars: "System",
    kanbanCalendars: "Kanban-Boards",
    customCalendars: "Meine",
    showAll: "Alle anzeigen",
    hideAll: "Alle ausblenden",
    showOnlyThis: "Nur diesen anzeigen",
    settingsAndSharing: "Einstellungen und Freigabe",
    chooseCustomColor: "Eigene Farbe wählen",
    chooseCustomColorDescription:
      "Wählen Sie die Hintergrundfarbe dieses Kalenders. Die Textfarbe wird automatisch angepasst.",
    hexCode: "Hex-Code",
    moreEvents: "weitere",
    showLess: "Weniger anzeigen",
  },
};

/**
 * Custom function to convert a standard Date to a specific timezone-adjusted date string, or display it properly.
 * Keeping calculations lightweight for prototype while satisfying UI logic.
 */
export function formatInTimezone(
  date: Date,
  formatStr: string,
  timezone: string,
  localeKey: "en" | "pl" | "de"
) {
  const locale = LOCALE_MAP[localeKey];
  if (timezone === "Local") {
    return format(date, formatStr, { locale });
  }

  // Adjust date based on timezone offset for mockup/prototype presentation purposes
  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone === "UTC" ? "UTC" : timezone,
      year: "numeric",
      month: "numeric",
      day: "numeric",
      hour: "numeric",
      minute: "numeric",
      second: "numeric",
      hour12: false,
    });

    const parts = formatter.formatToParts(date);
    const getVal = (type: string) => Number(parts.find((p) => p.type === type)?.value) || 0;

    // Create a virtual date representing the clock time in that timezone
    const year = getVal("year");
    const month = getVal("month") - 1;
    const day = getVal("day");
    const hour = getVal("hour") === 24 ? 0 : getVal("hour"); // some browsers output 24 for midnight
    const minute = getVal("minute");
    const second = getVal("second");

    const virtualZonedDate = new Date(year, month, day, hour, minute, second);
    return format(virtualZonedDate, formatStr, { locale });
  } catch {
    // Fallback if browser doesn't recognize timezone or running SSR
    return format(date, formatStr, { locale });
  }
}

/**
 * Returns month grid days, padding with trailing days from adjacent months to build 42-day calendar.
 */
export function getMonthGridDays(date: Date, showWeekends: boolean = true) {
  const monthStart = startOfMonth(date);
  const monthEnd = endOfMonth(date);

  // Starting on Sunday by standard or custom
  const gridStart = startOfWeek(monthStart, { weekStartsOn: 0 });
  const gridEnd = endOfWeek(monthEnd, { weekStartsOn: 0 });

  let days = eachDayOfInterval({ start: gridStart, end: gridEnd });

  // If calendar doesn't span full 6 rows (42 days), pad to ensure layout grid is consistently sized
  while (days.length < 42) {
    const lastDay = days[days.length - 1];
    days.push(addDays(lastDay, 1));
  }

  if (!showWeekends) {
    // Filter out saturdays (6) and sundays (0)
    days = days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  }

  return days;
}

/**
 * Returns 7 days of the active week.
 */
export function getWeekDays(date: Date, showWeekends: boolean = true) {
  const weekStart = startOfWeek(date, { weekStartsOn: 1 }); // Start on Monday
  const days = eachDayOfInterval({
    start: weekStart,
    end: addDays(weekStart, 6),
  });

  if (!showWeekends) {
    return days.filter((d) => d.getDay() !== 0 && d.getDay() !== 6);
  }
  return days;
}

/**
 * Returns hour values (0-23) for day grids.
 */
export function getDayHours() {
  const hours = [];
  for (let i = 0; i < 24; i++) {
    hours.push(i);
  }
  return hours;
}

/**
 * Returns formatted subtitle showing date range based on calendar view and settings
 */
export function formatDateRangeTitle(
  date: Date,
  view: CalendarView,
  localeKey: "en" | "pl" | "de",
  timezone: string
) {
  if (view === "year") {
    return formatInTimezone(date, "yyyy", timezone, localeKey);
  }

  if (view === "month") {
    return formatInTimezone(date, "MMMM yyyy", timezone, localeKey);
  }

  if (view === "week") {
    const weekStart = startOfWeek(date, { weekStartsOn: 1 });
    const weekEnd = addDays(weekStart, 6);

    const startMonth = formatInTimezone(weekStart, "MMM", timezone, localeKey);
    const endMonth = formatInTimezone(weekEnd, "MMM", timezone, localeKey);
    const startDay = formatInTimezone(weekStart, "d", timezone, localeKey);
    const endDay = formatInTimezone(weekEnd, "d", timezone, localeKey);
    const year = formatInTimezone(weekEnd, "yyyy", timezone, localeKey);

    if (weekStart.getFullYear() !== weekEnd.getFullYear()) {
      const startYear = formatInTimezone(weekStart, "yyyy", timezone, localeKey);
      return `${startMonth} ${startDay}, ${startYear} – ${endMonth} ${endDay}, ${year}`;
    }

    if (startMonth === endMonth) {
      return `${startMonth} ${startDay} – ${endDay}, ${year}`;
    }

    return `${startMonth} ${startDay} – ${endMonth} ${endDay}, ${year}`;
  }

  if (view === "day" || view === "timeline") {
    return formatInTimezone(date, "MMMM d, yyyy", timezone, localeKey);
  }

  return LABELS_MAP[localeKey].upcoming;
}

/**
 * Filters events by a specific visible date range
 */
export function filterEventsByVisibleRange(events: CalendarEvent[], start: Date, end: Date) {
  const sTime = start.getTime();
  const eTime = end.getTime();

  return events.filter((event) => {
    const evStart = new Date(event.start).getTime();
    const evEnd = new Date(event.end).getTime();

    // Check if event overlaps or exists within start & end
    return (
      (evStart >= sTime && evStart <= eTime) ||
      (evEnd >= sTime && evEnd <= eTime) ||
      (evStart <= sTime && evEnd >= eTime)
    );
  });
}

/**
 * Filter events by selected categories
 */
export function filterEventsByCategory(
  events: CalendarEvent[],
  categories: Record<EventCategory, boolean>
) {
  return events.filter((event) => categories[event.category]);
}

/**
 * Calculate positions of events inside a vertical time-grid columns (hours based).
 * Returns absolute percentage top and height.
 */
export function calculateEventPositionInTimeGrid(
  event: CalendarEvent,
  day: Date,
  startHour = 0,
  endHour = 24
) {
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  const startOfDayDate = startOfDay(day);
  const midnightTime = startOfDayDate.getTime();

  const dayStartMs = startHour * 60 * 60 * 1000;
  const dayEndMs = endHour * 60 * 60 * 1000;
  const totalMs = dayEndMs - dayStartMs;

  const startMs = eventStart.getTime() - midnightTime;
  const endMs = eventEnd.getTime() - midnightTime;

  const clampedStartMs = Math.max(dayStartMs, Math.min(dayEndMs, startMs));
  const clampedEndMs = Math.max(dayStartMs, Math.min(dayEndMs, endMs));

  const startOffsetMs = clampedStartMs - dayStartMs;
  const durationMs = clampedEndMs - clampedStartMs;

  const topPercent = (startOffsetMs / totalMs) * 100;
  const heightPercent = (durationMs / totalMs) * 100;

  return {
    top: `${Math.max(0, Math.min(100, topPercent))}%`,
    height: `${Math.max(3, Math.min(100, heightPercent))}%`, // Min height so it's clickable
    isFullyOutside: clampedStartMs === clampedEndMs,
  };
}

export function eventIntersectsDay(event: CalendarEvent, day: Date) {
  const dayStart = startOfDay(day);
  const nextDayStart = addDays(dayStart, 1);
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  if (event.allDay) {
    return (
      startOfDay(eventStart).getTime() <= dayStart.getTime() &&
      startOfDay(eventEnd).getTime() >= dayStart.getTime()
    );
  }

  return eventStart.getTime() < nextDayStart.getTime() && eventEnd.getTime() > dayStart.getTime();
}

export function eventSpansMultipleDays(event: CalendarEvent) {
  return startOfDay(new Date(event.start)).getTime() !== startOfDay(new Date(event.end)).getTime();
}

export function getTimedEventSegmentForDay(event: CalendarEvent, day: Date): CalendarEvent | null {
  if (event.allDay || !eventIntersectsDay(event, day)) return null;

  const dayStart = startOfDay(day);
  const nextDayStart = addDays(dayStart, 1);
  const eventStart = new Date(event.start);
  const eventEnd = new Date(event.end);

  return {
    ...event,
    start: eventStart.getTime() > dayStart.getTime() ? eventStart : dayStart,
    end: eventEnd.getTime() < nextDayStart.getTime() ? eventEnd : nextDayStart,
  };
}

export function getEventDisplayDays(event: CalendarEvent) {
  const days: Date[] = [];
  const endDay = startOfDay(new Date(event.end));
  let cursor = startOfDay(new Date(event.start));

  while (cursor.getTime() <= endDay.getTime()) {
    if (eventIntersectsDay(event, cursor)) {
      days.push(new Date(cursor));
    }
    cursor = addDays(cursor, 1);
  }

  return days.length > 0 ? days : [startOfDay(new Date(event.start))];
}

/**
 * Core timezone translation utility. Given a virtual timezone, adjust a date's internal hour offsets so
 * that it lines up on the display's timezone grids perfectly.
 */
export function getDisplayTime(date: Date, timezone: string): { hour: number; minute: number } {
  if (timezone === "Local") {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }

  try {
    const formatter = new Intl.DateTimeFormat("en-US", {
      timeZone: timezone === "UTC" ? "UTC" : timezone,
      hour: "numeric",
      minute: "numeric",
      hour12: false,
    });
    const parts = formatter.formatToParts(date);
    const hourVal = parts.find((p) => p.type === "hour")?.value;
    const minVal = parts.find((p) => p.type === "minute")?.value;

    let hour = hourVal ? Number(hourVal) : date.getHours();
    if (hour === 24) hour = 0;
    const minute = minVal ? Number(minVal) : date.getMinutes();

    return { hour, minute };
  } catch {
    return { hour: date.getHours(), minute: date.getMinutes() };
  }
}

/**
 * Snaps dates to nearest intervals (e.g. 15, 30 minutes)
 */
export function snapDateToInterval(date: Date, intervalMinutes: number = 15): Date {
  const minutes = date.getMinutes();
  const remainder = minutes % intervalMinutes;
  const roundedMinutes =
    remainder >= intervalMinutes / 2
      ? minutes + (intervalMinutes - remainder)
      : minutes - remainder;

  const result = new Date(date);
  result.setMinutes(roundedMinutes);
  result.setSeconds(0);
  result.setMilliseconds(0);
  return result;
}

/**
 * Re-schedules an event to a new starting date/time while preserving duration
 */
export function moveEventToDate(event: CalendarEvent, newStartDate: Date): CalendarEvent {
  const durationMin = differenceInMinutes(new Date(event.end), new Date(event.start));
  const cleanStart = newStartDate;
  const cleanEnd = addMinutes(cleanStart, durationMin);

  return {
    ...event,
    start: cleanStart,
    end: cleanEnd,
  };
}

/**
 * Creates a CalendarEvent from an UnscheduledTask
 */
export function convertTaskToEvent(task: UnscheduledTask, startDate: Date): CalendarEvent {
  const duration = task.estimatedDurationMinutes || 60;
  const endDate = addMinutes(startDate, duration);

  return {
    id: `event-from-task-${Date.now()}`,
    title: task.title,
    description: task.description,
    start: startDate,
    end: endDate,
    category: task.category,
    priority: task.priority || "medium",
    status: "tentative",
    color: task.color,
    isDraggable: true,
    isResizable: true,
  };
}

/**
 * Detect overlapping events and calculate horizontal layout columns
 */
export function detectAndLayoutGridEvents(dayEvents: CalendarEvent[]) {
  // Sort chronological
  const sorted = [...dayEvents].sort(
    (a, b) => new Date(a.start).getTime() - new Date(b.start).getTime()
  );

  // Group into overlapping clusters (transitive overlap groups)
  const clusters: CalendarEvent[][] = [];
  let currentCluster: CalendarEvent[] = [];
  let currentMaxEnd = 0;

  for (const event of sorted) {
    const eventStart = new Date(event.start).getTime();
    const eventEnd = new Date(event.end).getTime();

    if (currentCluster.length === 0) {
      currentCluster.push(event);
      currentMaxEnd = eventEnd;
    } else if (eventStart < currentMaxEnd) {
      currentCluster.push(event);
      currentMaxEnd = Math.max(currentMaxEnd, eventEnd);
    } else {
      clusters.push(currentCluster);
      currentCluster = [event];
      currentMaxEnd = eventEnd;
    }
  }
  if (currentCluster.length > 0) {
    clusters.push(currentCluster);
  }

  const layoutData = new Map<string, { colIndex: number; totalCols: number }>();

  for (const cluster of clusters) {
    const columns: CalendarEvent[][] = [];

    for (const event of cluster) {
      let placed = false;
      for (let c = 0; c < columns.length; c++) {
        const col = columns[c];
        const lastEvent = col[col.length - 1];

        const lastEnd = new Date(lastEvent.end).getTime();
        const currentStart = new Date(event.start).getTime();

        if (currentStart >= lastEnd) {
          col.push(event);
          placed = true;
          break;
        }
      }

      if (!placed) {
        columns.push([event]);
      }
    }

    // Assign colIndex and totalCols specifically for this cluster
    const totalCols = columns.length;
    for (let c = 0; c < columns.length; c++) {
      for (const event of columns[c]) {
        layoutData.set(event.id, {
          colIndex: c,
          totalCols: totalCols,
        });
      }
    }
  }

  return layoutData;
}

/**
 * Format hourly label for left grid column based on selection setting
 */
export function formatGridHour(hr: number, timeFormat: "12h" | "24h"): string {
  if (timeFormat === "24h") {
    return hr < 10 ? `0${hr}:00` : `${hr}:00`;
  }
  return hr === 0 ? "12 AM" : hr === 12 ? "12 PM" : hr > 12 ? `${hr - 12} PM` : `${hr} AM`;
}

/**
 * Format helper for time presentation matching the timezone adjustment
 */
export function formatEventTime(
  start: Date,
  end: Date,
  allDay: boolean | undefined,
  localeKey: "en" | "pl" | "de",
  timezone: string,
  timeFormat: "12h" | "24h" = "12h"
) {
  if (allDay) return LABELS_MAP[localeKey].allDay;
  const skeleton = timeFormat === "24h" ? "HH:mm" : "h:mm a";
  const startStr = formatInTimezone(start, skeleton, timezone, localeKey);
  const endStr = formatInTimezone(end, skeleton, timezone, localeKey);
  return `${startStr} - ${endStr}`;
}

/**
 * Localize a calendar event, background event, or unscheduled task dynamically
 */
export function getLocalizedEvent<
  T extends { id: string; title: string; description?: string; location?: string },
>(item: T, localeKey: "en" | "pl" | "de"): T {
  const translations: Record<
    "en" | "pl" | "de",
    Record<string, { title: string; description?: string; location?: string }>
  > = {
    en: {
      "ev-1": {
        title: "Weekly Sync & Planning",
        description:
          "Alignment meeting with the product and engineering team to map out upcoming milestone deadlines.",
        location: "Conference Room Alpha",
      },
      "ev-2": {
        title: "Customer Workshop Intake",
        description: "Direct feedback session regarding the new CRM layout onboarding experience.",
        location: "Design Lab 4",
      },
      "ev-3": {
        title: "Warehouse Inventory Audit",
        description: "Bi-weekly scanning of physical incoming stock and discrepancy check.",
        location: "Bay 3 & Cold Storage",
      },
      "ev-4": {
        title: "Code Review & Merge",
        description:
          "Clean up technical debt and merge the calendar dragging feature pull request.",
        location: "Local Workstation",
      },
      "ev-5": {
        title: "Renew Cloud Hosting Subscription",
        description: "Pay annual developer license with corporate credit card.",
      },
      "ev-6": {
        title: "Doctor Appointment",
        description: "Routine annual general checkup.",
        location: "St. Mary Health Center",
      },
      "ev-7": {
        title: "Overlapping Strategy Discussion",
        description: "Interactive session exploring long-term infrastructure scaling plans.",
        location: "Virtual Huddle room",
      },
      "ev-8": {
        title: "Parallel Tech Demo Session",
        description: "Overlap slot showcasing the new canvas vector graphics system.",
        location: "Main Presentation Theater",
      },
      "ev-9": {
        title: "Logistics Core Integration",
        description: "Sync with fulfillment providers on supply chains.",
        location: "Fulfillment HQ",
      },
      "ev-10": {
        title: "Gym & Cardio Routine",
        description: "Interval running and light weights.",
      },
      "bg-lunch-daily": { title: "Lunch Break & Focus Rest" },
      "bg-lunch-tue": { title: "Lunch Break & Focus Rest" },
      "bg-lunch-wed": { title: "Lunch Break & Focus Rest" },
      "bg-lunch-thu": { title: "Lunch Break & Focus Rest" },
      "bg-lunch-fri": { title: "Lunch Break & Focus Rest" },
      "bg-weekend-closed": { title: "Branch Saturday Closed" },
      "bg-weekend-closed-sun": { title: "Branch Sunday Closed" },
      "bg-focus-blocks": { title: "Focus Rest Block" },
      "ut-1": {
        title: "Quarterly Financial Recap",
        description:
          "Summarize sheet calculations, outstanding customer invoices, and project profit margins.",
      },
      "ut-2": {
        title: "Security Compliance Form",
        description:
          "Fill out and sign standard AWS security checklist and pass credentials rotation audit.",
      },
      "ut-3": {
        title: "Product Launch Retro",
        description:
          "Write down pain-points of shipping the dynamic slider visual element on time.",
      },
      "ut-4": {
        title: "Inspect Core Forklift Battery",
        description: "Maintenance inspection of Warehouse charging docks.",
      },
      "ut-5": {
        title: "Order Fresh Espresso Beans",
        description: "Keep local community workspace fuel supply high.",
      },
    },
    pl: {
      "ev-1": {
        title: "Cotygodniowa synchronizacja i planowanie",
        description:
          "Spotkanie koordynacyjne z zespołem ds. produktu i inżynierii w celu zaplanowania nadchodzących kamieni milowych.",
        location: "Sala konferencyjna Alfa",
      },
      "ev-2": {
        title: "Warsztaty wdrożeniowe klienta",
        description: "Sesja opinii klienta na temat pierwszych wrażeń z nowego układu CRM.",
        location: "Laboratorium projektowe 4",
      },
      "ev-3": {
        title: "Audyt zapasów magazynowych",
        description: "Dwutygodniowe skanowanie przychodzących towarów i kontrola rozbieżności.",
        location: "Rampa 3 i chłodnia",
      },
      "ev-4": {
        title: "Przegląd kodu i scalanie",
        description:
          "Oczyszczanie długu technicznego i scalanie pull requesta dla funkcji przeciągania w kalendarzu.",
        location: "Lokalna stacja robocza",
      },
      "ev-5": {
        title: "Odnów subskrypcję chmury",
        description: "Opłata za roczną licencję deweloperską kartą firmową.",
      },
      "ev-6": {
        title: "Wizyta lekarska",
        description: "Rutynowe coroczne badanie ogólne.",
        location: "Centrum Medyczne św. Marii",
      },
      "ev-7": {
        title: "Dyskusja nad strategią nakładania się",
        description:
          "Sesja interaktywna omawiająca długoterminowe plany skalowania infrastruktury.",
        location: "Wirtualny pokój spotkań",
      },
      "ev-8": {
        title: "Równoległa sesja demonstracji technicznej",
        description: "Dodatkowe spotkanie prezentujące nowy system grafiki wektorowej canvas.",
        location: "Główna sala prezentacyjna",
      },
      "ev-9": {
        title: "Integracja logistyki centralnej",
        description: "Synchronizacja z dostawcami w zakresie łańcucha dostaw.",
        location: "Centrum realizacji zamówień",
      },
      "ev-10": {
        title: "Siłownia i rutyna kardio",
        description: "Bieganie interwałowe i lekkie ciężary.",
      },
      "bg-lunch-daily": { title: "Przerwa obiadowa i odpoczynek" },
      "bg-lunch-tue": { title: "Przerwa obiadowa i odpoczynek" },
      "bg-lunch-wed": { title: "Przerwa obiadowa i odpoczynek" },
      "bg-lunch-thu": { title: "Przerwa obiadowa i odpoczynek" },
      "bg-lunch-fri": { title: "Przerwa obiadowa i odpoczynek" },
      "bg-weekend-closed": { title: "Oddział zamknięty w sobotę" },
      "bg-weekend-closed-sun": { title: "Oddział zamknięty w niedzielę" },
      "bg-focus-blocks": { title: "Blok skupienia i odpoczynku" },
      "ut-1": {
        title: "Kwartalne podsumowanie finansowe",
        description: "Podsumowanie obliczeń arkusza, zaległych faktur klientów i marż zysku.",
      },
      "ut-2": {
        title: "Formularz zgodności bezpieczeństwa",
        description:
          "Wypełnienie i podpisanie standardowej listy kontrolnej AWS i przejście audytu rotacji.",
      },
      "ut-3": {
        title: "Retro po wprowadzeniu produktu",
        description: "Zapisanie problemów związanych z terminowym wdrożeniem dynamicznego suwaka.",
      },
      "ut-4": {
        title: "Sprawdź akumulator wózka widłowego",
        description: "Kontrola konserwacyjna stacji ładowania w magazynie.",
      },
      "ut-5": {
        title: "Zamów świeże ziarna kawy",
        description: "Utrzymywanie wysokiego zapasu kawy we wspólnej przestrzeni roboczej.",
      },
    },
    de: {
      "ev-1": {
        title: "Wöchentlicher Sync & Planung",
        description:
          "Abstimmungstreffen mit dem Produkt- und Entwicklungsteam zur Planung anstehender Meilensteine.",
        location: "Konferenzraum Alpha",
      },
      "ev-2": {
        title: "Kunden-Workshop-Einführung",
        description: "Feedback-Sitzung zu den ersten Erfahrungen mit dem neuen CRM-Layout.",
        location: "Design-Lab 4",
      },
      "ev-3": {
        title: "Lagerbestandsprüfung",
        description:
          "Zweiwöchentliches Scannen des physischen Wareneingangs und Abgleich von Diskrepanzen.",
        location: "Halle 3 & Kühllager",
      },
      "ev-4": {
        title: "Code-Review & Merge",
        description:
          "Bereinigung von technischen Schulden und Zusammenführen des Kalender-Dragging-Pull-Requests.",
        location: "Lokale Workstation",
      },
      "ev-5": {
        title: "Cloud-Hosting-Abonnement erneuern",
        description: "Zahlung der jährlichen Entwicklerlizenz per Firmenkreditkarte.",
      },
      "ev-6": {
        title: "Arzttermin",
        description: "Jährliche Routineuntersuchung.",
        location: "St. Mary Gesundheitszentrum",
      },
      "ev-7": {
        title: "Überlappende Strategiediskussion",
        description: "Interaktiv-Sitzung zu langfristigen Skalierungsplänen der Infrastruktur.",
        location: "Virtueller Besprechungsraum",
      },
      "ev-8": {
        title: "Parallele Tech-Demo-Sitzung",
        description: "Präsentationsslot für das neue Canvas-Vektorgrafiksystem.",
        location: "Hauptpräsentationssaal",
      },
      "ev-9": {
        title: "Logistik-Kernintegration",
        description: "Synchronisation mit Logistikdienstleistern über Lieferketten.",
        location: "Fulfillment-Hauptsitz",
      },
      "ev-10": {
        title: "Fitnessstudio & Cardio",
        description: "Intervalllaufen und leichtes Krafttraining.",
      },
      "bg-lunch-daily": { title: "Mittagspause & Erholung" },
      "bg-lunch-tue": { title: "Mittagspause & Erholung" },
      "bg-lunch-wed": { title: "Mittagspause & Erholung" },
      "bg-lunch-thu": { title: "Mittagspause & Erholung" },
      "bg-lunch-fri": { title: "Mittagspause & Erholung" },
      "bg-weekend-closed": { title: "Filiale Samstag geschlossen" },
      "bg-weekend-closed-sun": { title: "Filiale Sonntag geschlossen" },
      "bg-focus-blocks": { title: "Fokus- und Ruheblock" },
      "ut-1": {
        title: "Quartalsfinanzbericht",
        description:
          "Zusammenfassung von Tabellenkalkulationen, ausstehenden Kundenrechnungen und Projektmargen.",
      },
      "ut-2": {
        title: "Sicherheits-Compliance-Formular",
        description:
          "Ausfüllen und Unterschreiben der AWS-Sicherheitsliste und Bestehen des Key-Audits.",
      },
      "ut-3": {
        title: "Produktlaunch-Retrospektive",
        description: "Festhalten von Problemen bei der Bereitstellung des dynamischen Sliders.",
      },
      "ut-4": {
        title: "Gabelstapler-Batterie prüfen",
        description: "Wartungsprüfung der Lager-Ladestationen.",
      },
      "ut-5": {
        title: "Frische Espressobohnen bestellen",
        description: "Sicherstellung der Kaffeeversorgung im Coworking Space.",
      },
    },
  };

  const localizedSet = translations[localeKey];
  if (localizedSet && localizedSet[item.id]) {
    const data = localizedSet[item.id];
    return {
      ...item,
      title: data.title,
      ...(data.description !== undefined && { description: data.description }),
      ...(data.location !== undefined && { location: data.location }),
    };
  }

  return item;
}
