import { cookies } from "next/headers";
import { getLocale } from "next-intl/server";
import { redirect } from "@/i18n/navigation";

const DEMO_SESSION_COOKIE = "vmi_demo_session";
const DEMO_SESSION_VALUE = "client-demo";

export async function hasDemoSession() {
  const cookieStore = await cookies();
  return cookieStore.get(DEMO_SESSION_COOKIE)?.value === DEMO_SESSION_VALUE;
}

export async function requireDemoSession() {
  if (!(await hasDemoSession())) {
    const locale = await getLocale();
    redirect({ href: "/sign-in", locale });
  }
}

export const demoSessionCookie = {
  name: DEMO_SESSION_COOKIE,
  value: DEMO_SESSION_VALUE,
};
