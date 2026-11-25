/**
 * Time zone used to display dates and times in the app.
 *
 * Timestamps are stored in UTC (`timestamptz`). They must be shown in the
 * user's local time, but servers (Vercel functions) run in UTC, so anything
 * formatted on the server without an explicit time zone came out one hour
 * early in Polish winter time (two in summer). Every formatter that renders
 * for a person should use this zone (or the user's own preference).
 */
export const DEFAULT_TIME_ZONE = "Europe/Warsaw";

/** True when `value` is an IANA time zone this runtime understands. */
export function isValidTimeZone(value: string | null | undefined): value is string {
  if (!value) return false;
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value });
    return true;
  } catch {
    return false;
  }
}

/**
 * The time zone to use for a stored preference: the preference when it is a
 * valid IANA zone, otherwise the app default.
 */
export function resolveTimeZone(preference: string | null | undefined): string {
  return isValidTimeZone(preference) ? preference : DEFAULT_TIME_ZONE;
}
