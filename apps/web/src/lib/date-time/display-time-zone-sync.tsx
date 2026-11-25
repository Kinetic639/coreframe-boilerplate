"use client";

import { useTimeZone } from "next-intl";
import { setDisplayTimeZone } from "./format";

/**
 * Hands next-intl's time zone (user → organization → Europe/Warsaw) to the
 * plain formatting helpers in ./format. Rendered first inside
 * NextIntlClientProvider, so the zone is set during render, before any page
 * component formats a date. Renders nothing.
 */
export function DisplayTimeZoneSync() {
  setDisplayTimeZone(useTimeZone());
  return null;
}
