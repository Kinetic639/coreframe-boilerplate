import { DEFAULT_TIME_ZONE } from "@/lib/date-time/time-zone";

/**
 * Runs once when a server instance starts, before it handles requests.
 *
 * Servers run in UTC, so every date formatted on the server without an
 * explicit time zone (`toLocaleString()`, `date-fns` `format()`, server
 * rendering of client components) showed UTC: one hour early in Polish winter
 * time. Node applies a `TZ` set at runtime to `Date` and `Intl`, so this makes
 * the server's local time match the app's default zone. Vercel reserves the
 * `TZ` environment variable, which is why it is set here rather than in the
 * project settings (AWS Lambda, which Vercel runs on, presets `TZ=:UTC`, so
 * this overrides it unconditionally).
 */
export function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    process.env.TZ = DEFAULT_TIME_ZONE;
  }
}
