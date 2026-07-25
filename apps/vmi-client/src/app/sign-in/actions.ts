"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { demoSessionCookie } from "@/lib/demo-session";

export async function signInDemoClientAction() {
  const cookieStore = await cookies();
  cookieStore.set(demoSessionCookie.name, demoSessionCookie.value, {
    httpOnly: true,
    sameSite: "lax",
    path: "/",
    maxAge: 60 * 60 * 8,
  });

  redirect("/portal");
}

export async function signOutDemoClientAction() {
  const cookieStore = await cookies();
  cookieStore.delete(demoSessionCookie.name);

  redirect("/sign-in");
}
