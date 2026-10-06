import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { pathnameWithoutLocale, resolveAcceptLanguageLocale } from "@repo/i18n/middleware-utils";
import { authPathnames } from "@repo/i18n/auth-pathnames";
import { routing } from "./i18n/routing";
import { updateSession } from "./utils/supabase/proxy";

type Locale = (typeof routing.locales)[number];

const intlMiddleware = createIntlMiddleware(routing);

const signInPaths: string[] = Object.values(authPathnames["/sign-in"]);
const publicPaths = new Set<string>([
  ...signInPaths,
  ...Object.values(authPathnames["/forgot-password"]),
]);

function requestLocale(request: NextRequest): Locale {
  const [, first] = request.nextUrl.pathname.split("/");
  if (routing.locales.includes(first as Locale)) return first as Locale;
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (routing.locales.includes(cookieLocale as Locale)) return cookieLocale as Locale;
  return resolveAcceptLanguageLocale(
    request.headers.get("accept-language"),
    routing.locales,
    routing.defaultLocale
  );
}

function localized(path: "/" | "/sign-in", locale: Locale): string {
  const slug = path === "/" ? "/" : authPathnames["/sign-in"][locale];
  if (locale === routing.defaultLocale) return slug;
  return path === "/" ? `/${locale}` : `/${locale}${slug}`;
}

// Every page except sign-in / forgot-password needs a signed-in user.
export async function proxy(request: NextRequest) {
  const { response: sessionResponse, user } = await updateSession(request);
  const pathname = pathnameWithoutLocale(request.nextUrl.pathname, routing.locales);
  const locale = requestLocale(request);

  let response: NextResponse;
  if (!user && !publicPaths.has(pathname)) {
    const url = new URL(localized("/sign-in", locale), request.url);
    if (pathname !== "/") {
      url.searchParams.set("returnUrl", request.nextUrl.pathname + request.nextUrl.search);
    }
    response = NextResponse.redirect(url);
  } else if (user && signInPaths.includes(pathname)) {
    response = NextResponse.redirect(new URL(localized("/", locale), request.url));
  } else {
    response = intlMiddleware(request);
  }

  for (const { name, value, ...options } of sessionResponse.cookies.getAll()) {
    response.cookies.set(name, value, options);
  }
  return response;
}

export const config = {
  // Literal matcher (Next.js requires a static value). The `pl(?:/|$)`
  // exclusion stops next-intl's internal rewrite for unprefixed default-locale
  // requests from re-entering the middleware -- same as apps/web and
  // apps/public-web; see @repo/i18n/middleware-utils.
  matcher: [
    "/((?!api|auth|_next/static|_next/image|favicon.ico|robots.txt|manifest.webmanifest|pl(?:/|$)|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
