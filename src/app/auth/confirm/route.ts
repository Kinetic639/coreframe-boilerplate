import { type EmailOtpType } from "@supabase/supabase-js";
import { type NextRequest, NextResponse } from "next/server";
import { createClient } from "@/utils/supabase/server";

export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const token_hash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/en/dashboard-old/start";

  console.log("[Auth Confirm] Token hash:", token_hash ? "present" : "missing");
  console.log("[Auth Confirm] Type:", type);
  console.log("[Auth Confirm] Next:", next);
  console.log("[Auth Confirm] Origin:", origin);

  if (token_hash && type) {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.verifyOtp({ type, token_hash });

    console.log("[Auth Confirm] Verify result:", { data: !!data, error: error?.message });

    if (!error) {
      // Successful verification - redirect to the next page
      const redirectUrl = `${origin}${next}`;
      console.log("[Auth Confirm] Redirecting to:", redirectUrl);
      return NextResponse.redirect(redirectUrl);
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
