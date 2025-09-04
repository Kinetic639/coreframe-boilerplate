import { createServerClient } from "@supabase/ssr";
import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";

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

    // dashboard routes
    if (request.nextUrl.pathname.startsWith("/dashboard") && user.error) {
      // Detect locale from request (fallback to default)
      const locale = request.cookies.get("NEXT_LOCALE")?.value || routing.defaultLocale;

      // Get localized sign-in path
      const signInPaths = routing.pathnames["/sign-in"];
      const localizedSignInPath =
        typeof signInPaths === "string"
          ? signInPaths
          : signInPaths[locale as keyof typeof signInPaths];

      // Build sign-in URL with locale prefix if needed
      const signInPath =
        locale === routing.defaultLocale ? localizedSignInPath : `/${locale}${localizedSignInPath}`;

      const signInUrl = new URL(signInPath, request.url);
      signInUrl.searchParams.set("returnUrl", request.nextUrl.pathname + request.nextUrl.search);
      return NextResponse.redirect(signInUrl);
    }

    if (request.nextUrl.pathname === "/" && !user.error) {
      return NextResponse.redirect(new URL("/dashboard", request.url));
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
