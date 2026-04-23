import { type NextRequest } from "next/server";
import { updateSession } from "@/utils/supabase/proxy";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

function pathnameWithoutLocale(pathname: string): string {
  const [, maybeLocale, ...rest] = pathname.split("/");
  if (routing.locales.includes(maybeLocale as (typeof routing.locales)[number])) {
    return rest.length > 0 ? `/${rest.join("/")}` : "/";
  }
  return pathname;
}

function needsSupabaseSession(pathname: string): boolean {
  const normalized = pathnameWithoutLocale(pathname);
  return (
    normalized === "/" ||
    normalized.startsWith("/dashboard") ||
    normalized.startsWith("/admin") ||
    normalized.startsWith("/onboarding")
  );
}

export async function proxy(request: NextRequest) {
  // Run next-intl middleware first
  const intlResponse = intlMiddleware(request);

  // Set pathname header for server components
  intlResponse.headers.set("x-pathname", request.nextUrl.pathname);

  if (!needsSupabaseSession(request.nextUrl.pathname)) {
    return intlResponse;
  }

  // Run Supabase session proxy on the updated request
  const response = await updateSession(request);

  // Copy cookies from Supabase to the intl response
  const cookiesToCopy = response.cookies.getAll();

  for (const cookie of cookiesToCopy) {
    const { name, value, ...options } = cookie;
    intlResponse.cookies.set(name, value, options);
  }

  return intlResponse;
}

export const config = {
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
