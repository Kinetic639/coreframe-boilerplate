/**
 * Locale formatting of timestamps in the person's display time zone.
 *
 * Drop-in replacements for `Date#toLocaleString`, `toLocaleDateString` and
 * `toLocaleTimeString`, which format in the runtime's zone: the browser's on
 * the client, UTC on the server. These add the display zone (user → org →
 * Europe/Warsaw) unless the caller passes its own `timeZone`.
 *
 * In the browser the zone comes from next-intl (see DisplayTimeZoneSync, which
 * runs in the root layout before any page renders). On the server there is no
 * per-request module state, so the process zone applies (Europe/Warsaw, set in
 * instrumentation.ts); server components that need a user's own zone should
 * use next-intl's `getFormatter()`.
 */

type DateInput = Date | string | number;

let displayTimeZone: string | undefined;

/** Set by DisplayTimeZoneSync in the browser. Ignored on the server. */
export function setDisplayTimeZone(timeZone: string | undefined): void {
  if (typeof window === "undefined") return;
  displayTimeZone = timeZone;
}

/** The zone used by the helpers below (undefined = runtime default). */
export function getDisplayTimeZone(): string | undefined {
  return typeof window === "undefined" ? undefined : displayTimeZone;
}

function withZone(options?: Intl.DateTimeFormatOptions): Intl.DateTimeFormatOptions | undefined {
  const timeZone = getDisplayTimeZone();
  if (!timeZone || options?.timeZone) return options;
  return { ...options, timeZone };
}

function toDate(value: DateInput): Date {
  return value instanceof Date ? value : new Date(value);
}

/** `Date#toLocaleString` (date and time) in the display zone. */
export function formatDateTime(
  value: DateInput,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleString(locale, withZone(options));
}

/** `Date#toLocaleDateString` in the display zone. */
export function formatDate(
  value: DateInput,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleDateString(locale, withZone(options));
}

/** `Date#toLocaleTimeString` in the display zone. */
export function formatTime(
  value: DateInput,
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): string {
  return toDate(value).toLocaleTimeString(locale, withZone(options));
}

/** `new Intl.DateTimeFormat(locale, options)` in the display zone. */
export function dateTimeFormat(
  locale?: Intl.LocalesArgument,
  options?: Intl.DateTimeFormatOptions
): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(locale as string | string[] | undefined, withZone(options));
}
