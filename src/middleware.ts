import { createServerClient } from "@supabase/ssr";
import createIntlMiddleware from "next-intl/middleware";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

// next-intl middleware handles locale detection, prefix routing, and pathnames
const handleI18nRouting = createIntlMiddleware(routing);

export async function middleware(request: NextRequest): Promise<NextResponse> {
  // Run next-intl locale routing first — returns a NextResponse with correct
  // locale headers/redirects and the `Next-Url` header set for server components.
  const response = handleI18nRouting(request);

  // Attach a Supabase client that reads cookies from the request and writes
  // refreshed auth cookies into the response.  This ensures the Supabase session
  // is kept alive across page navigations without requiring a full re-login.
  //
  // NOTE: getUser() validates the JWT server-side (not a cookie-only read).
  // It must be called here so that refreshed tokens are flushed to the response
  // cookies before Next.js sends the response to the browser.
  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          // Propagate auth cookies to the outgoing response.
          cookiesToSet.forEach(({ name, value, options }) => {
            response.cookies.set(name, value, options);
          });
        },
      },
    }
  );

  // Validates the JWT with the Supabase auth server and refreshes the session
  // if it has expired.  The result is intentionally unused here — route-level
  // auth checks are performed inside each layout/page via getUser().
  await supabase.auth.getUser();

  return response;
}

export const config = {
  // Run middleware on page/layout routes ONLY.
  //
  // Excluded (must NOT run middleware):
  //   - _next/static, _next/image   — Next.js internals
  //   - favicon.ico                 — static asset
  //   - api/*                       — Route Handlers own their auth; adding
  //                                   getUser() here wastes a Supabase round-trip
  //                                   per API call and next-intl locale detection
  //                                   can interfere with binary responses (PDFs, etc.)
  //   - auth/*                      — Supabase callback/confirm routes manage their
  //                                   own session exchange; running middleware before
  //                                   these would call getUser() before the OTP/code
  //                                   is verified, wasting a round-trip and risking
  //                                   next-intl redirecting the callback URL
  //   - Static asset extensions     — images, fonts, icons
  matcher: [
    "/((?!_next/static|_next/image|favicon\\.ico|api/|auth/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|woff2?)$).*)",
  ],
};
