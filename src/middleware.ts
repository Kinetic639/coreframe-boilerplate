import { type NextRequest } from "next/server";
import { updateSession } from "@supabase/middleware";
import createIntlMiddleware from "next-intl/middleware";
import { routing } from "./i18n/routing";

const intlMiddleware = createIntlMiddleware(routing);

export async function middleware(request: NextRequest) {
  // Run next-intl middleware first
  const intlResponse = intlMiddleware(request);

  // Run Supabase session middleware on the updated request
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
    "/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
