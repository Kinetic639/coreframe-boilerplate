"use server";

import { cookies } from "next/headers";
import {
  DEFAULT_APP_COOKIE,
  getSharedCookieOptions,
  isAmbraWorkApp,
  OPEN_LAST_APP_COOKIE,
} from "@repo/app-urls";
import { createClient } from "@/utils/supabase/server";

/**
 * Marks the app opened straight after sign-in (the star in the app switcher), or clears
 * it. Clearing also turns off "open the last app", so the chooser shows again.
 */
export async function setDefaultAppAction(app: string | null): Promise<{ success: boolean }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { success: false };
  if (app !== null && !isAmbraWorkApp(app)) return { success: false };

  const cookieStore = await cookies();
  const cleared = { ...getSharedCookieOptions(), maxAge: 0 };
  if (app) {
    cookieStore.set(DEFAULT_APP_COOKIE, app, getSharedCookieOptions());
  } else {
    cookieStore.set(DEFAULT_APP_COOKIE, "", cleared);
    cookieStore.set(OPEN_LAST_APP_COOKIE, "", cleared);
  }
  return { success: true };
}
