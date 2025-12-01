import { type NextRequest, NextResponse } from "next/server";
import { routing } from "@/i18n/routing";
import { createMiddlewareClient } from "@/lib/supabase/server";

export const updateSession = async (request: NextRequest) => {
  try {
    const response = NextResponse.next({
      request: {
        headers: request.headers,
      },
    });

    const supabase = createMiddlewareClient(request, response);

    const user = await supabase.auth.getUser();

    if (request.nextUrl.pathname.startsWith("/dashboard") && user.error) {
      const locale = request.cookies.get("NEXT_LOCALE")?.value || routing.defaultLocale;

      const signInPaths = routing.pathnames["/sign-in"];
      const localizedSignInPath =
        typeof signInPaths === "string"
          ? signInPaths
          : signInPaths[locale as keyof typeof signInPaths];

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
    return NextResponse.next({
      request: {
        headers: request.headers,
      },
    });
  }
};
