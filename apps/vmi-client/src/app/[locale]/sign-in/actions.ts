"use server";

import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";
import { demoSessionCookie } from "@/lib/demo-session";

export async function signInDemoClientAction() {
  const cookieStore = await cookies();
  cookieStore.set(demoSessionCookie.name, demoSessionCookie.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  const locale = await getLocale();
  redirect({ href: "/portal", locale });
}

export async function signOutDemoClientAction() {
  const cookieStore = await cookies();
  cookieStore.delete(demoSessionCookie.name);

  const locale = await getLocale();
  redirect({ href: "/sign-in", locale });
}
