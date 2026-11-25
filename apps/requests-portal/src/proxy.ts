import createIntlMiddleware from "next-intl/middleware";
import { NextRequest, NextResponse } from "next/server";
import { pathnameWithoutLocale, resolveAcceptLanguageLocale } from "@repo/i18n/middleware-utils";
import { authPathnames } from "@repo/i18n/auth-pathnames";
import { appUrl, buildSignInUrl, resolveReturnUrl } from "@repo/app-urls";
import { routing } from "./i18n/routing";
import { updateSession } from "./utils/supabase/proxy";
import { LIST_QUERY_HEADER } from "./server/requests/list-params";

type Locale = (typeof routing.locales)[number];

const intlMiddleware = createIntlMiddleware(routing);

// The portal has no sign-in of its own any more: every Ambra app signs in on the ERP
// (see @repo/app-urls). These old local URLs only forward to it.
const legacyAuthPaths = new Set<string>([
  ...Object.values(authPathnames["/sign-in"]),
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

function localizedHome(locale: Locale): string {
  return locale === routing.defaultLocale ? "/" : `/${locale}`;
}

/** Absolute address of this request on the portal's public origin, for the sign-in to return to. */
function returnUrlFor(request: NextRequest, pathname: string, locale: Locale): string {
  if (legacyAuthPaths.has(pathname)) {
    // An old /logowanie?returnUrl=/123 link: keep its target, made absolute.
    const target = resolveReturnUrl(request.nextUrl.searchParams.get("returnUrl"));
    if (target) return target.startsWith("/") ? appUrl("requests", target) : target;
    return appUrl("requests", localizedHome(locale));
  }
  return appUrl("requests", request.nextUrl.pathname + request.nextUrl.search);
}

/** Same response (rewrite / next signals included) minus its Set-Cookie headers. */
function withoutCookies(res: NextResponse): NextResponse {
  const headers = new Headers(res.headers);
  headers.delete("set-cookie");
  return new NextResponse(res.body, { status: res.status, headers });
}

// Every page needs a signed-in user; without one the user signs in on the ERP and comes back.
export async function proxy(request: NextRequest) {
  const { response: sessionResponse, user } = await updateSession(request);
  const pathname = pathnameWithoutLocale(request.nextUrl.pathname, routing.locales);
  const locale = requestLocale(request);

  let response: NextResponse;
  if (!user) {
    response = NextResponse.redirect(
      buildSignInUrl(returnUrlFor(request, pathname, locale), locale)
    );
  } else if (legacyAuthPaths.has(pathname)) {
    response = NextResponse.redirect(new URL(localizedHome(locale), request.url));
  } else {
    // The requests layout persists across ticket navigation and has no searchParams, so it
    // gets the list query (filters) from this header for its first server render.
    const headers = new Headers(request.headers);
    headers.set(LIST_QUERY_HEADER, request.nextUrl.search);
    response = intlMiddleware(new NextRequest(request, { headers }));
    // Server Actions still need next-intl's rewrite ("/" -> "/pl") but not its locale
    // cookie: any cookie in an action response makes Next re-render the whole route.
    if (request.headers.has("next-action")) response = withoutCookies(response);
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
