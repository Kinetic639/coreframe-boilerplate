const DATE_ONLY_PATTERN = /^\d{4}-\d{2}-\d{2}$/;

function getTimeZoneParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-US", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hourCycle: "h23",
  });

  const parts = formatter.formatToParts(date);
  const value = (type: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === type)?.value ?? 0);

  return {
    year: value("year"),
    month: value("month"),
    day: value("day"),
    hour: value("hour"),
    minute: value("minute"),
    second: value("second"),
  };
}

function getTimeZoneOffsetMs(date: Date, timeZone: string) {
  const parts = getTimeZoneParts(date, timeZone);
  const asUtc = Date.UTC(
    parts.year,
    parts.month - 1,
    parts.day,
    parts.hour,
    parts.minute,
    parts.second,
    date.getUTCMilliseconds()
  );
  return asUtc - date.getTime();
}

export function isDateOnly(value: string): boolean {
  return DATE_ONLY_PATTERN.test(value);
}

export function dateOnlyToLocalDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split("-").map(Number);
  return new Date(year, month - 1, day);
}

export function dateToDateOnly(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function dateOnlyToZonedIso(
  dateOnly: string,
  timeZone: string,
  time: { hour: number; minute?: number; second?: number; millisecond?: number } = { hour: 12 }
): string {
  if (!isDateOnly(dateOnly)) {
    throw new Error("Expected yyyy-MM-dd date");
  }

  const [year, month, day] = dateOnly.split("-").map(Number);
  const utcGuess = new Date(
    Date.UTC(
      year,
      month - 1,
      day,
      time.hour,
      time.minute ?? 0,
      time.second ?? 0,
      time.millisecond ?? 0
    )
  );
  const offset = getTimeZoneOffsetMs(utcGuess, timeZone);
  return new Date(utcGuess.getTime() - offset).toISOString();
}

export function isoToDateOnlyInTimeZone(iso: string, timeZone: string): string {
  const date = new Date(iso);
  const parts = getTimeZoneParts(date, timeZone);
  return [
    String(parts.year).padStart(4, "0"),
    String(parts.month).padStart(2, "0"),
    String(parts.day).padStart(2, "0"),
  ].join("-");
}
