import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Map of internal paths to localized URLs.
// Polish is the default locale so no /pl/ prefix is needed for Polish URLs.
const localizedPaths: Record<string, Record<string, string>> = {
  "/reset-password": {
    en: "/en/reset-password",
    pl: "/zresetuj-haslo",
  },
  "/auth-code-error": {
    en: "/en/auth-code-error",
    pl: "/blad-uwierzytelniania",
  },
};

function getLocalizedPath(path: string, locale: string): string {
  // Check if we have a localized version
  const pathMappings = localizedPaths[path];
  if (pathMappings && pathMappings[locale]) {
    return pathMappings[locale];
  }

  // If path already has locale prefix, return as-is
  if (path.startsWith("/en/") || path.startsWith("/pl/")) {
    return path;
  }

  // Default: add locale prefix for non-default locale
  if (locale === "pl") {
    return path; // Polish is default, no prefix
  }
  return `/${locale}${path}`;
}

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/reset-password";
  const locale = searchParams.get("locale") ?? "pl"; // Default to Polish

  if (token_hash && type) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash });

    if (!error) {
      const localizedNext = getLocalizedPath(next, locale);

      // Preserve other query parameters (except token_hash, type, next, locale)
      const redirectUrl = new URL(`${origin}${localizedNext}`);
      for (const [key, value] of searchParams.entries()) {
        if (!["token_hash", "type", "next", "locale"].includes(key)) {
          redirectUrl.searchParams.set(key, value);
        }
      }

      // For signup, indicate first-time password setup so the form shows correct copy
      if (type === "signup") {
        redirectUrl.searchParams.set("mode", "set");
      }

      return NextResponse.redirect(redirectUrl.toString());
    }

    const errorPage = getLocalizedPath("/auth-code-error", locale);
    return NextResponse.redirect(
      `${origin}${errorPage}?error=${encodeURIComponent(error.message)}`
    );
  }

  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_params`);
}
