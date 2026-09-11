import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { pathnameWithoutLocale, resolveAcceptLanguageLocale } from "@repo/i18n/middleware-utils";
import { routing, type Locale } from "@/i18n/routing";
import { resolveLocalizedPathnames } from "@/i18n/localized-pathnames";

// Prefer the locale segment already in the URL (e.g. "/en/sign-in"), then the
// NEXT_LOCALE cookie (shared across apps -- see @repo/i18n/config), then the
// browser's Accept-Language, matching next-intl's own prefix > cookie >
// accept-language > default precedence so this auth-redirect logic doesn't
// disagree with next-intl's middleware about which locale a visitor wants.
function detectLocale(request: NextRequest): Locale {
  const [, maybeLocale] = request.nextUrl.pathname.split("/");
  if (routing.locales.includes(maybeLocale as Locale)) {
    return maybeLocale as Locale;
  }
  const cookieLocale = request.cookies.get("NEXT_LOCALE")?.value;
  if (routing.locales.includes(cookieLocale as Locale)) {
    return cookieLocale as Locale;
  }
  return resolveAcceptLanguageLocale(
    request.headers.get("accept-language"),
    routing.locales,
    routing.defaultLocale
  );
}

function buildLocalizedUrl(request: NextRequest, pathnameKey: string, locale: Locale): URL {
  const localized = resolveLocalizedPathnames(pathnameKey);
  const slug = localized[locale];
  const path = locale === routing.defaultLocale ? slug : `/${locale}${slug}`;
  return new URL(path, request.url);
}

function isSignInPath(normalizedPathname: string): boolean {
  const signIn = resolveLocalizedPathnames("/sign-in");
  return normalizedPathname === signIn.en || normalizedPathname === signIn.pl;
}

export const updateSession = async (request: NextRequest) => {
  // This `try/catch` block is only here for the interactive tutorial.
  // Feel free to remove once you have Supabase connected.
  try {
    // Create an unmodified response
    let response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return request.cookies.getAll();
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
            response = NextResponse.next({
              request,
            });
            cookiesToSet.forEach(({ name, value, options }) =>
              response.cookies.set(name, value, options)
            );
          },
        },
      }
    );

    // This will refresh session if expired - required for Server Components
    // https://supabase.com/docs/guides/auth/server-side/nextjs
    const user = await supabase.auth.getUser();

    const normalizedPathname = pathnameWithoutLocale(request.nextUrl.pathname, routing.locales);
    const isAuthenticated = !user.error;
    const locale = detectLocale(request);

    // dashboard routes require auth
    if (normalizedPathname.startsWith("/dashboard") && !isAuthenticated) {
      const signInUrl = buildLocalizedUrl(request, "/sign-in", locale);
      signInUrl.searchParams.set("returnUrl", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }

    // Signed-in users should never land on the sign-in page or the bare "/" —
    // send them straight into the app instead.
    if (isAuthenticated && (normalizedPathname === "/" || isSignInPath(normalizedPathname))) {
      return NextResponse.redirect(buildLocalizedUrl(request, "/dashboard/start", locale));
    }

    // Root has no public page anymore (public pages live in apps/public-web) —
    // anonymous visitors land on sign-in.
    if (!isAuthenticated && normalizedPathname === "/") {
      return NextResponse.redirect(buildLocalizedUrl(request, "/sign-in", locale));
    }

    return response;
  } catch (_error) {
    console.error(_error);
    // If you are here, a Supabase client could not be created!
    // This is likely because you have not set up environment variables.
    // Check out http://localhost:3000 for Next Steps.
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
