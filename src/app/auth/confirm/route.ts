import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

// Map of internal paths to localized URLs
// Polish is default locale, so no prefix needed for Polish URLs
const localizedPaths: Record<string, Record<string, string>> = {
  "/reset-password": {
    en: "/en/reset-password",
    pl: "/zresetuj-haslo",
  },
  "/dashboard-old/start": {
    en: "/en/dashboard-old/start",
    pl: "/dashboard-old/start",
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

  console.log("[Auth Confirm] Token hash:", token_hash ? "present" : "missing");
  console.log("[Auth Confirm] Type:", type);
  console.log("[Auth Confirm] Next (raw):", next);
  console.log("[Auth Confirm] Locale:", locale);
  console.log("[Auth Confirm] Origin:", origin);

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    console.log("[Auth Confirm] Verify result:", { data: !!data, error: error?.message });

    if (!error) {
      // Get the localized redirect URL
      const localizedNext = getLocalizedPath(next, locale);

      // Preserve other query parameters (except token_hash, type, next, locale)
      const redirectUrl = new URL(`${origin}${localizedNext}`);
      for (const [key, value] of searchParams.entries()) {
        if (!["token_hash", "type", "next", "locale"].includes(key)) {
          redirectUrl.searchParams.set(key, value);
        }
      }

      console.log("[Auth Confirm] Redirecting to:", redirectUrl.toString());
      return NextResponse.redirect(redirectUrl.toString());
    }

    // Verification failed
    console.error("[Auth Confirm] Verification error:", error.message);
    return NextResponse.redirect(
      `${origin}/auth/auth-code-error?error=${encodeURIComponent(error.message)}`
    );
  }

  // Missing token_hash or type
  console.error("[Auth Confirm] Missing token_hash or type");
  return NextResponse.redirect(`${origin}/auth/auth-code-error?error=missing_params`);
}
