"use server";

import { cookies } from "next/headers";
import { getSharedCookieOptions, OPEN_LAST_APP_COOKIE } from "@repo/app-urls";
import { getAuthUser } from "@/server/auth/get-auth-user";

/** Saves "next time, open my last app straight away" (a cookie shared by every Ambra app). */
export async function setOpenLastAppAction(open: boolean): Promise<{ success: boolean }> {
  const {
    data: { user },
  } = await getAuthUser();
  if (!user) return { success: false };

  const cookieStore = await cookies();
  if (open) {
    cookieStore.set(OPEN_LAST_APP_COOKIE, "1", getSharedCookieOptions());
  } else {
    cookieStore.set(OPEN_LAST_APP_COOKIE, "", { ...getSharedCookieOptions(), maxAge: 0 });
  }
  return { success: true };
}
